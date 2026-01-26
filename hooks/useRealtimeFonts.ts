/**
 * useRealtimeFonts Hook
 * 
 * Real-time subscription to the custom_fonts table in Supabase.
 * Provides a centralized font registry that automatically syncs
 * when fonts are added, updated, or removed.
 * 
 * The font registry is the single source of truth for:
 * - Which fonts are available
 * - Where to load each font from (Google Fonts, Supabase Storage, or System)
 * - Font weights and formats
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ============================================
// Types
// ============================================

export type FontSource = 'google' | 'supabase' | 'system';

export interface CustomFont {
  id: string;
  fontFamily: string;      // Exact name from Templated.io (e.g., "Sacco-SemiBoldCondensed")
  displayName: string | null;
  source: FontSource;      // Where to load the font from
  fileUrl: string | null;  // Supabase Storage URL for regular weight (for 'supabase' source)
  fileUrlBold: string | null;  // Supabase Storage URL for bold weight (700)
  fileFormat: 'ttf' | 'otf' | 'woff' | 'woff2' | null;
  weights: string[];       // Available weights (e.g., ['400', '700'])
  isActive: boolean;       // Whether font is ready to use
  defaultWeight: string;   // Default weight to use (e.g., '400', '700')
  googleFontName: string | null; // Official Google Fonts family name for fallback
  createdAt: string;
  updatedAt: string;
}

// Database row type (snake_case)
interface CustomFontRow {
  id: string;
  font_family: string;
  display_name: string | null;
  source: FontSource;
  file_url: string | null;
  file_url_bold: string | null;
  file_format: string | null;
  weights: string[] | null;
  is_active: boolean;
  default_weight: string | null;
  google_font_name: string | null;
  created_at: string;
  updated_at: string;
}

interface UseRealtimeFontsResult {
  fonts: CustomFont[];
  fontsByFamily: Map<string, CustomFont>;  // Quick lookup by font_family
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getFontSource: (fontFamily: string) => CustomFont | null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map database row (snake_case) to CustomFont (camelCase)
 */
function mapRowToFont(row: CustomFontRow): CustomFont {
  return {
    id: row.id,
    fontFamily: row.font_family,
    displayName: row.display_name,
    source: row.source,
    fileUrl: row.file_url,
    fileUrlBold: row.file_url_bold,
    fileFormat: row.file_format as CustomFont['fileFormat'],
    weights: row.weights || ['400'],
    isActive: row.is_active,
    defaultWeight: row.default_weight || '400',
    googleFontName: row.google_font_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Build a lookup map from font array
 */
function buildFontMap(fonts: CustomFont[]): Map<string, CustomFont> {
  const map = new Map<string, CustomFont>();
  for (const font of fonts) {
    map.set(font.fontFamily.toLowerCase(), font);
  }
  return map;
}

// ============================================
// Hook
// ============================================

export function useRealtimeFonts(): UseRealtimeFontsResult {
  const [fonts, setFonts] = useState<CustomFont[]>([]);
  const [fontsByFamily, setFontsByFamily] = useState<Map<string, CustomFont>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);

  // Update the lookup map whenever fonts change
  const updateFontsState = useCallback((newFonts: CustomFont[]) => {
    setFonts(newFonts);
    setFontsByFamily(buildFontMap(newFonts));
  }, []);

  // Initial fetch
  const fetchInitialFonts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('custom_fonts')
        .select('*')
        .order('font_family');
      
      if (fetchError) throw fetchError;
      
      const mappedFonts = (data as CustomFontRow[]).map(mapRowToFont);
      console.log('[RealtimeFonts] Initial fetch complete:', mappedFonts.length, 'fonts');
      
      // Log sources for debugging
      const googleFonts = mappedFonts.filter(f => f.source === 'google').length;
      const supabaseFonts = mappedFonts.filter(f => f.source === 'supabase').length;
      console.log(`[RealtimeFonts] Sources: ${googleFonts} Google, ${supabaseFonts} Supabase`);
      
      updateFontsState(mappedFonts);
    } catch (err) {
      console.error('[RealtimeFonts] Error fetching fonts:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch fonts'));
    } finally {
      setIsLoading(false);
    }
  }, [updateFontsState]);

  // Handle INSERT
  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<CustomFontRow>) => {
    const newRow = payload.new as CustomFontRow;
    console.log('[RealtimeFonts] INSERT:', newRow.font_family);
    
    const newFont = mapRowToFont(newRow);
    setFonts(prev => {
      const updated = [...prev, newFont];
      setFontsByFamily(buildFontMap(updated));
      return updated;
    });
  }, []);

  // Handle UPDATE
  const handleUpdate = useCallback((payload: RealtimePostgresChangesPayload<CustomFontRow>) => {
    const updatedRow = payload.new as CustomFontRow;
    console.log('[RealtimeFonts] UPDATE:', updatedRow.font_family, 'active:', updatedRow.is_active);
    
    const updatedFont = mapRowToFont(updatedRow);
    setFonts(prev => {
      const existingIndex = prev.findIndex(f => f.id === updatedFont.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = updatedFont;
        setFontsByFamily(buildFontMap(updated));
        return updated;
      }
      return prev;
    });
  }, []);

  // Handle DELETE
  const handleDelete = useCallback((payload: RealtimePostgresChangesPayload<CustomFontRow>) => {
    const deletedRow = payload.old as CustomFontRow;
    console.log('[RealtimeFonts] DELETE:', deletedRow.id);
    
    setFonts(prev => {
      const updated = prev.filter(f => f.id !== deletedRow.id);
      setFontsByFamily(buildFontMap(updated));
      return updated;
    });
  }, []);

  // Set up subscription
  useEffect(() => {
    mountedRef.current = true;
    fetchInitialFonts();

    const channel = supabase
      .channel(`custom-fonts-${Date.now()}`)
      .on<CustomFontRow>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'custom_fonts' }, handleInsert)
      .on<CustomFontRow>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'custom_fonts' }, handleUpdate)
      .on<CustomFontRow>('postgres_changes', { event: 'DELETE', schema: 'public', table: 'custom_fonts' }, handleDelete)
      .subscribe((status, err) => {
        if (!mountedRef.current) return;
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeFonts] ✓ Subscription active for custom_fonts table');
        }
        if (status === 'CHANNEL_ERROR' && err?.message) {
          console.error('[RealtimeFonts] Subscription error:', err.message);
          setError(new Error('Real-time fonts subscription failed'));
        }
      });

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchInitialFonts, handleInsert, handleUpdate, handleDelete]);

  const refetch = useCallback(async () => {
    await fetchInitialFonts();
  }, [fetchInitialFonts]);

  /**
   * Get font source info by font family name
   * Returns null if font is not in registry
   */
  const getFontSource = useCallback((fontFamily: string): CustomFont | null => {
    return fontsByFamily.get(fontFamily.toLowerCase()) || null;
  }, [fontsByFamily]);

  return { 
    fonts, 
    fontsByFamily, 
    isLoading, 
    error, 
    refetch,
    getFontSource,
  };
}

export default useRealtimeFonts;
