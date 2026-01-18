import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Template, SavedAsset, BrandKit, ContentType, MediaAsset, Draft, TemplateFormat, CapturedImages, SlotStates, SlotState, PortfolioItem } from '@/types';
import { toggleTemplateFavourite } from '@/services/templateService';
import { deleteDraft as deleteDraftService, saveDraftWithImages, duplicateDraft as duplicateDraftService } from '@/services/draftService';
import { fetchPortfolioItems, createPortfolioItem, deletePortfolioItem as deletePortfolioItemService } from '@/services/portfolioService';
import { useRealtimeTemplates, optimisticUpdateTemplate } from '@/hooks/useRealtimeTemplates';
import { useRealtimeDrafts } from '@/hooks/useRealtimeDrafts';
import { extractSlots } from '@/utils/slotParser';
import { initializeLocalStorage } from '@/services/localStorageService';
import { useAuthContext } from '@/contexts/AuthContext';
import { getDefaultFormat } from '@/constants/formats';

const STORAGE_KEYS = {
  LEGACY_PORTFOLIO: 'resulta_work',
  BRAND_KIT: 'resulta_brand_kit',
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  
  // Get authentication status to gate queries that require auth
  const { isAuthenticated } = useAuthContext();
  
  // Use real-time templates hook instead of React Query
  const { 
    templates: realtimeTemplates, 
    isLoading: isTemplatesLoading, 
    error: templatesError,
    refetch: refetchTemplates 
  } = useRealtimeTemplates();

  // Use real-time drafts hook - single source of truth, no dual caching
  const {
    drafts: realtimeDrafts,
    isLoading: isDraftsLoading,
    refetch: refetchDrafts,
  } = useRealtimeDrafts(isAuthenticated);
  
  // Local state for optimistic updates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [legacyPortfolio, setLegacyPortfolio] = useState<SavedAsset[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [brandKit, setBrandKit] = useState<BrandKit>({
    applyLogoAutomatically: false,
    addDisclaimer: false,
  });
  
  // Selected format filter (4:5, 1:1, or 9:16)
  // Use centralized default format
  const [selectedFormat, setSelectedFormat] = useState<TemplateFormat>(getDefaultFormat() as TemplateFormat);

  // Per-slot state management
  const [slotStates, setSlotStatesMap] = useState<SlotStates>({});
  
  // Composed preview state
  const [composedPreviewUri, setComposedPreviewUri] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  // Current project stores the template and captured images for each slot
  const [currentProject, setCurrentProject] = useState<{
    contentType: ContentType;
    template: Template | null;
    capturedImages: CapturedImages;
    beforeMedia: MediaAsset | null;
    afterMedia: MediaAsset | null;
    draftId: string | null;
    cachedPreviewUrl: string | null;
    wasRenderedAsPremium: boolean | null;
    localPreviewPath: string | null;
  }>({
    contentType: 'single',
    template: null,
    capturedImages: {},
    beforeMedia: null,
    afterMedia: null,
    draftId: null,
    cachedPreviewUrl: null,
    wasRenderedAsPremium: null,
    localPreviewPath: null,
  });

  // Initialize local storage on app start
  useEffect(() => {
    initializeLocalStorage().catch(console.error);
  }, []);

  // Sync real-time templates to local state
  useEffect(() => {
    setTemplates(realtimeTemplates);
  }, [realtimeTemplates]);

  // Legacy portfolio query (kept for backwards compatibility)
  const legacyPortfolioQuery = useQuery({
    queryKey: ['legacyPortfolio'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LEGACY_PORTFOLIO);
      return stored ? (JSON.parse(stored) as SavedAsset[]) : [];
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

  // Fetch portfolio from Supabase - only when user is authenticated
  const portfolioQuery = useQuery({
    queryKey: ['portfolio', isAuthenticated],
    queryFn: fetchPortfolioItems,
    staleTime: 30 * 1000,
    enabled: isAuthenticated, // Only fetch when user is logged in
  });

  // Clear portfolio when user logs out (drafts handled by useRealtimeDrafts)
  useEffect(() => {
    if (!isAuthenticated) {
      setPortfolio([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (legacyPortfolioQuery.data) setLegacyPortfolio(legacyPortfolioQuery.data);
  }, [legacyPortfolioQuery.data]);

  useEffect(() => {
    if (brandKitQuery.data) setBrandKit(brandKitQuery.data);
  }, [brandKitQuery.data]);

  useEffect(() => {
    if (portfolioQuery.data) setPortfolio(portfolioQuery.data);
  }, [portfolioQuery.data]);

  // Toggle favourite with optimistic update
  const toggleFavourite = useCallback(async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const newFavouriteState = !template.isFavourite;
    
    setTemplates(prev => optimisticUpdateTemplate(prev, templateId, { isFavourite: newFavouriteState }));
    
    try {
      await toggleTemplateFavourite(templateId, newFavouriteState);
    } catch (error) {
      console.error('Error toggling favourite:', error);
      setTemplates(prev => optimisticUpdateTemplate(prev, templateId, { isFavourite: !newFavouriteState }));
    }
  }, [templates]);

  // Legacy save to portfolio mutation (kept for backwards compatibility)
  const saveToLegacyPortfolioMutation = useMutation({
    mutationFn: async (asset: SavedAsset) => {
      const updated = [asset, ...legacyPortfolio];
      await AsyncStorage.setItem(STORAGE_KEYS.LEGACY_PORTFOLIO, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setLegacyPortfolio(data);
      queryClient.invalidateQueries({ queryKey: ['legacyPortfolio'] });
    },
  });

  const deleteFromLegacyPortfolioMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const updated = legacyPortfolio.filter(a => a.id !== assetId);
      await AsyncStorage.setItem(STORAGE_KEYS.LEGACY_PORTFOLIO, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setLegacyPortfolio(data);
      queryClient.invalidateQueries({ queryKey: ['legacyPortfolio'] });
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
      existingDraftId,
      capturedImageUris,
      renderedPreviewUrl,
      wasRenderedAsPremium,
      localPreviewPath,
    }: { 
      templateId: string; 
      beforeImageUri: string | null; 
      afterImageUri: string | null;
      existingDraftId?: string;
      capturedImageUris?: Record<string, string>;
      renderedPreviewUrl?: string | null;
      wasRenderedAsPremium?: boolean;
      localPreviewPath?: string | null;
    }) => {
      return saveDraftWithImages(
        templateId, 
        beforeImageUri, 
        afterImageUri, 
        existingDraftId,
        capturedImageUris,
        renderedPreviewUrl,
        wasRenderedAsPremium,
        localPreviewPath
      );
    },
    onSuccess: (savedDraft) => {
      // Update current project with the saved draft info
      setCurrentProject(prev => ({ 
        ...prev, 
        draftId: savedDraft.id,
        cachedPreviewUrl: savedDraft.renderedPreviewUrl || null,
        wasRenderedAsPremium: savedDraft.wasRenderedAsPremium ?? null,
        localPreviewPath: savedDraft.localPreviewPath || null,
      }));
      // Note: No manual cache updates needed - useRealtimeDrafts will receive
      // the INSERT/UPDATE event from Supabase and update automatically
    },
  });

  // Delete draft mutation
  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      await deleteDraftService(draftId);
      return draftId;
    },
    // Note: No onSuccess needed - useRealtimeDrafts will receive
    // the DELETE event from Supabase and remove the draft automatically
  });

  // Duplicate draft mutation
  const duplicateDraftMutation = useMutation({
    mutationFn: async (sourceDraftId: string) => {
      return duplicateDraftService(sourceDraftId);
    },
    // Note: No onSuccess needed - useRealtimeDrafts will receive
    // the INSERT event from Supabase and add the new draft automatically
  });

  // Add to portfolio mutation
  const addToPortfolioMutation = useMutation({
    mutationFn: createPortfolioItem,
    onSuccess: (newItem) => {
      setPortfolio(prev => [newItem, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  // Delete from portfolio mutation
  const deleteFromPortfolioMutation = useMutation({
    mutationFn: deletePortfolioItemService,
    onSuccess: (_, deletedId) => {
      setPortfolio(prev => prev.filter(p => p.id !== deletedId));
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
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
      const matchesFormat = t.format === selectedFormat;
      return matchesContentType && matchesFormat;
    }),
    [templates, currentProject.contentType, selectedFormat]
  );

  const setContentType = useCallback((type: ContentType) => {
    setCurrentProject(prev => ({ ...prev, contentType: type }));
  }, []);

  const setFormat = useCallback((format: TemplateFormat) => {
    setSelectedFormat(format);
  }, []);

  // Select template
  const selectTemplate = useCallback((template: Template) => {
    const slots = extractSlots(template);
    const initialSlotStates: SlotStates = {};
    slots.forEach(slot => {
      initialSlotStates[slot.layerId] = { state: 'empty' };
    });
    setSlotStatesMap(initialSlotStates);
    setComposedPreviewUri(null);
    
    setCurrentProject(prev => ({ 
      ...prev, 
      template,
      capturedImages: {},
      beforeMedia: null,
      afterMedia: null,
      draftId: null,
      cachedPreviewUrl: null,
      wasRenderedAsPremium: null,
      localPreviewPath: null,
    }));
  }, []);

  // Legacy support: select by ID
  const selectTemplateById = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      selectTemplate(template);
    }
  }, [templates, selectTemplate]);

  // Set slot state
  const setSlotState = useCallback((slotId: string, state: SlotState, errorMessage?: string, progress?: number) => {
    setSlotStatesMap(prev => ({
      ...prev,
      [slotId]: { state, errorMessage, progress },
    }));
  }, []);

  // Set captured image
  const setCapturedImage = useCallback((layerId: string, media: MediaAsset | null) => {
    setCurrentProject(prev => ({
      ...prev,
      capturedImages: {
        ...prev.capturedImages,
        [layerId]: media,
      },
    }));
    
    if (media) {
      setSlotState(layerId, 'ready');
    } else {
      setSlotState(layerId, 'empty');
    }
    
    setComposedPreviewUri(null);
  }, [setSlotState]);

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
    
    const template = currentProject.template;
    if (template) {
      const slots = extractSlots(template);
      const resetStates: SlotStates = {};
      slots.forEach(slot => {
        resetStates[slot.layerId] = { state: 'empty' };
      });
      setSlotStatesMap(resetStates);
    }
    
    setComposedPreviewUri(null);
  }, [currentProject.template]);

  // Legacy: set before media
  const setBeforeMedia = useCallback((media: MediaAsset | null) => {
    setCurrentProject(prev => ({ ...prev, beforeMedia: media }));
    if (media) {
      setCapturedImage('slot-before', media);
    }
  }, [setCapturedImage]);

  // Legacy: set after media
  const setAfterMedia = useCallback((media: MediaAsset | null) => {
    setCurrentProject(prev => ({ ...prev, afterMedia: media }));
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
      cachedPreviewUrl: null,
      wasRenderedAsPremium: null,
      localPreviewPath: null,
    });
    setSlotStatesMap({});
    setComposedPreviewUri(null);
  }, []);

  // Load a draft into the current project
  const loadDraft = useCallback((draft: Draft, template: Template) => {
    const slots = extractSlots(template);
    
    const capturedImages: CapturedImages = {};
    const slotStates: SlotStates = {};
    
    // Initialize all slots as empty
    slots.forEach(slot => {
      slotStates[slot.layerId] = { state: 'empty' };
    });
    
    const beforeSlot = slots.find(s => s.layerId.includes('before'));
    const afterSlot = slots.find(s => s.layerId.includes('after'));
    
    // Step 1: Load from legacy before/after fields first (as fallback for old drafts)
    if (draft.beforeImageUrl && beforeSlot) {
      capturedImages[beforeSlot.layerId] = {
        uri: draft.beforeImageUrl,
        width: beforeSlot.width,
        height: beforeSlot.height,
      };
      slotStates[beforeSlot.layerId] = { state: 'ready' };
    }
    
    if (draft.afterImageUrl && afterSlot) {
      capturedImages[afterSlot.layerId] = {
        uri: draft.afterImageUrl,
        width: afterSlot.width,
        height: afterSlot.height,
      };
      slotStates[afterSlot.layerId] = { state: 'ready' };
    }
    
    // Step 2: Load from capturedImageUrls (overrides legacy fields for newer drafts)
    // This ensures the most recent saved data takes precedence
    // BUG: Adjustments are NOT stored in the database, so they're lost when loading!
    if (draft.capturedImageUrls) {
      for (const [layerId, url] of Object.entries(draft.capturedImageUrls)) {
        const slot = slots.find(s => s.layerId === layerId);
        if (slot && url) {
          capturedImages[layerId] = {
            uri: url,
            width: slot.width,
            height: slot.height,
            // MISSING: No adjustments loaded! They were never saved.
          };
          slotStates[layerId] = { state: 'ready' };
        }
      }
    }
    
    // Derive beforeMedia and afterMedia from the loaded capturedImages
    const beforeMedia = beforeSlot && capturedImages[beforeSlot.layerId] ? {
      uri: capturedImages[beforeSlot.layerId].uri,
      width: beforeSlot.width,
      height: beforeSlot.height,
    } : null;
    
    const afterMedia = afterSlot && capturedImages[afterSlot.layerId] ? {
      uri: capturedImages[afterSlot.layerId].uri,
      width: afterSlot.width,
      height: afterSlot.height,
    } : null;
    
    setSlotStatesMap(slotStates);
    setComposedPreviewUri(null);
    
    setCurrentProject({
      contentType: 'single',
      template,
      capturedImages,
      beforeMedia,
      afterMedia,
      draftId: draft.id,
      cachedPreviewUrl: draft.renderedPreviewUrl || null,
      wasRenderedAsPremium: draft.wasRenderedAsPremium ?? null,
      localPreviewPath: draft.localPreviewPath || null,
    });
  }, []);

  // Refresh drafts - simply delegates to the realtime hook's refetch
  const refreshDrafts = useCallback(async () => {
    await refetchDrafts();
  }, [refetchDrafts]);

  // Refresh portfolio
  const refreshPortfolio = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['portfolio'] });
  }, [queryClient]);

  return {
    // Templates (with real-time updates)
    templates,
    filteredTemplates,
    favouriteTemplates,
    templatesError,
    refetchTemplates,
    
    // Legacy portfolio state (kept for backwards compatibility)
    legacyPortfolio,
    
    // Portfolio state (new)
    portfolio,
    isPortfolioLoading: portfolioQuery.isLoading,
    
    // Drafts - single source of truth from realtime hook
    drafts: realtimeDrafts,
    isDraftsLoading,
    
    // Other state
    brandKit,
    currentProject,
    selectedFormat,
    isLoading: isTemplatesLoading || legacyPortfolioQuery.isLoading,
    
    // Slot state management
    slotStates,
    setSlotState,
    composedPreviewUri,
    setComposedPreviewUri,
    isComposing,
    setIsComposing,
    
    // Actions
    toggleFavourite,
    saveToLegacyPortfolio: (asset: SavedAsset) => saveToLegacyPortfolioMutation.mutate(asset),
    deleteFromLegacyPortfolio: (id: string) => deleteFromLegacyPortfolioMutation.mutate(id),
    updateBrandKit: (updates: Partial<BrandKit>) => updateBrandKitMutation.mutate(updates),
    setContentType,
    setFormat,
    selectTemplate,
    selectTemplateById,
    
    // Dynamic slot actions
    setCapturedImage,
    clearCapturedImage,
    resetCapturedImages,
    
    // Legacy actions
    setBeforeMedia,
    setAfterMedia,
    resetProject,
    
    // Draft actions
    saveDraft: (params: { 
      templateId: string; 
      beforeImageUri: string | null; 
      afterImageUri: string | null;
      existingDraftId?: string;
      capturedImageUris?: Record<string, string>;
      renderedPreviewUrl?: string | null;
      wasRenderedAsPremium?: boolean;
      localPreviewPath?: string | null;
    }) => saveDraftMutation.mutateAsync(params),
    deleteDraft: (draftId: string) => deleteDraftMutation.mutateAsync(draftId),
    duplicateDraft: (draftId: string) => duplicateDraftMutation.mutateAsync(draftId),
    loadDraft,
    refreshDrafts,
    isSavingDraft: saveDraftMutation.isPending,
    isDuplicatingDraft: duplicateDraftMutation.isPending,
    
    // Portfolio actions
    addToPortfolio: (item: Omit<PortfolioItem, 'id' | 'createdAt'>) => addToPortfolioMutation.mutateAsync(item),
    deleteFromPortfolio: (id: string) => deleteFromPortfolioMutation.mutateAsync(id),
    refreshPortfolio,
  };
});
