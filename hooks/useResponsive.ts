/**
 * useResponsive Hook
 * 
 * Provides responsive utilities for iPad and iPhone layouts.
 * Handles device type detection, dynamic grid columns, and adaptive sizing.
 */

import { useMemo } from 'react';
import { useWindowDimensions, Platform } from 'react-native';

// Breakpoints for responsive design
const BREAKPOINTS = {
  PHONE_MAX: 767,           // Max width for phone layout
  TABLET_MIN: 768,          // Min width for tablet (iPad Portrait)
  TABLET_LANDSCAPE: 1024,   // iPad landscape and larger
  MAX_CONTENT: 1200,        // Maximum content width for very large screens
};

// Grid configuration
const GRID_CONFIG = {
  // Phone settings
  PHONE_COLUMNS: 2,
  PHONE_GAP: 12,
  PHONE_PADDING: 20,
  
  // Tablet portrait settings
  TABLET_PORTRAIT_COLUMNS: 3,
  TABLET_GAP: 16,
  TABLET_PADDING: 32,
  
  // Tablet landscape settings
  TABLET_LANDSCAPE_COLUMNS: 4,
  TABLET_LANDSCAPE_GAP: 20,
  TABLET_LANDSCAPE_PADDING: 40,
};

// Content width constraints
const CONTENT_CONSTRAINTS = {
  MAX_FORM_WIDTH: 500,      // Auth forms, modals
  MAX_SETTINGS_WIDTH: 600,  // Settings cards
  MAX_PREVIEW_WIDTH: 400,   // Publish preview
};

export interface ResponsiveConfig {
  // Device info
  isTablet: boolean;
  isLandscape: boolean;
  screenWidth: number;
  screenHeight: number;
  
  // Grid configuration
  columns: number;
  gridGap: number;
  gridPadding: number;
  tileWidth: number;
  
  // Content width constraints
  maxContentWidth: number;
  maxFormWidth: number;
  maxPreviewWidth: number;
  
  // Adaptive sizing
  headerFontSize: number;
  titleFontSize: number;
  bodyFontSize: number;
  
  // Tab bar
  tabBarHeight: number;
  tabIconSize: number;
}

/**
 * Calculate dynamic grid columns based on screen width
 */
const getGridColumns = (width: number): number => {
  if (width >= BREAKPOINTS.TABLET_LANDSCAPE) return GRID_CONFIG.TABLET_LANDSCAPE_COLUMNS;
  if (width >= BREAKPOINTS.TABLET_MIN) return GRID_CONFIG.TABLET_PORTRAIT_COLUMNS;
  return GRID_CONFIG.PHONE_COLUMNS;
};

/**
 * Calculate grid gap based on screen width
 */
const getGridGap = (width: number): number => {
  if (width >= BREAKPOINTS.TABLET_LANDSCAPE) return GRID_CONFIG.TABLET_LANDSCAPE_GAP;
  if (width >= BREAKPOINTS.TABLET_MIN) return GRID_CONFIG.TABLET_GAP;
  return GRID_CONFIG.PHONE_GAP;
};

/**
 * Calculate grid padding based on screen width
 */
const getGridPadding = (width: number): number => {
  if (width >= BREAKPOINTS.TABLET_LANDSCAPE) return GRID_CONFIG.TABLET_LANDSCAPE_PADDING;
  if (width >= BREAKPOINTS.TABLET_MIN) return GRID_CONFIG.TABLET_PADDING;
  return GRID_CONFIG.PHONE_PADDING;
};

/**
 * Calculate tile width based on screen width, columns, gap, and padding
 */
const getTileWidth = (
  screenWidth: number,
  columns: number,
  gap: number,
  padding: number
): number => {
  // Constrain available width for very large screens
  const constrainedWidth = Math.min(screenWidth, BREAKPOINTS.MAX_CONTENT);
  const totalGaps = (columns - 1) * gap;
  const availableWidth = constrainedWidth - padding * 2 - totalGaps;
  return Math.floor(availableWidth / columns);
};

/**
 * Calculate max content width for forms and settings on tablets
 */
const getMaxContentWidth = (screenWidth: number, isTablet: boolean): number => {
  if (!isTablet) return screenWidth;
  return Math.min(CONTENT_CONSTRAINTS.MAX_SETTINGS_WIDTH, screenWidth - 80);
};

/**
 * Calculate max form width for auth screens on tablets
 */
const getMaxFormWidth = (screenWidth: number, isTablet: boolean): number => {
  if (!isTablet) return screenWidth;
  return Math.min(CONTENT_CONSTRAINTS.MAX_FORM_WIDTH, screenWidth - 80);
};

/**
 * Calculate max preview width for publish screen on tablets
 */
const getMaxPreviewWidth = (screenWidth: number, isTablet: boolean): number => {
  if (!isTablet) return screenWidth - 80;
  return Math.min(CONTENT_CONSTRAINTS.MAX_PREVIEW_WIDTH, screenWidth - 120);
};

/**
 * Hook that provides responsive configuration based on screen dimensions
 */
export function useResponsive(): ResponsiveConfig {
  const { width, height } = useWindowDimensions();
  
  return useMemo(() => {
    // Device detection
    const isTablet = width >= BREAKPOINTS.TABLET_MIN || 
                     (Platform.OS === 'ios' && Platform.isPad);
    const isLandscape = width > height;
    
    // Grid configuration
    const columns = getGridColumns(width);
    const gridGap = getGridGap(width);
    const gridPadding = getGridPadding(width);
    const tileWidth = getTileWidth(width, columns, gridGap, gridPadding);
    
    // Content constraints
    const maxContentWidth = getMaxContentWidth(width, isTablet);
    const maxFormWidth = getMaxFormWidth(width, isTablet);
    const maxPreviewWidth = getMaxPreviewWidth(width, isTablet);
    
    // Adaptive font sizes
    const headerFontSize = isTablet ? 36 : 32;
    const titleFontSize = isTablet ? 22 : 20;
    const bodyFontSize = isTablet ? 17 : 15;
    
    // Tab bar sizing
    const tabBarHeight = isTablet ? 96 : 88;
    const tabIconSize = isTablet ? 26 : 22;
    
    return {
      isTablet,
      isLandscape,
      screenWidth: width,
      screenHeight: height,
      columns,
      gridGap,
      gridPadding,
      tileWidth,
      maxContentWidth,
      maxFormWidth,
      maxPreviewWidth,
      headerFontSize,
      titleFontSize,
      bodyFontSize,
      tabBarHeight,
      tabIconSize,
    };
  }, [width, height]);
}

/**
 * Get dynamic tile height based on format aspect ratio
 */
export function getResponsiveTileHeight(
  tileWidth: number,
  aspectRatio: number
): number {
  return Math.floor(tileWidth / aspectRatio);
}

/**
 * Calculate centered container style for iPad
 */
export function getCenteredContainerStyle(
  screenWidth: number,
  maxWidth: number,
  isTablet: boolean
) {
  if (!isTablet || screenWidth <= maxWidth) {
    return {};
  }
  
  const horizontalMargin = (screenWidth - maxWidth) / 2;
  return {
    marginHorizontal: horizontalMargin,
    maxWidth,
  };
}

export default useResponsive;
