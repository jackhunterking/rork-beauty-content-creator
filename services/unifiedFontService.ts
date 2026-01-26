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
 * Load a font from Supabase Storage
 * 
 * For variable fonts (fonts with multiple weights in one file),
 * we register the font with weight-specific names to ensure fontWeight works.
 * 
 * @param fontFamily - The font family name (used as the font name in RN)
 * @param fileUrl - The Supabase Storage URL for the font file
 * @param weights - Available weights for this font (e.g., ['400', '700'])
 */
async function loadSupabaseFont(
  fontFamily: string, 
  fileUrl: string, 
  weights: string[] = ['400']
): Promise<boolean> {
  try {
    console.log(`[UnifiedFont] Loading from Supabase: ${fontFamily} (weights: ${weights.join(', ')})`);
    
    // For fonts with multiple weights, register with both base name and weight-specific names
    // This ensures fontWeight style works in React Native
    const fontsToLoad: Record<string, string> = {
      // Base name - will work with fontWeight style on iOS
      [fontFamily]: fileUrl,
    };
    
    // Also register weight-specific variants for better compatibility
    // Format: FontFamily_700 for bold, etc.
    for (const weight of weights) {
      if (weight !== '400') {
        // Use underscore format for weight variants (e.g., LeagueSpartan_700)
        fontsToLoad[`${fontFamily}_${weight}`] = fileUrl;
      }
    }
    
    console.log(`[UnifiedFont] Registering ${Object.keys(fontsToLoad).length} font variants for ${fontFamily}`);
    
    // expo-font can load fonts from remote URLs
    await Font.loadAsync(fontsToLoad);
    
    console.log(`[UnifiedFont] ✓ Loaded from Supabase: ${fontFamily} with ${weights.length} weight(s)`);
    return true;
  } catch (error) {
    console.error(`[UnifiedFont] Failed to load from Supabase: ${fontFamily}`, error);
    return false;
  }
}

/**
 * Load a system font (no-op, just mark as loaded)
 */
function loadSystemFont(fontFamily: string): boolean {
  console.log(`[UnifiedFont] System font: ${fontFamily} (no loading needed)`);
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
            // Load from Supabase Storage
            if (fontInfo.fileUrl && fontInfo.isActive) {
              // Pass weights for variable font support
              success = await loadSupabaseFont(fontFamily, fontInfo.fileUrl, fontInfo.weights || ['400']);
            } else if (!fontInfo.isActive) {
              console.warn(`[UnifiedFont] Font ${fontFamily} is not active (file not uploaded yet)`);
              success = false;
            } else {
              console.warn(`[UnifiedFont] Font ${fontFamily} has no file URL`);
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
        console.log(`[UnifiedFont] Font ${fontFamily} not in registry, trying Google Fonts...`);
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
  
  // Log summary
  const successCount = results.filter(r => r.success).length;
  const failedFonts = results.filter(r => !r.success).map(r => r.fontFamily);
  
  console.log(`[UnifiedFont] Loaded ${successCount}/${uniqueFonts.length} fonts`);
  if (failedFonts.length > 0) {
    console.warn(`[UnifiedFont] Failed fonts:`, failedFonts);
  }
  
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
