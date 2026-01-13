/**
 * Centralized Format Configuration
 * 
 * Single source of truth for all template formats.
 * Add new formats here and they will automatically be available
 * throughout the app (filters, detection, types).
 */

export interface FormatConfig {
  /** Unique format identifier (e.g., '4:5', '1:1', '9:16') */
  id: string;
  /** Human-readable label for display */
  label: string;
  /** Exact aspect ratio (width / height) */
  aspectRatio: number;
  /** Range for auto-detection from dimensions */
  aspectRatioRange: {
    min: number;
    max: number;
  };
  /** Icon type for filter UI */
  icon: 'square' | 'portrait' | 'landscape';
  /** Display order in filter buttons (lower = first) */
  order: number;
  /** Optional description */
  description?: string;
}

/**
 * All supported formats - ADD NEW FORMATS HERE
 * 
 * The aspectRatioRange determines how dimensions are auto-detected:
 * - aspectRatio = width / height
 * - 1:1 square = 1.0
 * - 4:5 portrait = 0.8
 * - 9:16 vertical = 0.5625
 * - 16:9 landscape = 1.78
 */
export const FORMAT_CONFIGS: FormatConfig[] = [
  {
    id: '4:5',
    label: 'Portrait',
    aspectRatio: 0.8,
    aspectRatioRange: { min: 0.75, max: 0.95 },
    icon: 'portrait',
    order: 1,
    description: 'Instagram Posts (1080x1350)',
  },
  {
    id: '1:1',
    label: 'Square',
    aspectRatio: 1.0,
    aspectRatioRange: { min: 0.95, max: 1.05 },
    icon: 'square',
    order: 2,
    description: 'Square Posts (1080x1080)',
  },
  {
    id: '9:16',
    label: 'Story',
    aspectRatio: 0.5625,
    aspectRatioRange: { min: 0.0, max: 0.75 },
    icon: 'portrait',
    order: 3,
    description: 'Stories & Reels (1080x1920)',
  },
  // ============================================
  // ADD NEW FORMATS BELOW
  // ============================================
  // Example: Landscape format for YouTube thumbnails
  // {
  //   id: '16:9',
  //   label: 'Landscape',
  //   aspectRatio: 1.78,
  //   aspectRatioRange: { min: 1.5, max: 2.0 },
  //   icon: 'landscape',
  //   order: 4,
  //   description: 'YouTube Thumbnails (1920x1080)',
  // },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get format config by ID
 */
export function getFormatById(id: string): FormatConfig | undefined {
  return FORMAT_CONFIGS.find(f => f.id === id);
}

/**
 * Get the default format (first in order)
 */
export function getDefaultFormat(): string {
  const sorted = [...FORMAT_CONFIGS].sort((a, b) => a.order - b.order);
  return sorted[0]?.id || '4:5';
}

/**
 * Get all format IDs in display order
 */
export function getAllFormatIds(): string[] {
  return [...FORMAT_CONFIGS]
    .sort((a, b) => a.order - b.order)
    .map(f => f.id);
}

/**
 * Get all format configs in display order
 */
export function getAllFormats(): FormatConfig[] {
  return [...FORMAT_CONFIGS].sort((a, b) => a.order - b.order);
}

/**
 * Detect format from canvas dimensions
 * 
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns Format ID that matches the aspect ratio
 */
export function detectFormatFromDimensions(width: number, height: number): string {
  const aspectRatio = width / height;
  
  // Find the matching format based on aspect ratio range
  for (const config of FORMAT_CONFIGS) {
    if (aspectRatio >= config.aspectRatioRange.min && 
        aspectRatio <= config.aspectRatioRange.max) {
      return config.id;
    }
  }
  
  // Fallback: find the closest match by aspect ratio
  let closestFormat = FORMAT_CONFIGS[0];
  let closestDiff = Math.abs(aspectRatio - closestFormat.aspectRatio);
  
  for (const config of FORMAT_CONFIGS) {
    const diff = Math.abs(aspectRatio - config.aspectRatio);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestFormat = config;
    }
  }
  
  return closestFormat?.id || '9:16';
}

/**
 * Check if a format ID is valid
 */
export function isValidFormat(id: string): boolean {
  return FORMAT_CONFIGS.some(f => f.id === id);
}

/**
 * Get format label for display
 */
export function getFormatLabel(id: string): string {
  return getFormatById(id)?.label || id;
}

/**
 * Get the number of supported formats
 */
export function getFormatCount(): number {
  return FORMAT_CONFIGS.length;
}
