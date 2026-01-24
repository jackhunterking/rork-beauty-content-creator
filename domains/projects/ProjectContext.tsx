/**
 * Project Context
 * 
 * Manages drafts/projects and portfolio state with realtime updates.
 * This is the single source of truth for all project-related data.
 */

import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Draft, PortfolioItem, BrandKit, Template } from '@/types';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRealtimeDrafts } from '@/hooks/useRealtimeDrafts';
import { 
  saveDraftWithImages, 
  deleteDraft as deleteDraftService, 
  duplicateDraft as duplicateDraftService, 
  renameDraft as renameDraftService,
  fetchDraftById,
} from '@/services/draftService';
import { 
  fetchPortfolioItems, 
  createPortfolioItem, 
  deletePortfolioItem as deletePortfolioItemService 
} from '@/services/portfolioService';
import { extractSlots } from '@/utils/slotParser';
import { CapturedSlots, SlotData, AIFeatureKey } from '@/domains/editor/types';

const STORAGE_KEYS = {
  BRAND_KIT: 'resulta_brand_kit',
};

export const [ProjectProvider, useProjects] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthContext();

  // ============================================
  // Drafts - Real-time from Supabase
  // ============================================
  
  const {
    drafts,
    isLoading: isDraftsLoading,
    refetch: refetchDrafts,
  } = useRealtimeDrafts(isAuthenticated);

  // ============================================
  // Portfolio - Query from Supabase
  // ============================================
  
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  
  const portfolioQuery = useQuery({
    queryKey: ['portfolio'],
    queryFn: fetchPortfolioItems,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (portfolioQuery.data) {
      setPortfolio(portfolioQuery.data);
    }
  }, [portfolioQuery.data]);

  // ============================================
  // Brand Kit - Local storage
  // ============================================
  
  const [brandKit, setBrandKit] = useState<BrandKit>({
    applyLogoAutomatically: false,
    addDisclaimer: false,
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

  useEffect(() => {
    if (brandKitQuery.data) setBrandKit(brandKitQuery.data);
  }, [brandKitQuery.data]);

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

  // ============================================
  // Draft Mutations
  // ============================================
  
  const saveDraftMutation = useMutation({
    mutationFn: async (params: { 
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
        params.templateId,
        params.beforeImageUri,
        params.afterImageUri,
        params.existingDraftId,
        params.capturedImageUris,
        params.renderedPreviewUrl,
        params.wasRenderedAsPremium,
        params.localPreviewPath,
        params.projectName,
        params.backgroundOverrides,
        params.capturedImageAdjustments,
        params.themeColor,
        params.capturedImageBackgroundInfo,
        params.canvasBackgroundColor
      );
    },
    onSuccess: async (savedDraft) => {
      await refetchDrafts();
      return savedDraft;
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      await deleteDraftService(draftId);
      return draftId;
    },
    onSuccess: async () => {
      await refetchDrafts();
    },
  });

  const duplicateDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      return duplicateDraftService(draftId);
    },
    onSuccess: async () => {
      await refetchDrafts();
    },
  });

  const renameDraftMutation = useMutation({
    mutationFn: async ({ draftId, projectName }: { draftId: string; projectName: string | null }) => {
      return renameDraftService(draftId, projectName);
    },
    onSuccess: async () => {
      await refetchDrafts();
    },
  });

  // ============================================
  // Portfolio Mutations
  // ============================================
  
  const addToPortfolioMutation = useMutation({
    mutationFn: async (item: Omit<PortfolioItem, 'id' | 'createdAt' | 'userId'>) => {
      return createPortfolioItem(item);
    },
    onSuccess: async (newItem) => {
      setPortfolio(prev => [newItem, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  const deleteFromPortfolioMutation = useMutation({
    mutationFn: async (id: string) => {
      await deletePortfolioItemService(id);
      return id;
    },
    onSuccess: (deletedId) => {
      setPortfolio(prev => prev.filter(item => item.id !== deletedId));
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });

  // ============================================
  // Load Draft - Converts draft to editor state (CapturedSlots format)
  // ============================================
  
  const loadDraft = useCallback(async (
    draft: Draft, 
    allTemplates: Template[]
  ): Promise<{
    template: Template | null;
    capturedImages: CapturedSlots;
  } | null> => {
    const template = allTemplates.find(t => t.id === draft.templateId);
    if (!template) {
      console.error('[ProjectContext] Template not found for draft:', draft.templateId);
      return null;
    }

    // Extract slots from the template
    const slots = extractSlots(template);
    const beforeSlot = slots.find(s => s.layerId.includes('before'));
    const afterSlot = slots.find(s => s.layerId.includes('after'));

    const capturedSlots: CapturedSlots = {};

    // Helper to create SlotData from draft data
    const createSlotDataFromDraft = (
      uri: string,
      width: number,
      height: number,
      adjustments?: { scale: number; translateX: number; translateY: number; rotation?: number },
      backgroundInfo?: { type: 'solid' | 'gradient' | 'transparent'; solidColor?: string; gradient?: any }
    ): SlotData => {
      // Determine AI enhancements based on saved data
      const inferredEnhancements: AIFeatureKey[] = [];
      if (backgroundInfo?.type === 'transparent') {
        inferredEnhancements.push('background_remove');
      } else if (backgroundInfo?.type === 'solid' || backgroundInfo?.type === 'gradient') {
        inferredEnhancements.push('background_replace');
      }

      return {
        uri,
        width,
        height,
        adjustments: adjustments || { scale: 1, translateX: 0, translateY: 0, rotation: 0 },
        ai: {
          originalUri: uri,
          enhancementsApplied: inferredEnhancements,
          transparentPngUrl: backgroundInfo ? uri : undefined,
          backgroundInfo,
        },
      };
    };

    // Load from legacy before/after fields first (as fallback for old drafts)
    if (draft.beforeImageUrl && beforeSlot) {
      capturedSlots[beforeSlot.layerId] = createSlotDataFromDraft(
        draft.beforeImageUrl,
        beforeSlot.width,
        beforeSlot.height
      );
    }
    
    if (draft.afterImageUrl && afterSlot) {
      capturedSlots[afterSlot.layerId] = createSlotDataFromDraft(
        draft.afterImageUrl,
        afterSlot.width,
        afterSlot.height
      );
    }

    // Load from capturedImageUrls (overrides legacy fields for newer drafts)
    if (draft.capturedImageUrls) {
      for (const [layerId, uri] of Object.entries(draft.capturedImageUrls)) {
        if (uri) {
          const slot = slots.find(s => s.layerId === layerId);
          if (slot) {
            const adjustments = draft.capturedImageAdjustments?.[layerId];
            const backgroundInfo = draft.capturedImageBackgroundInfo?.[layerId];
            
            capturedSlots[layerId] = createSlotDataFromDraft(
              uri,
              slot.width,
              slot.height,
              adjustments,
              backgroundInfo
            );
          }
        }
      }
    }

    return { template, capturedImages: capturedSlots };
  }, []);

  // Direct draft fetch by ID (bypasses realtime cache)
  const getDraftById = useCallback(async (draftId: string): Promise<Draft | null> => {
    return fetchDraftById(draftId);
  }, []);

  // ============================================
  // Refresh functions
  // ============================================
  
  const refreshPortfolio = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['portfolio'] });
  }, [queryClient]);

  // ============================================
  // Return context value
  // ============================================
  
  return {
    // Drafts
    drafts,
    isDraftsLoading,
    refreshDrafts: refetchDrafts,
    
    // Draft actions
    saveDraft: (params: Parameters<typeof saveDraftMutation.mutateAsync>[0]) => 
      saveDraftMutation.mutateAsync(params),
    deleteDraft: (draftId: string) => deleteDraftMutation.mutateAsync(draftId),
    duplicateDraft: (draftId: string) => duplicateDraftMutation.mutateAsync(draftId),
    renameDraft: (draftId: string, projectName: string | null) => 
      renameDraftMutation.mutateAsync({ draftId, projectName }),
    loadDraft,
    getDraftById,
    
    // Mutation states
    isSavingDraft: saveDraftMutation.isPending,
    isDuplicatingDraft: duplicateDraftMutation.isPending,
    isRenamingDraft: renameDraftMutation.isPending,
    
    // Portfolio
    portfolio,
    isPortfolioLoading: portfolioQuery.isLoading,
    refreshPortfolio,
    
    // Portfolio actions
    addToPortfolio: (item: Omit<PortfolioItem, 'id' | 'createdAt' | 'userId'>) => 
      addToPortfolioMutation.mutateAsync(item),
    deleteFromPortfolio: (id: string) => deleteFromPortfolioMutation.mutateAsync(id),
    
    // Brand Kit
    brandKit,
    updateBrandKit: (updates: Partial<BrandKit>) => updateBrandKitMutation.mutate(updates),
  };
});
