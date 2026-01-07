import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Template, SavedAsset, BrandKit, ContentType, MediaAsset } from '@/types';
import { fetchTemplates, toggleTemplateFavourite } from '@/services/templateService';

const STORAGE_KEYS = {
  LIBRARY: 'beauty_library',
  CREDITS: 'beauty_credits',
  BRAND_KIT: 'beauty_brand_kit',
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [library, setLibrary] = useState<SavedAsset[]>([]);
  const [credits, setCredits] = useState<number>(50);
  const [brandKit, setBrandKit] = useState<BrandKit>({
    applyLogoAutomatically: false,
    addDisclaimer: false,
  });

  // Current project now stores the full template object instead of just themeId
  const [currentProject, setCurrentProject] = useState<{
    contentType: ContentType;
    template: Template | null;
    beforeMedia: MediaAsset | null;
    afterMedia: MediaAsset | null;
  }>({
    contentType: 'single',
    template: null,
    beforeMedia: null,
    afterMedia: null,
  });

  // Fetch templates from Supabase
  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const libraryQuery = useQuery({
    queryKey: ['library'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LIBRARY);
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

  useEffect(() => {
    if (templatesQuery.data) setTemplates(templatesQuery.data);
  }, [templatesQuery.data]);

  useEffect(() => {
    if (libraryQuery.data) setLibrary(libraryQuery.data);
  }, [libraryQuery.data]);

  useEffect(() => {
    if (creditsQuery.data !== undefined) setCredits(creditsQuery.data);
  }, [creditsQuery.data]);

  useEffect(() => {
    if (brandKitQuery.data) setBrandKit(brandKitQuery.data);
  }, [brandKitQuery.data]);

  // Toggle favourite - updates both Supabase and local state
  const toggleFavouriteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const template = templates.find(t => t.id === templateId);
      if (!template) throw new Error('Template not found');
      
      const newFavouriteState = !template.isFavourite;
      await toggleTemplateFavourite(templateId, newFavouriteState);
      
      return templates.map(t => 
        t.id === templateId ? { ...t, isFavourite: newFavouriteState } : t
      );
    },
    onSuccess: (data) => {
      setTemplates(data);
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const saveToLibraryMutation = useMutation({
    mutationFn: async (asset: SavedAsset) => {
      const updated = [asset, ...library];
      await AsyncStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setLibrary(data);
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });

  const deleteFromLibraryMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const updated = library.filter(a => a.id !== assetId);
      await AsyncStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setLibrary(data);
      queryClient.invalidateQueries({ queryKey: ['library'] });
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

  const favouriteTemplates = useMemo(() => 
    templates.filter(t => t.isFavourite), 
    [templates]
  );

  const setContentType = useCallback((type: ContentType) => {
    setCurrentProject(prev => ({ ...prev, contentType: type }));
  }, []);

  // Select template - stores the full template object with slot specs
  const selectTemplate = useCallback((template: Template) => {
    setCurrentProject(prev => ({ ...prev, template }));
  }, []);

  // Legacy support: select by ID (finds template from list)
  const selectTemplateById = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setCurrentProject(prev => ({ ...prev, template }));
    }
  }, [templates]);

  const setBeforeMedia = useCallback((media: MediaAsset | null) => {
    setCurrentProject(prev => ({ ...prev, beforeMedia: media }));
  }, []);

  const setAfterMedia = useCallback((media: MediaAsset | null) => {
    setCurrentProject(prev => ({ ...prev, afterMedia: media }));
  }, []);

  const resetProject = useCallback(() => {
    setCurrentProject({
      contentType: 'single',
      template: null,
      beforeMedia: null,
      afterMedia: null,
    });
  }, []);

  const getCreditCost = useCallback(() => {
    return currentProject.contentType === 'carousel' ? 3 : 1;
  }, [currentProject.contentType]);

  return {
    // Templates (renamed from themes)
    templates,
    favouriteTemplates,
    
    // Other state
    library,
    credits,
    brandKit,
    currentProject,
    isLoading: templatesQuery.isLoading || libraryQuery.isLoading,
    
    // Actions
    toggleFavourite: (id: string) => toggleFavouriteMutation.mutate(id),
    saveToLibrary: (asset: SavedAsset) => saveToLibraryMutation.mutate(asset),
    deleteFromLibrary: (id: string) => deleteFromLibraryMutation.mutate(id),
    spendCredits: (amount: number) => spendCreditsMutation.mutate(amount),
    updateBrandKit: (updates: Partial<BrandKit>) => updateBrandKitMutation.mutate(updates),
    setContentType,
    selectTemplate,
    selectTemplateById,
    setBeforeMedia,
    setAfterMedia,
    resetProject,
    getCreditCost,
  };
});
