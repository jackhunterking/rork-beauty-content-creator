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
      const data = await fetchTemplates();
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
    const newRow = payload.new as TemplateRow;
    // Only add if it's active
    if (newRow.is_active) {
      const newTemplate = mapRowToTemplate(newRow);
      setTemplates(prev => [...prev, newTemplate]);
    }
  }, []);

  // Handle real-time UPDATE event
  const handleUpdate = useCallback((payload: RealtimePostgresChangesPayload<TemplateRow>) => {
    const updatedRow = payload.new as TemplateRow;
    const updatedTemplate = mapRowToTemplate(updatedRow);
    
    setTemplates(prev => {
      // If template became inactive, remove it
      if (!updatedRow.is_active) {
        return prev.filter(t => t.id !== updatedTemplate.id);
      }
      
      // Check if template exists in current list
      const existingIndex = prev.findIndex(t => t.id === updatedTemplate.id);
      
      if (existingIndex >= 0) {
        // Update existing template
        const updated = [...prev];
        updated[existingIndex] = updatedTemplate;
        return updated;
      } else {
        // Template became active, add it
        return [...prev, updatedTemplate];
      }
    });
  }, []);

  // Handle real-time DELETE event
  const handleDelete = useCallback((payload: RealtimePostgresChangesPayload<TemplateRow>) => {
    const deletedRow = payload.old as TemplateRow;
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscription active for templates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Real-time channel error');
          setError(new Error('Real-time subscription failed'));
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

