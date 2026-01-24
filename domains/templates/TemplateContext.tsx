import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Template, TemplateFormat, ContentType } from '@/types';
import { toggleTemplateFavourite } from '@/services/templateService';
import { useRealtimeTemplates, optimisticUpdateTemplate } from '@/hooks/useRealtimeTemplates';
import { getDefaultFormat } from '@/constants/formats';
import { filterTemplates, getFavouriteTemplates } from './types';

export const [TemplateProvider, useTemplates] = createContextHook(() => {
  // Use real-time templates hook
  const { 
    templates: realtimeTemplates, 
    isLoading: isTemplatesLoading, 
    error: templatesError,
    refetch: refetchTemplates 
  } = useRealtimeTemplates();

  // Local state for optimistic updates
  const [templates, setTemplates] = useState<Template[]>([]);
  
  // Selected format filter (4:5, 1:1, or 9:16)
  const [selectedFormat, setSelectedFormat] = useState<TemplateFormat>(getDefaultFormat() as TemplateFormat);
  
  // Content type (single, carousel, video)
  const [contentType, setContentType] = useState<ContentType>('single');

  // Sync real-time templates to local state
  useEffect(() => {
    setTemplates(realtimeTemplates);
  }, [realtimeTemplates]);

  // Filter templates by format and content type
  const filteredTemplates = useMemo(() => 
    filterTemplates(templates, selectedFormat, contentType),
    [templates, selectedFormat, contentType]
  );

  // Get favourite templates
  const favouriteTemplates = useMemo(() => 
    getFavouriteTemplates(templates),
    [templates]
  );

  // Toggle favourite status
  const toggleFavourite = useCallback(async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Optimistic update
    const newIsFavourite = !template.isFavourite;
    optimisticUpdateTemplate(templateId, { isFavourite: newIsFavourite });
    setTemplates(prev => 
      prev.map(t => t.id === templateId ? { ...t, isFavourite: newIsFavourite } : t)
    );

    try {
      await toggleTemplateFavourite(templateId, newIsFavourite);
    } catch (error) {
      // Revert on error
      optimisticUpdateTemplate(templateId, { isFavourite: !newIsFavourite });
      setTemplates(prev => 
        prev.map(t => t.id === templateId ? { ...t, isFavourite: !newIsFavourite } : t)
      );
      console.error('[TemplateContext] Failed to toggle favourite:', error);
    }
  }, [templates]);

  // Set format
  const setFormat = useCallback((format: TemplateFormat) => {
    setSelectedFormat(format);
  }, []);

  return {
    // State
    templates,
    filteredTemplates,
    favouriteTemplates,
    selectedFormat,
    contentType,
    isLoading: isTemplatesLoading,
    error: templatesError,
    
    // Actions
    setFormat,
    setContentType,
    toggleFavourite,
    refetchTemplates,
  };
});
