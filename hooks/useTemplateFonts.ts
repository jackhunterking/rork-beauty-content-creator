/**
 * useTemplateFonts Hook
 * 
 * UNIFIED FONT LOADING (Jan 2026):
 * Loads fonts from ANY source based on the Supabase font registry:
 * - Google Fonts (via Google Fonts Developer API)
 * - Supabase Storage (for custom uploaded fonts)
 * - System fonts (no loading needed)
 * 
 * This allows templates to use ANY font - including custom fonts
 * uploaded to Templated.io that aren't available in Google Fonts.
 * 
 * Usage:
 *   const { fontsLoaded, failedFonts } = useTemplateFonts(['Sacco-SemiBoldCondensed', 'Poppins']);
 * 
 * The hook will:
 * 1. Check the font registry to determine each font's source
 * 2. Load Google Fonts via Google Fonts API
 * 3. Load custom fonts from Supabase Storage
 * 4. Skip system fonts (already available)
 * 5. Return loading state and any failures
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useFontContext } from '@/contexts/FontContext';
import { loadFonts, isFontLoaded, FontLoadResult } from '@/services/unifiedFontService';
import { prewarmFontCatalog } from '@/services/googleFontsService';

// ============================================
// Types
// ============================================

export interface UseTemplateFontsResult {
  fontsLoaded: boolean;
  isLoading: boolean;
  failedFonts: string[];
  results: FontLoadResult[];
}

// System fonts that don't need loading
const SYSTEM_FONTS = new Set([
  'System',
  'system',
  'San Francisco',
  'Helvetica',
  'Helvetica Neue',
  'Arial',
  // Android system fonts
  'Roboto',
  'sans-serif',
  'serif',
  'monospace',
]);

// ============================================
// Hook
// ============================================

/**
 * Hook to load fonts used in a template
 * 
 * @param fontFamilies - Array of font family names to load
 * @returns Object with fontsLoaded state, loading state, and any failed fonts
 */
export function useTemplateFonts(fontFamilies: string[]): boolean {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [failedFonts, setFailedFonts] = useState<string[]>([]);
  const loadingRef = useRef(false);
  
  // Get font registry from context
  const { fontsByFamily, isLoading: registryLoading } = useFontContext();
  
  // Filter out system fonts and empty values
  const fontsToLoad = useMemo(() => {
    return fontFamilies.filter(f => f && f.trim() && !SYSTEM_FONTS.has(f));
  }, [fontFamilies]);
  
  // Create a stable key for the fonts array
  const fontsKey = useMemo(() => {
    return [...new Set(fontsToLoad)].sort().join(',');
  }, [fontsToLoad]);
  
  useEffect(() => {
    // Wait for registry to load
    if (registryLoading) {
      return;
    }
    
    // No custom fonts needed
    if (fontsToLoad.length === 0) {
      setFontsLoaded(true);
      setFailedFonts([]);
      return;
    }
    
    // Skip if already loading
    if (loadingRef.current) return;
    
    // Check if all fonts are already loaded
    const allLoaded = fontsToLoad.every(f => isFontLoaded(f));
    if (allLoaded) {
      console.log(`[useTemplateFonts] All ${fontsToLoad.length} fonts already loaded`);
      setFontsLoaded(true);
      setFailedFonts([]);
      return;
    }
    
    loadingRef.current = true;
    setFontsLoaded(false);
    
    // Log what we're loading and from where
    fontsToLoad.forEach(fontFamily => {
      const fontInfo = fontsByFamily.get(fontFamily.toLowerCase());
      if (fontInfo) {
        console.log(`[useTemplateFonts] ${fontFamily} → ${fontInfo.source}${fontInfo.source === 'supabase' ? (fontInfo.isActive ? ' (active)' : ' (inactive - needs upload)') : ''}`);
      } else {
        console.log(`[useTemplateFonts] ${fontFamily} → not in registry, will try Google Fonts`);
      }
    });
    
    // Load all fonts using unified service
    loadFonts(fontsToLoad, fontsByFamily)
      .then(results => {
        const successCount = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).map(r => r.fontFamily);
        
        console.log(`[useTemplateFonts] Loaded ${successCount}/${fontsToLoad.length} fonts`);
        
        if (failed.length > 0) {
          console.warn(`[useTemplateFonts] Failed to load:`, failed);
        }
        
        setFailedFonts(failed);
        setFontsLoaded(true);
      })
      .catch(error => {
        console.error('[useTemplateFonts] Error loading fonts:', error);
        setFailedFonts(fontsToLoad);
        setFontsLoaded(true); // Continue rendering even if fonts failed
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [fontsKey, fontsByFamily, registryLoading, fontsToLoad]);
  
  return fontsLoaded;
}

/**
 * Extended hook that returns more details about font loading
 */
export function useTemplateFontsDetailed(fontFamilies: string[]): UseTemplateFontsResult {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failedFonts, setFailedFonts] = useState<string[]>([]);
  const [results, setResults] = useState<FontLoadResult[]>([]);
  const loadingRef = useRef(false);
  
  const { fontsByFamily, isLoading: registryLoading } = useFontContext();
  
  const fontsToLoad = useMemo(() => {
    return fontFamilies.filter(f => f && f.trim() && !SYSTEM_FONTS.has(f));
  }, [fontFamilies]);
  
  const fontsKey = useMemo(() => {
    return [...new Set(fontsToLoad)].sort().join(',');
  }, [fontsToLoad]);
  
  useEffect(() => {
    if (registryLoading) {
      setIsLoading(true);
      return;
    }
    
    if (fontsToLoad.length === 0) {
      setFontsLoaded(true);
      setIsLoading(false);
      setFailedFonts([]);
      setResults([]);
      return;
    }
    
    if (loadingRef.current) return;
    
    const allLoaded = fontsToLoad.every(f => isFontLoaded(f));
    if (allLoaded) {
      setFontsLoaded(true);
      setIsLoading(false);
      setFailedFonts([]);
      return;
    }
    
    loadingRef.current = true;
    setIsLoading(true);
    setFontsLoaded(false);
    
    loadFonts(fontsToLoad, fontsByFamily)
      .then(loadResults => {
        const failed = loadResults.filter(r => !r.success).map(r => r.fontFamily);
        setResults(loadResults);
        setFailedFonts(failed);
        setFontsLoaded(true);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('[useTemplateFonts] Error:', error);
        setFailedFonts(fontsToLoad);
        setFontsLoaded(true);
        setIsLoading(false);
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [fontsKey, fontsByFamily, registryLoading, fontsToLoad]);
  
  return { fontsLoaded, isLoading, failedFonts, results };
}

/**
 * Preload the font catalog early in app lifecycle
 * Call this from _layout.tsx or similar
 */
export async function preloadFontCatalog(): Promise<void> {
  return prewarmFontCatalog();
}

export default useTemplateFonts;
