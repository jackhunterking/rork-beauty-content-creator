import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Template, SavedAsset, BrandKit, ContentType, MediaAsset, Draft, TemplateFormat, CapturedImages } from '@/types';
import { toggleTemplateFavourite } from '@/services/templateService';
import { fetchDrafts, deleteDraft as deleteDraftService, saveDraftWithImages } from '@/services/draftService';
import { useRealtimeTemplates, optimisticUpdateTemplate } from '@/hooks/useRealtimeTemplates';
import { extractSlots } from '@/utils/slotParser';

const STORAGE_KEYS = {
  WORK: 'beauty_work',
  CREDITS: 'beauty_credits',
  BRAND_KIT: 'beauty_brand_kit',
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  
  // Use real-time templates hook instead of React Query
  const { 
    templates: realtimeTemplates, 
    isLoading: isTemplatesLoading, 
    error: templatesError,
    refetch: refetchTemplates 
  } = useRealtimeTemplates();
  
  // Local state for optimistic updates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [work, setWork] = useState<SavedAsset[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [credits, setCredits] = useState<number>(50);
  const [brandKit, setBrandKit] = useState<BrandKit>({
    applyLogoAutomatically: false,
    addDisclaimer: false,
  });
  
  // Selected format filter ('all' shows all templates)
  const [selectedFormat, setSelectedFormat] = useState<TemplateFormat | 'all'>('all');

  // Current project stores the template and captured images for each slot
  const [currentProject, setCurrentProject] = useState<{
    contentType: ContentType;
    template: Template | null;
    // Dynamic captured images keyed by slot layer ID
    capturedImages: CapturedImages;
    // Legacy fields - kept for backwards compatibility during transition
    beforeMedia: MediaAsset | null;
    afterMedia: MediaAsset | null;
    draftId: string | null;  // Track if we're editing an existing draft
  }>({
    contentType: 'single',
    template: null,
    capturedImages: {},
    beforeMedia: null,
    afterMedia: null,
    draftId: null,
  });

  // Sync real-time templates to local state
  useEffect(() => {
    setTemplates(realtimeTemplates);
  }, [realtimeTemplates]);

  const workQuery = useQuery({
    queryKey: ['work'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.WORK);
      return stored ? (JSON.parse(stored) as SavedAsset[]) : [];
    },
  });

  const creditsQuery = useQuery({
    queryKey: ['credits'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CREDITS);
      return stored ? parseInt(stored, 10) : 50;
    },
  });

  const brandKitQuery = useQuery({
    queryKey: ['brandKit'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.BRAND_KIT);
      return stored ? (JSON.parse(stored) as BrandKit) : {
        applyLogoAutomatically: false,
        addDisclaimer: false,
      };
    },
  });

  // Fetch drafts from Supabase
  const draftsQuery = useQuery({
    queryKey: ['drafts'],
    queryFn: fetchDrafts,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  useEffect(() => {
    if (workQuery.data) setWork(workQuery.data);
  }, [workQuery.data]);

  useEffect(() => {
    if (creditsQuery.data !== undefined) setCredits(creditsQuery.data);
  }, [creditsQuery.data]);

  useEffect(() => {
    if (brandKitQuery.data) setBrandKit(brandKitQuery.data);
  }, [brandKitQuery.data]);

  useEffect(() => {
    if (draftsQuery.data) setDrafts(draftsQuery.data);
  }, [draftsQuery.data]);

  // Toggle favourite with optimistic update
  const toggleFavourite = useCallback(async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const newFavouriteState = !template.isFavourite;
    
    // Optimistic update - immediately update UI
    setTemplates(prev => optimisticUpdateTemplate(prev, templateId, { isFavourite: newFavouriteState }));
    
    try {
      // Sync with database
      await toggleTemplateFavourite(templateId, newFavouriteState);
      // Real-time subscription will handle the actual update
    } catch (error) {
      console.error('Error toggling favourite:', error);
      // Revert on error
      setTemplates(prev => optimisticUpdateTemplate(prev, templateId, { isFavourite: !newFavouriteState }));
    }
  }, [templates]);

  const saveToWorkMutation = useMutation({
    mutationFn: async (asset: SavedAsset) => {
      const updated = [asset, ...work];
      await AsyncStorage.setItem(STORAGE_KEYS.WORK, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setWork(data);
      queryClient.invalidateQueries({ queryKey: ['work'] });
    },
  });

  const deleteFromWorkMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const updated = work.filter(a => a.id !== assetId);
      await AsyncStorage.setItem(STORAGE_KEYS.WORK, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setWork(data);
      queryClient.invalidateQueries({ queryKey: ['work'] });
    },
  });

  const spendCreditsMutation = useMutation({
    mutationFn: async (amount: number) => {
      const newBalance = Math.max(0, credits - amount);
      await AsyncStorage.setItem(STORAGE_KEYS.CREDITS, String(newBalance));
      return newBalance;
    },
    onSuccess: (data) => {
      setCredits(data);
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });

  const updateBrandKitMutation = useMutation({
    mutationFn: async (updates: Partial<BrandKit>) => {
      const updated = { ...brandKit, ...updates };
      await AsyncStorage.setItem(STORAGE_KEYS.BRAND_KIT, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setBrandKit(data);
      queryClient.invalidateQueries({ queryKey: ['brandKit'] });
    },
  });

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async ({ 
      templateId, 
      beforeImageUri, 
      afterImageUri,
      existingDraftId 
    }: { 
      templateId: string; 
      beforeImageUri: string | null; 
      afterImageUri: string | null;
      existingDraftId?: string;
    }) => {
      return saveDraftWithImages(templateId, beforeImageUri, afterImageUri, existingDraftId);
    },
    onSuccess: (savedDraft) => {
      // Update current project with the draft ID
      setCurrentProject(prev => ({ ...prev, draftId: savedDraft.id }));
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });

  // Delete draft mutation
  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      await deleteDraftService(draftId);
      return draftId;
    },
    onSuccess: (deletedId) => {
      setDrafts(prev => prev.filter(d => d.id !== deletedId));
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });

  // Filter templates by favourite status
  const favouriteTemplates = useMemo(() => 
    templates.filter(t => t.isFavourite), 
    [templates]
  );

  // Filter templates by selected content type AND format
  const filteredTemplates = useMemo(() => 
    templates.filter(t => {
      const matchesContentType = t.supports.includes(currentProject.contentType);
      const matchesFormat = selectedFormat === 'all' || t.format === selectedFormat;
      return matchesContentType && matchesFormat;
    }),
    [templates, currentProject.contentType, selectedFormat]
  );

  const setContentType = useCallback((type: ContentType) => {
    setCurrentProject(prev => ({ ...prev, contentType: type }));
  }, []);

  const setFormat = useCallback((format: TemplateFormat | 'all') => {
    setSelectedFormat(format);
  }, []);

  // Select template - stores the full template object with slot specs
  // Also resets all captured images and draftId to ensure fresh start
  const selectTemplate = useCallback((template: Template) => {
    setCurrentProject(prev => ({ 
      ...prev, 
      template,
      capturedImages: {},
      beforeMedia: null,
      afterMedia: null,
      draftId: null,
    }));
  }, []);

  // Legacy support: select by ID (finds template from list)
  // Also resets all captured images and draftId to ensure fresh start
  const selectTemplateById = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setCurrentProject(prev => ({ 
        ...prev, 
        template,
        capturedImages: {},
        beforeMedia: null,
        afterMedia: null,
        draftId: null,
      }));
    }
  }, [templates]);

  // Set captured image for a specific slot by layer ID
  const setCapturedImage = useCallback((layerId: string, media: MediaAsset | null) => {
    setCurrentProject(prev => ({
      ...prev,
      capturedImages: {
        ...prev.capturedImages,
        [layerId]: media,
      },
    }));
  }, []);

  // Clear a specific slot
  const clearCapturedImage = useCallback((layerId: string) => {
    setCapturedImage(layerId, null);
  }, [setCapturedImage]);

  // Reset all captured images
  const resetCapturedImages = useCallback(() => {
    setCurrentProject(prev => ({
      ...prev,
      capturedImages: {},
    }));
  }, []);

  // Legacy: set before media (for backwards compatibility)
  const setBeforeMedia = useCallback((media: MediaAsset | null) => {
    setCurrentProject(prev => ({ ...prev, beforeMedia: media }));
    // Also set in capturedImages for new architecture
    if (media) {
      setCapturedImage('slot-before', media);
    }
  }, [setCapturedImage]);

  // Legacy: set after media (for backwards compatibility)
  const setAfterMedia = useCallback((media: MediaAsset | null) => {
    setCurrentProject(prev => ({ ...prev, afterMedia: media }));
    // Also set in capturedImages for new architecture
    if (media) {
      setCapturedImage('slot-after', media);
    }
  }, [setCapturedImage]);

  const resetProject = useCallback(() => {
    setCurrentProject({
      contentType: 'single',
      template: null,
      capturedImages: {},
      beforeMedia: null,
      afterMedia: null,
      draftId: null,
    });
  }, []);

  // Load a draft into the current project
  // Supports both legacy before/after format and new capturedImageUrls format
  const loadDraft = useCallback((draft: Draft, template: Template) => {
    // Extract slots from template to get dimensions
    const slots = extractSlots(template);
    
    // Build capturedImages from draft data
    const capturedImages: CapturedImages = {};
    
    // First, try new format (capturedImageUrls)
    if (draft.capturedImageUrls) {
      for (const [layerId, url] of Object.entries(draft.capturedImageUrls)) {
        const slot = slots.find(s => s.layerId === layerId);
        if (slot && url) {
          capturedImages[layerId] = {
            uri: url,
            width: slot.width,
            height: slot.height,
          };
        }
      }
    }
    
    // Legacy: Handle before/after image URLs
    // Map to slot-before and slot-after for backwards compatibility
    const beforeSlot = slots.find(s => s.layerId.includes('before'));
    const afterSlot = slots.find(s => s.layerId.includes('after'));
    
    if (draft.beforeImageUrl && beforeSlot) {
      capturedImages[beforeSlot.layerId] = {
        uri: draft.beforeImageUrl,
        width: beforeSlot.width,
        height: beforeSlot.height,
      };
    }
    
    if (draft.afterImageUrl && afterSlot) {
      capturedImages[afterSlot.layerId] = {
        uri: draft.afterImageUrl,
        width: afterSlot.width,
        height: afterSlot.height,
      };
    }
    
    // Legacy beforeMedia/afterMedia for backwards compatibility
    const beforeMedia = draft.beforeImageUrl && template.beforeSlot ? {
      uri: draft.beforeImageUrl,
      width: template.beforeSlot.width,
      height: template.beforeSlot.height,
    } : null;
    
    const afterMedia = draft.afterImageUrl && template.afterSlot ? {
      uri: draft.afterImageUrl,
      width: template.afterSlot.width,
      height: template.afterSlot.height,
    } : null;
    
    setCurrentProject({
      contentType: 'single',
      template,
      capturedImages,
      beforeMedia,
      afterMedia,
      draftId: draft.id,
    });
  }, []);

  // Refresh drafts
  const refreshDrafts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['drafts'] });
  }, [queryClient]);

  const getCreditCost = useCallback(() => {
    return currentProject.contentType === 'carousel' ? 3 : 1;
  }, [currentProject.contentType]);

  return {
    // Templates (with real-time updates)
    templates,
    filteredTemplates,
    favouriteTemplates,
    templatesError,
    refetchTemplates,
    
    // Other state
    work,
    drafts,
    credits,
    brandKit,
    currentProject,
    selectedFormat,
    isLoading: isTemplatesLoading || workQuery.isLoading,
    isDraftsLoading: draftsQuery.isLoading,
    
    // Actions
    toggleFavourite,
    saveToWork: (asset: SavedAsset) => saveToWorkMutation.mutate(asset),
    deleteFromWork: (id: string) => deleteFromWorkMutation.mutate(id),
    spendCredits: (amount: number) => spendCreditsMutation.mutate(amount),
    updateBrandKit: (updates: Partial<BrandKit>) => updateBrandKitMutation.mutate(updates),
    setContentType,
    setFormat,
    selectTemplate,
    selectTemplateById,
    
    // Dynamic slot actions (new architecture)
    setCapturedImage,
    clearCapturedImage,
    resetCapturedImages,
    
    // Legacy actions (backwards compatibility)
    setBeforeMedia,
    setAfterMedia,
    resetProject,
    getCreditCost,
    
    // Draft actions
    saveDraft: (params: { 
      templateId: string; 
      beforeImageUri: string | null; 
      afterImageUri: string | null;
      existingDraftId?: string;
    }) => saveDraftMutation.mutateAsync(params),
    deleteDraft: (draftId: string) => deleteDraftMutation.mutateAsync(draftId),
    loadDraft,
    refreshDrafts,
    isSavingDraft: saveDraftMutation.isPending,
  };
});
