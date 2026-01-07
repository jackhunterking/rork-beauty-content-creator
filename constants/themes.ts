import { TemplateTheme } from '@/types';

/**
 * Theme System Constants
 * 
 * Defines available themes for template customization.
 * Each theme specifies color overrides for template layers.
 * 
 * How it works:
 * 1. User selects a theme in the editor
 * 2. When rendering, we pass the theme's layerColors to Templated.io
 * 3. Templated.io applies these colors to the corresponding layers
 * 4. Rendered images are cached by themeId for instant switching
 * 
 * Future:
 * - Custom themes per template
 * - User-created themes
 * - Brand colors integration
 */

/**
 * Default theme - uses template's original colors
 */
export const DEFAULT_THEME: TemplateTheme = {
  id: 'default',
  name: 'Original',
  preview: '#2D2D2D', // Dark preview swatch
  layerColors: {},  // Empty = use original colors
};

/**
 * Pre-defined themes available for all templates
 * These override common layer names found in templates
 */
export const PRESET_THEMES: TemplateTheme[] = [
  DEFAULT_THEME,
  
  {
    id: 'elegant-black',
    name: 'Elegant Black',
    preview: '#1A1A1A',
    layerColors: {
      'background': '#1A1A1A',
      'tag-before': '#2D2D2D',
      'tag-after': '#2D2D2D',
      'badge': '#2D2D2D',
      'text-primary': '#FFFFFF',
      'text-secondary': '#B3B3B3',
    },
  },
  
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    preview: '#C9A87C',
    layerColors: {
      'background': '#FDF8F4',
      'tag-before': '#C9A87C',
      'tag-after': '#C9A87C',
      'badge': '#C9A87C',
      'text-primary': '#2D2D2D',
      'text-secondary': '#8B7355',
    },
  },
  
  {
    id: 'soft-white',
    name: 'Soft White',
    preview: '#FAFAFA',
    layerColors: {
      'background': '#FAFAFA',
      'tag-before': '#E8E8E8',
      'tag-after': '#E8E8E8',
      'badge': '#E8E8E8',
      'text-primary': '#2D2D2D',
      'text-secondary': '#666666',
    },
  },
  
  {
    id: 'dusty-rose',
    name: 'Dusty Rose',
    preview: '#D4A5A5',
    layerColors: {
      'background': '#FFF5F5',
      'tag-before': '#D4A5A5',
      'tag-after': '#D4A5A5',
      'badge': '#D4A5A5',
      'text-primary': '#4A3C3C',
      'text-secondary': '#8B7171',
    },
  },
  
  {
    id: 'sage-green',
    name: 'Sage Green',
    preview: '#9CAF88',
    layerColors: {
      'background': '#F5F8F2',
      'tag-before': '#9CAF88',
      'tag-after': '#9CAF88',
      'badge': '#9CAF88',
      'text-primary': '#3D4A35',
      'text-secondary': '#6B7A60',
    },
  },
  
  {
    id: 'navy-blue',
    name: 'Navy Blue',
    preview: '#2C3E50',
    layerColors: {
      'background': '#2C3E50',
      'tag-before': '#34495E',
      'tag-after': '#34495E',
      'badge': '#34495E',
      'text-primary': '#FFFFFF',
      'text-secondary': '#BDC3C7',
    },
  },
  
  {
    id: 'blush-pink',
    name: 'Blush Pink',
    preview: '#F8BBD9',
    layerColors: {
      'background': '#FDF5F9',
      'tag-before': '#F8BBD9',
      'tag-after': '#F8BBD9',
      'badge': '#F8BBD9',
      'text-primary': '#5D3A4A',
      'text-secondary': '#9B6B7D',
    },
  },
  
  {
    id: 'champagne',
    name: 'Champagne',
    preview: '#F7E7CE',
    layerColors: {
      'background': '#FFFBF5',
      'tag-before': '#F7E7CE',
      'tag-after': '#F7E7CE',
      'badge': '#D4AF37',
      'text-primary': '#5C4A32',
      'text-secondary': '#8B7355',
    },
  },
];

/**
 * Get a theme by ID
 */
export function getThemeById(themeId: string): TemplateTheme {
  return PRESET_THEMES.find(t => t.id === themeId) || DEFAULT_THEME;
}

/**
 * Get all available themes
 */
export function getAllThemes(): TemplateTheme[] {
  return PRESET_THEMES;
}

/**
 * Build layer overrides for Templated.io API
 * Converts theme's layerColors to the format expected by the API
 * 
 * @param theme - Theme to get overrides for
 * @returns Record<string, { color: string }> for API payload
 */
export function buildThemeOverrides(
  theme: TemplateTheme
): Record<string, { color?: string; text?: string }> {
  const overrides: Record<string, { color?: string; text?: string }> = {};
  
  for (const [layerId, color] of Object.entries(theme.layerColors)) {
    overrides[layerId] = { color };
  }
  
  return overrides;
}

/**
 * Template-specific theme configurations
 * Some templates may have specific layer names that need mapping
 */
export interface TemplateThemeConfig {
  templateId: string;
  layerMapping: Record<string, string>;  // generic layer name -> actual layer name
}

/**
 * Map generic layer names to template-specific layer names
 * This allows themes to work across different templates
 */
export function mapThemeToTemplate(
  theme: TemplateTheme,
  config?: TemplateThemeConfig
): TemplateTheme {
  if (!config) {
    return theme;
  }
  
  const mappedColors: Record<string, string> = {};
  
  for (const [genericName, color] of Object.entries(theme.layerColors)) {
    const actualName = config.layerMapping[genericName] || genericName;
    mappedColors[actualName] = color;
  }
  
  return {
    ...theme,
    layerColors: mappedColors,
  };
}

/**
 * Generate a cache key suffix for a theme
 * Used in the render cache service to differentiate theme variants
 */
export function getThemeCacheKeySuffix(themeId: string): string {
  return themeId === 'default' ? '' : `_${themeId}`;
}

