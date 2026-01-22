import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Template, TemplateRow } from '@/types';
import { mapRowToTemplate, fetchTemplates } from '@/services/templateService';
import { clearCacheForTemplate } from '@/services/imageCacheService';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeTemplatesResult {
  templates: Template[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook that provides real-time templates from Supabase.
 * 
 * IMPORTANT: Realtime payloads may not include all fields (especially large JSON columns).
 * This hook MERGES updates with existing data to preserve fields not in the payload.
 */
export function useRealtimeTemplates(): UseRealtimeTemplatesResult {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);

  // Initial fetch - this gets ALL template data including layers_json
  const fetchInitialTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchTemplates();
      console.log('[Realtime] Initial fetch complete:', data.length, 'templates');
      setTemplates(data);
    } catch (err) {
      console.error('[Realtime] Error fetching templates:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch templates'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle INSERT - new templates get full data from payload
  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<TemplateRow>) => {
    const newRow = payload.new as TemplateRow;
    if (!newRow.is_active) return;
    
    console.log('[Realtime] INSERT:', newRow.name);
    const newTemplate = mapRowToTemplate(newRow);
    setTemplates(prev => [...prev, newTemplate]);
  }, []);

  // Handle UPDATE - MERGE with existing data to preserve fields not in payload
  const handleUpdate = useCallback(async (payload: RealtimePostgresChangesPayload<TemplateRow>) => {
    const updatedRow = payload.new as TemplateRow;
    console.log('[Realtime] UPDATE:', updatedRow.name, '(has layers_json:', !!updatedRow.layers_json, ')');
    
    // Clear image cache for fresh images
    await clearCacheForTemplate(updatedRow.id);
    
    setTemplates(prev => {
      // If template became inactive, remove it
      if (!updatedRow.is_active) {
        console.log('[Realtime] Removing inactive template:', updatedRow.name);
        return prev.filter(t => t.id !== updatedRow.id);
      }
      
      const existingIndex = prev.findIndex(t => t.id === updatedRow.id);
      
      if (existingIndex >= 0) {
        // MERGE: Start with existing template, overlay with new data
        const existingTemplate = prev[existingIndex];
        const partialUpdate = mapRowToTemplate(updatedRow);
        
        // Only update fields that are actually present in the payload
        // This preserves layersJson when realtime doesn't include layers_json
        const mergedTemplate: Template = {
          ...existingTemplate,
          // Always update these simple fields
          name: partialUpdate.name,
          thumbnail: partialUpdate.thumbnail,
          isActive: partialUpdate.isActive,
          isFavourite: partialUpdate.isFavourite,
          isPremium: partialUpdate.isPremium,
          format: partialUpdate.format,
          updatedAt: partialUpdate.updatedAt,
          // URLs - update if present in payload
          templatedPreviewUrl: partialUpdate.templatedPreviewUrl ?? existingTemplate.templatedPreviewUrl,
          frameOverlayUrl: partialUpdate.frameOverlayUrl ?? existingTemplate.frameOverlayUrl,
          // Large JSON fields - ONLY update if actually present in the realtime payload
          layersJson: updatedRow.layers_json ? partialUpdate.layersJson : existingTemplate.layersJson,
          themeLayers: updatedRow.theme_layers ? partialUpdate.themeLayers : existingTemplate.themeLayers,
          vectorLayers: updatedRow.vector_layers ? partialUpdate.vectorLayers : existingTemplate.vectorLayers,
          // Default colors
          defaultBackgroundColor: partialUpdate.defaultBackgroundColor ?? existingTemplate.defaultBackgroundColor,
          defaultThemeColor: partialUpdate.defaultThemeColor ?? existingTemplate.defaultThemeColor,
        };
        
        console.log('[Realtime] Merged template:', mergedTemplate.name, 
          'layersJson:', mergedTemplate.layersJson?.length ?? 0, 'layers',
          'themeLayers:', mergedTemplate.themeLayers?.length ?? 0);
        
        const updated = [...prev];
        updated[existingIndex] = mergedTemplate;
        return updated;
      } else {
        // New template (became active) - use full data from payload
        console.log('[Realtime] Adding newly active template:', updatedRow.name);
        return [...prev, mapRowToTemplate(updatedRow)];
      }
    });
  }, []);

  // Handle DELETE
  const handleDelete = useCallback((payload: RealtimePostgresChangesPayload<TemplateRow>) => {
    const deletedRow = payload.old as TemplateRow;
    console.log('[Realtime] DELETE:', deletedRow.id);
    setTemplates(prev => prev.filter(t => t.id !== deletedRow.id));
  }, []);

  // Set up subscription
  useEffect(() => {
    mountedRef.current = true;
    fetchInitialTemplates();

    const channel = supabase
      .channel(`templates-${Date.now()}`)
      .on<TemplateRow>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'templates' }, handleInsert)
      .on<TemplateRow>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'templates' }, handleUpdate)
      .on<TemplateRow>('postgres_changes', { event: 'DELETE', schema: 'public', table: 'templates' }, handleDelete)
      .subscribe((status, err) => {
        if (!mountedRef.current) return;
        console.log('[Realtime] Status:', status);
        if (status === 'CHANNEL_ERROR' && err?.message) {
          setError(new Error('Real-time subscription failed'));
        }
      });

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchInitialTemplates, handleInsert, handleUpdate, handleDelete]);

  const refetch = useCallback(async () => {
    await fetchInitialTemplates();
  }, [fetchInitialTemplates]);

  return { templates, isLoading, error, refetch };
}
