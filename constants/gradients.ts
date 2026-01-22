/**
 * Gradient Presets for Background Replacement
 * 
 * These gradients are used with the birefnet + canvas composite approach
 * for guaranteed exact color matching (no AI interpretation).
 */

import { GradientPreset, GradientConfig, GradientDirection } from '@/types';

/**
 * Convert gradient direction to expo-linear-gradient start/end points
 */
export function getGradientPoints(direction: GradientDirection): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  switch (direction) {
    case 'vertical':
      return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
    case 'horizontal':
      return { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };
    case 'diagonal-tl':
      // Top-left to bottom-right
      return { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
    case 'diagonal-tr':
      // Top-right to bottom-left
      return { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } };
    default:
      return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
  }
}

/**
 * Preset gradients organized by category
 */
export const GRADIENT_PRESETS: GradientPreset[] = [
  // Warm Tones
  {
    id: 'sunset',
    name: 'Sunset',
    config: {
      type: 'linear',
      colors: ['#FF6B6B', '#FFA94D'],
      direction: 'vertical',
    },
    previewColors: ['#FF6B6B', '#FFA94D'],
  },
  {
    id: 'coral-peach',
    name: 'Coral Peach',
    config: {
      type: 'linear',
      colors: ['#FF9A9E', '#FECFEF'],
      direction: 'vertical',
    },
    previewColors: ['#FF9A9E', '#FECFEF'],
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    config: {
      type: 'linear',
      colors: ['#F4C4C4', '#D4A574'],
      direction: 'diagonal-tl',
    },
    previewColors: ['#F4C4C4', '#D4A574'],
  },
  {
    id: 'warm-flame',
    name: 'Warm Flame',
    config: {
      type: 'linear',
      colors: ['#FF5858', '#F09819'],
      direction: 'horizontal',
    },
    previewColors: ['#FF5858', '#F09819'],
  },
  
  // Cool Tones
  {
    id: 'ocean',
    name: 'Ocean',
    config: {
      type: 'linear',
      colors: ['#4ECDC4', '#2C3E50'],
      direction: 'vertical',
    },
    previewColors: ['#4ECDC4', '#2C3E50'],
  },
  {
    id: 'sky-blue',
    name: 'Sky Blue',
    config: {
      type: 'linear',
      colors: ['#87CEEB', '#E0F4FF'],
      direction: 'vertical',
    },
    previewColors: ['#87CEEB', '#E0F4FF'],
  },
  {
    id: 'deep-sea',
    name: 'Deep Sea',
    config: {
      type: 'linear',
      colors: ['#1A5276', '#5DADE2'],
      direction: 'vertical',
    },
    previewColors: ['#1A5276', '#5DADE2'],
  },
  {
    id: 'arctic',
    name: 'Arctic',
    config: {
      type: 'linear',
      colors: ['#E8F4F8', '#B3E0F2'],
      direction: 'diagonal-tr',
    },
    previewColors: ['#E8F4F8', '#B3E0F2'],
  },
  
  // Nature Tones
  {
    id: 'forest',
    name: 'Forest',
    config: {
      type: 'linear',
      colors: ['#56AB2F', '#A8E6CF'],
      direction: 'vertical',
    },
    previewColors: ['#56AB2F', '#A8E6CF'],
  },
  {
    id: 'sage',
    name: 'Sage',
    config: {
      type: 'linear',
      colors: ['#9DC183', '#E8F5E9'],
      direction: 'vertical',
    },
    previewColors: ['#9DC183', '#E8F5E9'],
  },
  {
    id: 'lavender',
    name: 'Lavender',
    config: {
      type: 'linear',
      colors: ['#E6E6FA', '#D8BFD8'],
      direction: 'diagonal-tl',
    },
    previewColors: ['#E6E6FA', '#D8BFD8'],
  },
  
  // Neutral & Professional
  {
    id: 'charcoal',
    name: 'Charcoal',
    config: {
      type: 'linear',
      colors: ['#2C3E50', '#4A4A4A'],
      direction: 'vertical',
    },
    previewColors: ['#2C3E50', '#4A4A4A'],
  },
  {
    id: 'silver',
    name: 'Silver',
    config: {
      type: 'linear',
      colors: ['#F5F5F5', '#C0C0C0'],
      direction: 'vertical',
    },
    previewColors: ['#F5F5F5', '#C0C0C0'],
  },
  {
    id: 'cream',
    name: 'Cream',
    config: {
      type: 'linear',
      colors: ['#FFFAF0', '#F5DEB3'],
      direction: 'diagonal-tl',
    },
    previewColors: ['#FFFAF0', '#F5DEB3'],
  },
  {
    id: 'mocha',
    name: 'Mocha',
    config: {
      type: 'linear',
      colors: ['#D7CCC8', '#8D6E63'],
      direction: 'vertical',
    },
    previewColors: ['#D7CCC8', '#8D6E63'],
  },
  
  // Vibrant & Bold
  {
    id: 'purple-pink',
    name: 'Purple Pink',
    config: {
      type: 'linear',
      colors: ['#667EEA', '#F093FB'],
      direction: 'horizontal',
    },
    previewColors: ['#667EEA', '#F093FB'],
  },
  {
    id: 'neon',
    name: 'Neon',
    config: {
      type: 'linear',
      colors: ['#00F5FF', '#FF00FF'],
      direction: 'diagonal-tr',
    },
    previewColors: ['#00F5FF', '#FF00FF'],
  },
  {
    id: 'electric',
    name: 'Electric',
    config: {
      type: 'linear',
      colors: ['#6366F1', '#EC4899'],
      direction: 'horizontal',
    },
    previewColors: ['#6366F1', '#EC4899'],
  },
];

/**
 * Default gradient for new selections
 */
export const DEFAULT_GRADIENT: GradientConfig = {
  type: 'linear',
  colors: ['#FF6B6B', '#4ECDC4'],
  direction: 'vertical',
};

/**
 * Direction options for custom gradient builder
 * Note: diagonal icons use arrow-forward with rotation transforms applied in the component
 */
export const GRADIENT_DIRECTIONS: { value: GradientDirection; label: string; icon: string; rotation?: number }[] = [
  { value: 'vertical', label: 'Vertical', icon: 'arrow-down' },
  { value: 'horizontal', label: 'Horizontal', icon: 'arrow-forward' },
  { value: 'diagonal-tl', label: 'Diagonal ↘', icon: 'arrow-forward', rotation: 45 },
  { value: 'diagonal-tr', label: 'Diagonal ↙', icon: 'arrow-forward', rotation: 135 },
];

/**
 * Get a gradient preset by ID
 */
export function getGradientPreset(id: string): GradientPreset | undefined {
  return GRADIENT_PRESETS.find(preset => preset.id === id);
}

/**
 * Create a custom gradient config
 */
export function createGradient(
  startColor: string,
  endColor: string,
  direction: GradientDirection = 'vertical'
): GradientConfig {
  return {
    type: 'linear',
    colors: [startColor, endColor],
    direction,
  };
}
