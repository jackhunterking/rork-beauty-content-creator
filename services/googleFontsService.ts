/**
 * Google Fonts Service
 * 
 * Dynamic font loading from Google Fonts using the Developer API.
 * This service fetches the complete font catalog and loads fonts on-demand
 * using expo-font. Works with ANY Google Font without pre-installing packages.
 * 
 * NOTE (Jan 2026): This service is now used by the unified font service
 * (unifiedFontService.ts) as one of the font sources. For most use cases,
 * you should use the unified service instead of calling this directly.
 * 
 * Usage:
 *   await loadGoogleFont('Abril Fatface');
 *   await loadGoogleFont('Poppins', ['400', '700']);
 * 
 * Features:
 * - Fetches font catalog from Google Fonts API (cached after first call)
 * - Loads fonts on-demand via expo-font
 * - Supports any weight variant (regular, bold, 100-900)
 * - Validates fonts exist before attempting to load
 * - Graceful fallback for unknown fonts
 */

import * as Font from 'expo-font';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Google Fonts Developer API Key
 * Get yours free at: https://console.cloud.google.com/
 * Enable "Web Fonts Developer API"
 * 
 * Note: The API is free with generous limits (10,000 requests/day)
 */
const GOOGLE_FONTS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_FONTS_API_KEY || '';

const GOOGLE_FONTS_API_URL = 'https://www.googleapis.com/webfonts/v1/webfonts';

// Weight name to number mapping
const WEIGHT_MAP: Record<string, string> = {
  'thin': '100',
  'extralight': '200',
  'light': '300',
  'regular': '400',
  'normal': '400',
  'medium': '500',
  'semibold': '600',
  'bold': '700',
  'extrabold': '800',
  'black': '900',
};

// ============================================================================
// Types
// ============================================================================

interface GoogleFontItem {
  family: string;
  variants: string[];  // e.g., ['regular', 'italic', '700', '700italic']
  subsets: string[];   // e.g., ['latin', 'latin-ext']
  version: string;     // e.g., 'v23'
  lastModified: string;
  files: Record<string, string>;  // variant -> URL, e.g., { 'regular': 'https://...' }
  category: string;    // e.g., 'serif', 'sans-serif', 'display'
  kind: string;
}

interface FontCatalog {
  items: GoogleFontItem[];
  byFamily: Map<string, GoogleFontItem>;
}

// ============================================================================
// State
// ============================================================================

// Cached font catalog (fetched once, reused forever)
let fontCatalog: FontCatalog | null = null;
let catalogFetchPromise: Promise<FontCatalog> | null = null;

// Track which fonts are already loaded
const loadedFonts = new Set<string>();

// Track loading promises to avoid duplicate concurrent loads
const loadingPromises = new Map<string, Promise<boolean>>();

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Fetch the complete Google Fonts catalog
 * Cached after first successful fetch
 */
