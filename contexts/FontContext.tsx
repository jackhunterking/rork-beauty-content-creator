/**
 * FontContext
 * 
 * Provides the font registry throughout the app.
 * Uses real-time subscription to Supabase to keep fonts in sync.
 * 
 * This context enables any component to:
 * - Know where to load fonts from (Google, Supabase, System)
 * - Access the font registry for lookups
 * - React to font registry updates in real-time
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useRealtimeFonts, CustomFont } from '@/hooks/useRealtimeFonts';

// ============================================
// Types
// ============================================

interface FontContextValue {
  fonts: CustomFont[];
  fontsByFamily: Map<string, CustomFont>;
  isLoading: boolean;
  error: Error | null;
  getFontSource: (fontFamily: string) => CustomFont | null;
  refetch: () => Promise<void>;
}

// ============================================
// Context
// ============================================

const FontContext = createContext<FontContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface FontProviderProps {
  children: ReactNode;
}

export function FontProvider({ children }: FontProviderProps) {
  const {
    fonts,
    fontsByFamily,
    isLoading,
    error,
    getFontSource,
    refetch,
  } = useRealtimeFonts();

  return (
    <FontContext.Provider
      value={{
        fonts,
        fontsByFamily,
        isLoading,
        error,
        getFontSource,
        refetch,
      }}
    >
      {children}
    </FontContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

/**
 * Use the font context
 * Must be used within a FontProvider
 */
export function useFontContext(): FontContextValue {
  const context = useContext(FontContext);
  
  if (!context) {
    // Return a default value if not in provider (for backwards compatibility)
    console.warn('[FontContext] useFontContext called outside of FontProvider');
    return {
      fonts: [],
      fontsByFamily: new Map(),
      isLoading: false,
      error: null,
      getFontSource: () => null,
      refetch: async () => {},
    };
  }
  
  return context;
}

export default FontProvider;
