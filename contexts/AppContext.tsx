import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Template, BrandKit, ContentType, MediaAsset, Draft, TemplateFormat, CapturedImages, SlotStates, SlotState, PortfolioItem } from '@/types';
import { toggleTemplateFavourite } from '@/services/templateService';
import { deleteDraft as deleteDraftService, saveDraftWithImages, duplicateDraft as duplicateDraftService, renameDraft as renameDraftService } from '@/services/draftService';
import { fetchPortfolioItems, createPortfolioItem, deletePortfolioItem as deletePortfolioItemService } from '@/services/portfolioService';
import { useRealtimeTemplates, optimisticUpdateTemplate } from '@/hooks/useRealtimeTemplates';
import { useRealtimeDrafts } from '@/hooks/useRealtimeDrafts';
import { extractSlots } from '@/utils/slotParser';
import { initializeLocalStorage } from '@/services/localStorageService';
import { useAuthContext } from '@/contexts/AuthContext';
import { getDefaultFormat } from '@/constants/formats';
import { cleanupCapturedImages, getCurrentSessionId, resetSession, generateSessionId } from '@/domains/shared';

const STORAGE_KEYS = {
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
    draftId: string | null;
    cachedPreviewUrl: string | null;
    wasRenderedAsPremium: boolean | null;
    localPreviewPath: string | null;
    projectName: string | null;
    backgroundOverrides: Record<string, string>;
    themeColor: string | null;
    canvasBackgroundColor: string | null;
  }>({
    contentType: 'single',
    template: null,
    capturedImages: {},
    draftId: null,
    cachedPreviewUrl: null,
    wasRenderedAsPremium: null,
    localPreviewPath: null,
    projectName: null,
    backgroundOverrides: {},
    themeColor: null,
    canvasBackgroundColor: null,
  });

  // Initialize local storage on app start
  useEffect(() => {
    initializeLocalStorage().catch(console.error);
  }, []);

  // Sync real-time templates to local state
  useEffect(() => {
    setTemplates(realtimeTemplates);
  }, [realtimeTemplates]);


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
      projectName,
      backgroundOverrides,
      capturedImageAdjustments,
      themeColor,
      capturedImageBackgroundInfo,
      canvasBackgroundColor,
    }: { 
      templateId: string; 
      beforeImageUri: string | null; 
      afterImageUri: string | null;
      existingDraftId?: string;
      capturedImageUris?: Record<string, string>;
      renderedPreviewUrl?: string | null;
      wasRenderedAsPremium?: boolean;
      localPreviewPath?: string | null;
      projectName?: string | null;
      backgroundOverrides?: Record<string, string> | null;
      capturedImageAdjustments?: Record<string, { scale: number; translateX: number; translateY: number; rotation: number }> | null;
      themeColor?: string | null;
      capturedImageBackgroundInfo?: Record<string, {
        type: 'solid' | 'gradient' | 'transparent';
        solidColor?: string;
        gradient?: {
          type: 'linear';
          colors: [string, string];
          direction: 'vertical' | 'horizontal' | 'diagonal-tl' | 'diagonal-tr';
        };
      }> | null;
      canvasBackgroundColor?: string | null;
    }) => {
      return saveDraftWithImages(
        templateId, 
        beforeImageUri, 
        afterImageUri, 
        existingDraftId,
        capturedImageUris,
        renderedPreviewUrl,
        wasRenderedAsPremium,
        localPreviewPath,
        projectName,
        backgroundOverrides,
        capturedImageAdjustments,
        themeColor,
        capturedImageBackgroundInfo,
        canvasBackgroundColor
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
        projectName: savedDraft.projectName || null,
        backgroundOverrides: savedDraft.backgroundOverrides || {},
        themeColor: savedDraft.themeColor || null,
        canvasBackgroundColor: savedDraft.canvasBackgroundColor || null,
      }));
      // Note: No manual cache updates needed - useRealtimeDrafts will receive
      // the INSERT/UPDATE event from Supabase and update automatically
    },
  });

  // Delete draft mutation with optimistic update
  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      await deleteDraftService(draftId);
      return draftId;
    },
    onSuccess: () => {
      // Immediately refresh drafts to reflect the deletion
      // This ensures instant UI feedback without waiting for real-time events
      refetchDrafts();
    },
  });

  // Duplicate draft mutation with optimistic update
  const duplicateDraftMutation = useMutation({
    mutationFn: async (sourceDraftId: string) => {
      return duplicateDraftService(sourceDraftId);
    },
    onSuccess: () => {
      // Immediately refresh drafts to include the newly duplicated draft
      // This ensures instant UI feedback without waiting for real-time events
      refetchDrafts();
    },
  });

  // Rename draft mutation with optimistic update
  const renameDraftMutation = useMutation({
    mutationFn: async ({ draftId, projectName }: { draftId: string; projectName: string | null }) => {
      return renameDraftService(draftId, projectName);
    },
    onSuccess: (renamedDraft) => {
      // Update current project if this is the active draft
      if (currentProject.draftId === renamedDraft.id) {
        setCurrentProject(prev => ({
          ...prev,
          projectName: renamedDraft.projectName || null,
        }));
      }
      // Immediately refresh drafts to reflect the name change
      // This ensures instant UI feedback without waiting for real-time events
      refetchDrafts();
    },
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
    
    // Generate a new upload session for this project
    // This groups all captured images for cleanup if the project is discarded
    generateSessionId();
    
    setCurrentProject(prev => ({ 
      ...prev, 
      template,
      capturedImages: {},
      draftId: null,
      cachedPreviewUrl: null,
      wasRenderedAsPremium: null,
      localPreviewPath: null,
      projectName: null,
      backgroundOverrides: {},
      themeColor: null,
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

  /**
   * Helper to detect if a URI is from Fal.AI (AI enhancement output)
   */
  const isFalAIOutputUrl = (uri: string): boolean => {
    return uri.includes('fal.media') || uri.includes('fal-cdn.com');
  };

  /**
   * Set captured image for a slot.
   * Handles AI enhancement tracking:
   * - If the new image is an AI-enhanced version (Fal.AI URL), preserve enhancement tracking
   * - If it's a new capture/upload (local file or different URL), reset enhancement tracking
   */
  const setCapturedImage = useCallback((layerId: string, media: MediaAsset | null) => {
    setCurrentProject(prev => {
      const existingMedia = prev.capturedImages[layerId];
      
      // If setting to null, just clear the slot
      if (!media) {
        return {
          ...prev,
          capturedImages: {
            ...prev.capturedImages,
            [layerId]: null,
          },
        };
      }
      
      // Determine if this is an AI enhancement or a new image
      const isAIEnhancement = isFalAIOutputUrl(media.uri);
      
      let updatedMedia: MediaAsset;
      
      if (isAIEnhancement && existingMedia) {
        // This is an AI enhancement - preserve existing tracking and originalUri
        // The specific feature will be added by the caller (editor onApply)
        updatedMedia = {
          ...media,
          aiEnhancementsApplied: media.aiEnhancementsApplied ?? existingMedia.aiEnhancementsApplied ?? [],
          originalUri: media.originalUri ?? existingMedia.originalUri ?? existingMedia.uri,
        };
      } else {
        // This is a new capture/upload - reset enhancement tracking
        updatedMedia = {
          ...media,
          aiEnhancementsApplied: [],
          originalUri: media.uri,
        };
      }
      
      return {
        ...prev,
        capturedImages: {
          ...prev.capturedImages,
          [layerId]: updatedMedia,
        },
      };
    });
    
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

  const resetProject = useCallback((wasSaved: boolean = false) => {
    // If project was NOT saved, cleanup any temp-uploads from this session
    // This prevents orphaned files in Supabase storage
    if (!wasSaved) {
      const sessionId = getCurrentSessionId();
      if (sessionId) {
        // Fire and forget - don't block the reset
        cleanupCapturedImages(sessionId).catch(() => {
          // Silent failure
        });
      }
    } else {
      // Project was saved - just reset the session without cleanup
      // (temp files become permanent draft images)
      resetSession();
    }
    
    setCurrentProject({
      contentType: 'single',
      template: null,
      capturedImages: {},
      draftId: null,
      cachedPreviewUrl: null,
      wasRenderedAsPremium: null,
      localPreviewPath: null,
      projectName: null,
      backgroundOverrides: {},
      themeColor: null,
      canvasBackgroundColor: null,
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
    if (draft.capturedImageUrls) {
      for (const [layerId, url] of Object.entries(draft.capturedImageUrls)) {
        const slot = slots.find(s => s.layerId === layerId);
        if (slot && url) {
          // Also restore adjustments and backgroundInfo if they were saved
          const adjustments = draft.capturedImageAdjustments?.[layerId];
          const backgroundInfo = draft.capturedImageBackgroundInfo?.[layerId];
          
          // When loading with backgroundInfo, infer the transparent state
          // Key insight: If backgroundInfo exists, the uri IS the transparent PNG
          const inferredTransparentUrl = backgroundInfo ? url : undefined;
          const inferredEnhancements = backgroundInfo ? ['background_replace'] as const : [];
          
          capturedImages[layerId] = {
            uri: url,
            width: slot.width,
            height: slot.height,
            adjustments: adjustments || undefined,
            backgroundInfo: backgroundInfo || undefined,
            // If backgroundInfo exists, uri IS the transparent PNG - cache it for color changes
            transparentPngUrl: inferredTransparentUrl,
            // Mark as enhanced so "Already applied" badge shows correctly
            aiEnhancementsApplied: [...inferredEnhancements],
          };
          slotStates[layerId] = { state: 'ready' };
        }
      }
    }
    
    setSlotStatesMap(slotStates);
    setComposedPreviewUri(null);
    
    setCurrentProject({
      contentType: 'single',
      template,
      capturedImages,
      draftId: draft.id,
      cachedPreviewUrl: draft.renderedPreviewUrl || null,
      wasRenderedAsPremium: draft.wasRenderedAsPremium ?? null,
      localPreviewPath: draft.localPreviewPath || null,
      projectName: draft.projectName || null,
      backgroundOverrides: draft.backgroundOverrides || {},
      themeColor: draft.themeColor || null,
      canvasBackgroundColor: draft.canvasBackgroundColor || null,
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
    
    // Portfolio state
    portfolio,
    isPortfolioLoading: portfolioQuery.isLoading,
    
    // Drafts - single source of truth from realtime hook
    drafts: realtimeDrafts,
    isDraftsLoading,
    
    // Other state
    brandKit,
    currentProject,
    selectedFormat,
    isLoading: isTemplatesLoading,
    
    // Slot state management
    slotStates,
    setSlotState,
    composedPreviewUri,
    setComposedPreviewUri,
    isComposing,
    setIsComposing,
    
    // Actions
    toggleFavourite,
    updateBrandKit: (updates: Partial<BrandKit>) => updateBrandKitMutation.mutate(updates),
    setContentType,
    setFormat,
    selectTemplate,
    selectTemplateById,
    
    // Dynamic slot actions
    setCapturedImage,
    clearCapturedImage,
    resetCapturedImages,
    
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
      projectName?: string | null;
      backgroundOverrides?: Record<string, string> | null;
      capturedImageAdjustments?: Record<string, { scale: number; translateX: number; translateY: number; rotation: number }> | null;
      themeColor?: string | null;
      capturedImageBackgroundInfo?: Record<string, {
        type: 'solid' | 'gradient' | 'transparent';
        solidColor?: string;
        gradient?: {
          type: 'linear';
          colors: [string, string];
          direction: 'vertical' | 'horizontal' | 'diagonal-tl' | 'diagonal-tr';
        };
      }> | null;
      canvasBackgroundColor?: string | null;
    }) => saveDraftMutation.mutateAsync(params),
    deleteDraft: (draftId: string) => deleteDraftMutation.mutateAsync(draftId),
    duplicateDraft: (draftId: string) => duplicateDraftMutation.mutateAsync(draftId),
    renameDraft: (draftId: string, projectName: string | null) => renameDraftMutation.mutateAsync({ draftId, projectName }),
    loadDraft,
    refreshDrafts,
    isSavingDraft: saveDraftMutation.isPending,
    isDuplicatingDraft: duplicateDraftMutation.isPending,
    isRenamingDraft: renameDraftMutation.isPending,
    
    // Portfolio actions
    addToPortfolio: (item: Omit<PortfolioItem, 'id' | 'createdAt'>) => addToPortfolioMutation.mutateAsync(item),
    deleteFromPortfolio: (id: string) => deleteFromPortfolioMutation.mutateAsync(id),
    refreshPortfolio,
  };
});