export async function fetchFontCatalog(): Promise<FontCatalog> {
  // Return cached catalog
  if (fontCatalog) {
    return fontCatalog;
  }
  
  // Return existing fetch promise if already fetching
  if (catalogFetchPromise) {
    return catalogFetchPromise;
  }
  
  // Start fetching
  catalogFetchPromise = (async () => {
    try {
      // Try API with key first
      let url = `${GOOGLE_FONTS_API_URL}?sort=popularity`;
      if (GOOGLE_FONTS_API_KEY) {
        url += `&key=${GOOGLE_FONTS_API_KEY}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      const items: GoogleFontItem[] = data.items || [];
      
      // Build lookup map by family name (case-insensitive)
      const byFamily = new Map<string, GoogleFontItem>();
      for (const font of items) {
        byFamily.set(font.family.toLowerCase(), font);
      }
      
      fontCatalog = { items, byFamily };
      
      return fontCatalog;
    } catch (error) {
      // Return empty catalog on error
      fontCatalog = { items: [], byFamily: new Map() };
      return fontCatalog;
    } finally {
      catalogFetchPromise = null;
    }
  })();
  
  return catalogFetchPromise;
}

/**
 * Get font info from the catalog
 */
export async function getFontInfo(fontFamily: string): Promise<GoogleFontItem | null> {
  const catalog = await fetchFontCatalog();
  return catalog.byFamily.get(fontFamily.toLowerCase()) || null;
}

/**
 * Check if a font exists in Google Fonts
 */
export async function fontExists(fontFamily: string): Promise<boolean> {
  const info = await getFontInfo(fontFamily);
  return info !== null;
}

/**
 * Get the TTF URL for a specific font variant
 */
export async function getFontUrl(
  fontFamily: string,
  weight: string = '400'
): Promise<string | null> {
  const info = await getFontInfo(fontFamily);
  if (!info) {
    return null;
  }
  
  // Normalize weight
  const normalizedWeight = WEIGHT_MAP[weight.toLowerCase()] || weight;
  
  // Map weight to variant name
  const variantName = normalizedWeight === '400' ? 'regular' : normalizedWeight;
  
  // Get URL from files
  const url = info.files[variantName] || info.files['regular'];
  
  if (!url) {
    return null;
  }
  
  // Google Fonts API returns http:// URLs, convert to https://
  return url.replace('http://', 'https://');
}

/**
 * Load a Google Font dynamically
 * Returns true if successful, false otherwise
 */
export async function loadGoogleFont(
  fontFamily: string,
  weights: string[] = ['400']
): Promise<boolean> {
  // Generate unique key for this font+weights combo
  const cacheKey = `${fontFamily}:${weights.sort().join(',')}`;
  
  // Already loaded?
  if (loadedFonts.has(cacheKey)) {
    return true;
  }
  
  // Already loading?
  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey)!;
  }
  
  // Start loading
  const loadPromise = (async () => {
    try {
      // Get font info to verify it exists
      const info = await getFontInfo(fontFamily);
      
      if (!info) {
        return false;
      }
      
      // Load each weight
      const fontsToLoad: Record<string, string> = {};
      
      for (const weight of weights) {
        const normalizedWeight = WEIGHT_MAP[weight.toLowerCase()] || weight;
        const variantName = normalizedWeight === '400' ? 'regular' : normalizedWeight;
        
        const url = info.files[variantName] || info.files['regular'];
        if (url) {
          // Create font name for this specific weight
          // Use the family name directly for regular weight
          const fontName = normalizedWeight === '400' 
            ? fontFamily 
            : `${fontFamily}_${normalizedWeight}`;
          
          fontsToLoad[fontName] = url.replace('http://', 'https://');
        }
      }
      
      if (Object.keys(fontsToLoad).length === 0) {
        return false;
      }
      
      // Load all fonts
      await Font.loadAsync(fontsToLoad);
      
      loadedFonts.add(cacheKey);
      
      return true;
    } catch (error) {
      return false;
    } finally {
      loadingPromises.delete(cacheKey);
    }
  })();
  
  loadingPromises.set(cacheKey, loadPromise);
  return loadPromise;
}

/**
 * Load multiple fonts in parallel
 */
export async function loadGoogleFonts(
  fonts: Array<{ family: string; weights?: string[] }>
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  await Promise.all(
    fonts.map(async ({ family, weights }) => {
      const success = await loadGoogleFont(family, weights);
      results.set(family, success);
    })
  );
  
  return results;
}

/**
 * Check if a font is loaded
 */
export function isFontLoaded(fontFamily: string, weight: string = '400'): boolean {
  // Check if any variant of this font is loaded
  for (const key of loadedFonts) {
    if (key.startsWith(fontFamily + ':')) {
      return true;
    }
  }
  return false;
}

/**
 * Get list of all available Google Fonts (sorted by popularity)
 */
export async function getAvailableFonts(): Promise<string[]> {
  const catalog = await fetchFontCatalog();
  return catalog.items.map(f => f.family);
}

/**
 * Search fonts by name
 */
export async function searchFonts(query: string): Promise<GoogleFontItem[]> {
  const catalog = await fetchFontCatalog();
  const lowerQuery = query.toLowerCase();
  
  return catalog.items.filter(font => 
    font.family.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get fonts by category (serif, sans-serif, display, handwriting, monospace)
 */
export async function getFontsByCategory(category: string): Promise<GoogleFontItem[]> {
  const catalog = await fetchFontCatalog();
  return catalog.items.filter(font => font.category === category);
}

// ============================================================================
// Pre-warming (Optional)
// ============================================================================

/**
 * Pre-fetch the font catalog without loading any fonts
 * Call this early in app lifecycle for faster font loading later
 */
export async function prewarmFontCatalog(): Promise<void> {
  await fetchFontCatalog();
}

/**
 * Preload commonly used fonts
 */
export async function preloadCommonFonts(): Promise<void> {
  const commonFonts = [
    { family: 'Inter', weights: ['400', '600', '700'] },
    { family: 'Poppins', weights: ['400', '600', '700'] },
    { family: 'Abril Fatface', weights: ['400'] },
    { family: 'Roboto', weights: ['400', '700'] },
    { family: 'Open Sans', weights: ['400', '600'] },
  ];
  
  await loadGoogleFonts(commonFonts);
}

export default {
  fetchFontCatalog,
  getFontInfo,
  fontExists,
  getFontUrl,
  loadGoogleFont,
  loadGoogleFonts,
  isFontLoaded,
  getAvailableFonts,
  searchFonts,
  getFontsByCategory,
  prewarmFontCatalog,
  preloadCommonFonts,
};
