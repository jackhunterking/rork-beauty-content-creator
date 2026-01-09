import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Template, TemplateRow } from '@/types';
import { mapRowToTemplate, fetchTemplates } from '@/services/templateService';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeTemplatesResult {
  templates: Template[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook that provides real-time templates from Supabase.
 * Automatically subscribes to INSERT, UPDATE, DELETE events on the templates table.
 */
export function useRealtimeTemplates(): UseRealtimeTemplatesResult {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initial fetch of templates
  const fetchInitialTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[DEBUG:Realtime] Fetching initial templates...');
      const data = await fetchTemplates();
      console.log('[DEBUG:Realtime] Initial fetch complete. Templates:', data.length);
      // DEBUG: Log each template's updatedAt
      data.forEach((t, i) => {
        console.log(`[DEBUG:Realtime] Initial template[${i}] ${t.name}:`);
        console.log(`[DEBUG:Realtime]   updatedAt: "${t.updatedAt}" (type: ${typeof t.updatedAt})`);
        console.log(`[DEBUG:Realtime]   cacheKey would be: ${t.id}-${t.updatedAt}`);
      });
      setTemplates(data);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch templates'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle real-time INSERT event
  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<TemplateRow>) => {
    console.log('[Realtime] INSERT received:', payload.new);
    const newRow = payload.new as TemplateRow;
    // Only add if it's active
    if (newRow.is_active) {
      const newTemplate = mapRowToTemplate(newRow);
      console.log('[Realtime] Adding new template:', newTemplate.name);
      setTemplates(prev => [...prev, newTemplate]);
    }
  }, []);

  // Handle real-time UPDATE event
  const handleUpdate = useCallback((payload: RealtimePostgresChangesPayload<TemplateRow>) => {
    console.log('[Realtime] UPDATE received:', payload.new);
    const updatedRow = payload.new as TemplateRow;
    
    // DEBUG: Log raw updated_at from payload
    console.log('[DEBUG:Realtime] Raw payload.new.updated_at:', updatedRow.updated_at, 'type:', typeof updatedRow.updated_at);
    
    const updatedTemplate = mapRowToTemplate(updatedRow);
    
    console.log('[Realtime] Updating template:', updatedTemplate.name, 'thumbnail:', updatedTemplate.thumbnail);
    // DEBUG: Log the updatedAt field after mapping
    console.log('[DEBUG:Realtime] Mapped template.updatedAt:', updatedTemplate.updatedAt, 'type:', typeof updatedTemplate.updatedAt);
    console.log('[DEBUG:Realtime] Expected cacheKey:', `${updatedTemplate.id}-${updatedTemplate.updatedAt}`);
    
    setTemplates(prev => {
      // If template became inactive, remove it
      if (!updatedRow.is_active) {
        console.log('[Realtime] Template became inactive, removing:', updatedTemplate.name);
        return prev.filter(t => t.id !== updatedTemplate.id);
      }
      
      // Check if template exists in current list
      const existingIndex = prev.findIndex(t => t.id === updatedTemplate.id);
      
      if (existingIndex >= 0) {
        // Update existing template
        console.log('[Realtime] Updating existing template at index:', existingIndex);
        // DEBUG: Log old vs new updatedAt
        console.log('[DEBUG:Realtime] Old updatedAt:', prev[existingIndex].updatedAt);
        console.log('[DEBUG:Realtime] New updatedAt:', updatedTemplate.updatedAt);
        console.log('[DEBUG:Realtime] Old cacheKey:', `${prev[existingIndex].id}-${prev[existingIndex].updatedAt}`);
        console.log('[DEBUG:Realtime] New cacheKey:', `${updatedTemplate.id}-${updatedTemplate.updatedAt}`);
        const updated = [...prev];
        updated[existingIndex] = updatedTemplate;
        return updated;
      } else {
        // Template became active, add it
        console.log('[Realtime] Template became active, adding:', updatedTemplate.name);
        return [...prev, updatedTemplate];
      }
    });
  }, []);

  // Handle real-time DELETE event
  const handleDelete = useCallback((payload: RealtimePostgresChangesPayload<TemplateRow>) => {
    console.log('[Realtime] DELETE received:', payload.old);
    const deletedRow = payload.old as TemplateRow;
    console.log('[Realtime] Removing template:', deletedRow.id);
    setTemplates(prev => prev.filter(t => t.id !== deletedRow.id));
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    // Initial fetch
    fetchInitialTemplates();

    // Create real-time channel for templates table
    const channel = supabase
      .channel('templates-realtime')
      .on<TemplateRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'templates',
        },
        handleInsert
      )
      .on<TemplateRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'templates',
        },
        handleUpdate
      )
      .on<TemplateRow>(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'templates',
        },
        handleDelete
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Subscription status:', status, err ? `Error: ${err.message}` : '');
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✓ Subscription active for templates table');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] ✗ Channel error:', err);
          setError(new Error('Real-time subscription failed'));
        } else if (status === 'TIMED_OUT') {
          console.error('[Realtime] ✗ Subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('[Realtime] Channel closed');
        }
      });

    channelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchInitialTemplates, handleInsert, handleUpdate, handleDelete]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    await fetchInitialTemplates();
  }, [fetchInitialTemplates]);

  return {
    templates,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Optimistically update a template in the local state.
 * Used for immediate UI feedback before the database confirms the change.
 */
export function optimisticUpdateTemplate(
  templates: Template[],
  templateId: string,
  updates: Partial<Template>
): Template[] {
  return templates.map(t =>
    t.id === templateId ? { ...t, ...updates } : t
  );
}

