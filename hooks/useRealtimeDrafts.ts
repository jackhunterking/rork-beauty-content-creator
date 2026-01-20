import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Draft, DraftRow } from '@/types';
import { fetchDrafts as fetchDraftsFromService } from '@/services/draftService';
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

/**
 * Convert database row (snake_case) to Draft type (camelCase)
 */
function mapRowToDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    projectName: row.project_name || undefined,
    beforeImageUrl: row.before_image_url,
    afterImageUrl: row.after_image_url,
    capturedImageUrls: row.captured_image_urls || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    renderedPreviewUrl: row.rendered_preview_url || undefined,
    wasRenderedAsPremium: row.was_rendered_as_premium ?? undefined,
  };
}

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

    // Use a unique channel name to avoid conflicts during rapid remounts
    const channelName = `drafts-realtime-${Date.now()}`;
    
    // Create real-time channel for drafts table
    // Note: RLS policies ensure users only receive events for their own drafts
    const channel = supabase
      .channel(channelName)
      .on<DraftRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'drafts',
        },
        handleInsert
      )
      .on<DraftRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drafts',
        },
        handleUpdate
      )
      .on<DraftRow>(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'drafts',
        },
        handleDelete
      )
      .subscribe((status, err) => {
        if (!mountedRef.current) return;
        
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeDrafts] ✓ Subscription active for drafts table');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeDrafts] ✗ Channel error:', err?.message || 'Connection issue');
          if (err?.message) {
            setError(new Error('Real-time subscription failed'));
          }
        } else if (status === 'TIMED_OUT') {
          console.error('[RealtimeDrafts] ✗ Subscription timed out');
          setError(new Error('Real-time subscription timed out'));
        }
      });

    channelRef.current = channel;

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
