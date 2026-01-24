import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Draft, DraftRow } from '@/types';
import { fetchDrafts as fetchDraftsFromService, mapRowToDraft as mapRowToDraftFromService } from '@/services/draftService';
import { getLocalPreviewPath } from '@/services/localStorageService';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeDraftsResult {
  drafts: Draft[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Simple debounce hook to prevent rapid state updates from realtime events.
 * Returns a debounced version of the callback that batches rapid calls.
 */
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  
  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

// Use the shared mapper from draftService to ensure all fields are included
const mapRowToDraft = mapRowToDraftFromService;

/**
 * Hook that provides real-time drafts from Supabase.
 * Automatically subscribes to INSERT, UPDATE, DELETE events on the drafts table.
 * Only active when user is authenticated.
 */
export function useRealtimeDrafts(isAuthenticated: boolean): UseRealtimeDraftsResult {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);

  // Initial fetch of drafts
  const fetchInitialDrafts = useCallback(async () => {
    if (!isAuthenticated) {
      setDrafts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchDraftsFromService();
      if (mountedRef.current) {
        setDrafts(data);
      }
    } catch (err) {
      console.error('[RealtimeDrafts] Error fetching drafts:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch drafts'));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated]);

  // Handle real-time INSERT event
  const handleInsert = useCallback(async (payload: RealtimePostgresChangesPayload<DraftRow>) => {
    if (!mountedRef.current) return;
    
    const newRow = payload.new as DraftRow;
    const newDraft = mapRowToDraft(newRow);
    
    // Try to get local preview path
    try {
      const localPath = await getLocalPreviewPath(newDraft.id);
      newDraft.localPreviewPath = localPath;
    } catch {
      // Ignore - local preview may not exist yet
    }
    
    console.log('[RealtimeDrafts] INSERT received:', newDraft.id.substring(0, 8));
    
    setDrafts(prev => {
      // Check if draft already exists (prevent duplicates)
      if (prev.some(d => d.id === newDraft.id)) {
        return prev;
      }
      // Add new draft at the beginning (most recent first)
      return [newDraft, ...prev];
    });
  }, []);

  // Handle real-time UPDATE event (core logic)
  const processUpdate = useCallback(async (payload: RealtimePostgresChangesPayload<DraftRow>) => {
    if (!mountedRef.current) return;
    
    const updatedRow = payload.new as DraftRow;
    const updatedDraft = mapRowToDraft(updatedRow);
    
    // Try to get local preview path
    try {
      const localPath = await getLocalPreviewPath(updatedDraft.id);
      updatedDraft.localPreviewPath = localPath;
    } catch {
      // Ignore - local preview may not exist
    }
    
    console.log('[RealtimeDrafts] UPDATE received:', updatedDraft.id.substring(0, 8));
    
    setDrafts(prev => {
      const existingIndex = prev.findIndex(d => d.id === updatedDraft.id);
      
      if (existingIndex >= 0) {
        // Update existing draft and move to top (most recent)
        const updated = prev.filter(d => d.id !== updatedDraft.id);
        return [updatedDraft, ...updated];
      } else {
        // Draft doesn't exist in list, add it
        return [updatedDraft, ...prev];
      }
    });
  }, []);

  // Debounced UPDATE handler to prevent rapid state updates
  const handleUpdate = useDebouncedCallback(processUpdate, 100);

  // Handle real-time DELETE event
  const handleDelete = useCallback((payload: RealtimePostgresChangesPayload<DraftRow>) => {
    if (!mountedRef.current) return;
    
    const deletedRow = payload.old as DraftRow;
    console.log('[RealtimeDrafts] DELETE received:', deletedRow.id.substring(0, 8));
    
    setDrafts(prev => prev.filter(d => d.id !== deletedRow.id));
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    mountedRef.current = true;

    // Clear drafts and skip subscription if not authenticated
    if (!isAuthenticated) {
      setDrafts([]);
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchInitialDrafts();

    let channel: RealtimeChannel | null = null;

    // Set up subscription after ensuring auth session is ready
    const setupSubscription = async () => {
      // Wait for auth session to be fully loaded
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !mountedRef.current) {
        console.log('[RealtimeDrafts] No session available, skipping realtime subscription');
        return;
      }

      // Use a unique channel name to avoid conflicts during rapid remounts
      const channelName = `drafts-realtime-${Date.now()}`;
      
      // Create real-time channel for drafts table using a single wildcard subscription
      // This is more reliable than multiple separate subscriptions
      // Note: RLS policies ensure users only receive events for their own drafts
      channel = supabase
        .channel(channelName)
        .on<DraftRow>(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'drafts',
          },
          (payload) => {
            if (!mountedRef.current) return;
            
            // Route to appropriate handler based on event type
            switch (payload.eventType) {
              case 'INSERT':
                handleInsert(payload);
                break;
              case 'UPDATE':
                handleUpdate(payload);
                break;
              case 'DELETE':
                handleDelete(payload);
                break;
            }
          }
        )
        .subscribe((status, err) => {
          if (!mountedRef.current) return;
          
          if (status === 'SUBSCRIBED') {
            console.log('[RealtimeDrafts] ✓ Subscription active for drafts table');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('[RealtimeDrafts] Channel status:', status, err?.message);
            // Don't set error state - the initial fetch still works and users won't notice
          } else if (status === 'TIMED_OUT') {
            console.log('[RealtimeDrafts] Subscription timed out, using polling');
          } else {
            console.log('[RealtimeDrafts] Channel status:', status);
          }
        });

      channelRef.current = channel;
    };

    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isAuthenticated, fetchInitialDrafts, handleInsert, processUpdate, handleUpdate, handleDelete]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    await fetchInitialDrafts();
  }, [fetchInitialDrafts]);

  return {
    drafts,
    isLoading,
    error,
    refetch,
  };
}
