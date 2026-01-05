import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Theme, SavedAsset, BrandKit, ContentType, MediaAsset } from '@/types';
import { mockThemes } from '@/mocks/themes';

const STORAGE_KEYS = {
  THEMES: 'beauty_themes',
  LIBRARY: 'beauty_library',
  CREDITS: 'beauty_credits',
  BRAND_KIT: 'beauty_brand_kit',
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  
  const [themes, setThemes] = useState<Theme[]>(mockThemes);
  const [library, setLibrary] = useState<SavedAsset[]>([]);
  const [credits, setCredits] = useState<number>(50);
  const [brandKit, setBrandKit] = useState<BrandKit>({
    applyLogoAutomatically: false,
    addDisclaimer: false,
  });

  const [currentProject, setCurrentProject] = useState<{
    contentType: ContentType;
    themeId: string | null;
    beforeMedia: MediaAsset | null;
    afterMedia: MediaAsset | null;
  }>({
    contentType: 'single',
    themeId: null,
    beforeMedia: null,
    afterMedia: null,
  });

  const themesQuery = useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.THEMES);
      if (stored) {
        return JSON.parse(stored) as Theme[];
      }
      await AsyncStorage.setItem(STORAGE_KEYS.THEMES, JSON.stringify(mockThemes));
      return mockThemes;
    },
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
    if (themesQuery.data) setThemes(themesQuery.data);
  }, [themesQuery.data]);

  useEffect(() => {
    if (libraryQuery.data) setLibrary(libraryQuery.data);
  }, [libraryQuery.data]);

  useEffect(() => {
    if (creditsQuery.data !== undefined) setCredits(creditsQuery.data);
  }, [creditsQuery.data]);

  useEffect(() => {
    if (brandKitQuery.data) setBrandKit(brandKitQuery.data);
  }, [brandKitQuery.data]);

  const toggleFavouriteMutation = useMutation({
    mutationFn: async (themeId: string) => {
      const updated = themes.map(t => 
        t.id === themeId ? { ...t, isFavourite: !t.isFavourite } : t
      );
      await AsyncStorage.setItem(STORAGE_KEYS.THEMES, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setThemes(data);
      queryClient.invalidateQueries({ queryKey: ['themes'] });
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

  const favouriteThemes = useMemo(() => 
    themes.filter(t => t.isFavourite), 
    [themes]
  );

  const setContentType = useCallback((type: ContentType) => {
    setCurrentProject(prev => ({ ...prev, contentType: type }));
  }, []);

  const selectTheme = useCallback((themeId: string) => {
    setCurrentProject(prev => ({ ...prev, themeId }));
  }, []);

  const setBeforeMedia = useCallback((media: MediaAsset | null) => {
    setCurrentProject(prev => ({ ...prev, beforeMedia: media }));
  }, []);

  const setAfterMedia = useCallback((media: MediaAsset | null) => {
    setCurrentProject(prev => ({ ...prev, afterMedia: media }));
  }, []);

  const resetProject = useCallback(() => {
    setCurrentProject({
      contentType: 'single',
      themeId: null,
      beforeMedia: null,
      afterMedia: null,
    });
  }, []);

  const getCreditCost = useCallback(() => {
    return currentProject.contentType === 'carousel' ? 3 : 1;
  }, [currentProject.contentType]);

  return {
    themes,
    favouriteThemes,
    library,
    credits,
    brandKit,
    currentProject,
    isLoading: themesQuery.isLoading || libraryQuery.isLoading,
    toggleFavourite: (id: string) => toggleFavouriteMutation.mutate(id),
    saveToLibrary: (asset: SavedAsset) => saveToLibraryMutation.mutate(asset),
    deleteFromLibrary: (id: string) => deleteFromLibraryMutation.mutate(id),
    spendCredits: (amount: number) => spendCreditsMutation.mutate(amount),
    updateBrandKit: (updates: Partial<BrandKit>) => updateBrandKitMutation.mutate(updates),
    setContentType,
    selectTheme,
    setBeforeMedia,
    setAfterMedia,
    resetProject,
    getCreditCost,
  };
});
