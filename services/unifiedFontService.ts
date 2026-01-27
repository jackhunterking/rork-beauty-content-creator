/**
 * Unified Font Service
 * 
 * Single entry point for loading fonts from ANY source:
 * - Google Fonts (via Google Fonts Developer API)
 * - Supabase Storage (for custom uploaded fonts)
 * - System fonts (no loading needed)
 * 
 * This service uses the font registry from Supabase to determine
 * where each font should be loaded from, ensuring pixel-perfect
 * rendering with the exact fonts used in Templated.io designs.
 */

import * as Font from 'expo-font';
import { CustomFont, FontSource } from '@/hooks/useRealtimeFonts';
import { loadGoogleFont, isFontLoaded as isGoogleFontLoaded } from './googleFontsService';

// ============================================
// Types
// ============================================

export interface FontLoadResult {
  fontFamily: string;
  source: FontSource | 'unknown';
  success: boolean;
  error?: string;
}

// ============================================
// State
// ============================================

// Track which fonts have been loaded (by any method)
const loadedFonts = new Set<string>();

// Track loading promises to avoid duplicate concurrent loads
const loadingPromises = new Map<string, Promise<FontLoadResult>>();

// ============================================
// Core Functions
// ============================================

/**
 * Check if a font is already loaded
 */
export function isFontLoaded(fontFamily: string): boolean {
  return loadedFonts.has(fontFamily.toLowerCase());
}

/**
 * Weight mapping for font weight names
 * Maps numeric weights to their string equivalents
 */
const WEIGHT_TO_SUFFIX: Record<string, string> = {
  '100': 'Thin',
  '200': 'ExtraLight',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'SemiBold',
  '700': 'Bold',
  '800': 'ExtraBold',
  '900': 'Black',
};

/**
 * Load a font from Supabase Storage with proper weight support
 * 
 * Strategy:
 * 1. Load regular weight from fileUrl
 * 2. Load bold weight from fileUrlBold if available
 * 3. If bold file not available but googleFontName is set, try Google Fonts fallback
 * 
 * @param fontInfo - Complete font info including weight-specific URLs and googleFontName
 */
async function loadSupabaseFont(fontInfo: CustomFont): Promise<boolean> {
  const { fontFamily, fileUrl, fileUrlBold, weights = ['400'], googleFontName } = fontInfo;
  
  try {
    const fontsToLoad: Record<string, string> = {};
    const needsGoogleFallback: string[] = [];
    
    // Load regular weight
    if (fileUrl) {
      fontsToLoad[fontFamily] = fileUrl;
    }
    
    // For each non-400 weight, check if we have a specific file
    for (const weight of weights) {
      if (weight === '400') continue;
      
      const weightFontName = `${fontFamily}_${weight}`;
      
      if (weight === '700' && fileUrlBold) {
        // Load bold from Supabase
        fontsToLoad[weightFontName] = fileUrlBold;
      } else {
        // Mark this weight as needing Google Fonts fallback
        needsGoogleFallback.push(weight);
      }
    }
    
    // Load Supabase fonts
    if (Object.keys(fontsToLoad).length > 0) {
      await Font.loadAsync(fontsToLoad);
    }
    
    // Try Google Fonts fallback for missing weights (using admin-configured mapping)
    if (needsGoogleFallback.length > 0 && googleFontName) {
      try {
        // Load missing weights from Google Fonts
        await loadGoogleFontWithMapping(fontFamily, googleFontName, needsGoogleFallback);
      } catch (err) {
        // Google Fonts fallback failed - font may render with default weight
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Load specific weights from Google Fonts but register under Templated font name
 * This allows using Google Fonts as a fallback for missing weight files
 */
async function loadGoogleFontWithMapping(
  templatedFontName: string,
  googleFontName: string, 
  weights: string[]
): Promise<boolean> {
  try {
    // Import dynamically to avoid circular dependency
    const { getFontInfo } = await import('./googleFontsService');
    
    const info = await getFontInfo(googleFontName);
    if (!info) {
      return false;
    }
    
    const fontsToLoad: Record<string, string> = {};
    
    for (const weight of weights) {
      const variantName = weight === '400' ? 'regular' : weight;
      const url = info.files[variantName];
      
      if (url) {
        // Register under the Templated font name with weight suffix
        const fontName = weight === '400' ? templatedFontName : `${templatedFontName}_${weight}`;
        fontsToLoad[fontName] = url.replace('http://', 'https://');
      }
    }
    
    if (Object.keys(fontsToLoad).length > 0) {
      await Font.loadAsync(fontsToLoad);
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Load a system font (no-op, just mark as loaded)
 */
function loadSystemFont(_fontFamily: string): boolean {
  return true;
}

/**
 * Load a single font using the appropriate method based on its source
 * 
 * @param fontFamily - The font family name from Templated.io
 * @param fontInfo - Font registry info (from useRealtimeFonts), or null if not in registry
 */
export async function loadFont(
  fontFamily: string,
  fontInfo: CustomFont | null
): Promise<FontLoadResult> {
  const lowerFamily = fontFamily.toLowerCase();
  
  // Already loaded?
  if (loadedFonts.has(lowerFamily)) {
    return {
      fontFamily,
      source: fontInfo?.source || 'unknown',
      success: true,
    };
  }
  
  // Already loading?
  const existingPromise = loadingPromises.get(lowerFamily);
  if (existingPromise) {
    return existingPromise;
  }
  
  // Start loading
  const loadPromise = (async (): Promise<FontLoadResult> => {
    try {
      let success = false;
      let source: FontSource | 'unknown' = 'unknown';
      
      if (fontInfo) {
        source = fontInfo.source;
        
        switch (fontInfo.source) {
          case 'google':
            // Load from Google Fonts API
            success = await loadGoogleFont(fontFamily, fontInfo.weights || ['400']);
            break;
            
          case 'supabase':
            // Load from Supabase Storage with weight-specific URLs
            if (fontInfo.fileUrl && fontInfo.isActive) {
              // Pass complete font info for proper weight handling
              success = await loadSupabaseFont(fontInfo);
            } else {
              success = false;
            }
            break;
            
          case 'system':
            // System fonts don't need loading
            success = loadSystemFont(fontFamily);
            break;
        }
      } else {
        // Font not in registry - try Google Fonts as default
        success = await loadGoogleFont(fontFamily, ['400', '700']);
        source = success ? 'google' : 'unknown';
      }
      
      if (success) {
        loadedFonts.add(lowerFamily);
      }
      
      return {
        fontFamily,
        source,
        success,
        error: success ? undefined : `Failed to load font: ${fontFamily}`,
      };
    } finally {
      loadingPromises.delete(lowerFamily);
    }
  })();
  
  loadingPromises.set(lowerFamily, loadPromise);
  return loadPromise;
}

/**
 * Load multiple fonts in parallel
 * 
 * @param fontFamilies - Array of font family names to load
 * @param fontRegistry - Map of fontFamily -> CustomFont (from useRealtimeFonts)
 */
export async function loadFonts(
  fontFamilies: string[],
  fontRegistry: Map<string, CustomFont>
): Promise<FontLoadResult[]> {
  // Dedupe and filter
  const uniqueFonts = [...new Set(fontFamilies.filter(f => f && f.trim()))];
  
  // Load all fonts in parallel
  const results = await Promise.all(
    uniqueFonts.map(fontFamily => {
      const fontInfo = fontRegistry.get(fontFamily.toLowerCase()) || null;
      return loadFont(fontFamily, fontInfo);
    })
  );
  
  return results;
}

/**
 * Get the loaded fonts set (for debugging)
 */
export function getLoadedFonts(): string[] {
  return Array.from(loadedFonts);
}

/**
 * Clear the loaded fonts cache (for testing)
 */
export function clearLoadedFontsCache(): void {
  loadedFonts.clear();
  loadingPromises.clear();
}

export default {
  loadFont,
  loadFonts,
  isFontLoaded,
  getLoadedFonts,
  clearLoadedFontsCache,
};
