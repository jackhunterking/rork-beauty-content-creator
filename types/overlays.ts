/**
 * Overlay Types for Pro Features
 * 
 * Defines types for text (date, custom) and logo overlays
 * that can be added to the editor canvas as Pro features.
 */

// ============================================
// Transform & Position Types
// ============================================

/**
 * Overlay position and transform data
 * Position values are ratios (0-1) relative to canvas size
 */
export interface OverlayTransform {
  x: number;           // Position from left (0-1 ratio)
  y: number;           // Position from top (0-1 ratio)
  scale: number;       // 1 = original size
  rotation: number;    // Degrees (-180 to 180)
}

/**
 * Default transform values for new overlays
 */
export const DEFAULT_TRANSFORM: OverlayTransform = {
  x: 0.5,      // Center horizontally
  y: 0.5,      // Center vertically
  scale: 1,
  rotation: 0,
};

// ============================================
// Overlay Types
// ============================================

export type OverlayType = 'text' | 'date' | 'logo';

/**
 * Base overlay interface - all overlays extend this
 */
export interface BaseOverlay {
  id: string;
  type: OverlayType;
  transform: OverlayTransform;
  createdAt: string;
  updatedAt: string;
}

/**
 * Text overlay - for custom free text
 */
export interface TextOverlay extends BaseOverlay {
  type: 'text';
  content: string;
  fontFamily: FontFamily;
  fontSize: number;        // In points, relative to canvas
  color: string;           // Hex color
  textShadow?: boolean;    // Add shadow for visibility
  backgroundColor?: string; // Background color (hex or 'transparent')
  backgroundPadding?: number; // Padding around text when background is set
  backgroundBorderRadius?: number; // Border radius for background
}

/**
 * Date overlay - formatted date text
 */
export interface DateOverlay extends BaseOverlay {
  type: 'date';
  date: string;            // ISO date string
  format: DateFormat;
  fontFamily: FontFamily;
  fontSize: number;
  color: string;
  textShadow?: boolean;
  backgroundColor?: string; // Background color (hex or 'transparent')
  backgroundPadding?: number; // Padding around text when background is set
  backgroundBorderRadius?: number; // Border radius for background
}

/**
 * Logo overlay - image overlay
 */
export interface LogoOverlay extends BaseOverlay {
  type: 'logo';
  imageUri: string;        // Local file URI or remote URL
  originalWidth: number;   // Original image width
  originalHeight: number;  // Original image height
  isBrandKit: boolean;     // Whether this is from Brand Kit
}

/**
 * Union type for all overlay types
 */
export type Overlay = TextOverlay | DateOverlay | LogoOverlay;

// ============================================
// Font Types
// ============================================

/**
 * Available font families for text overlays
 * These should be available on both iOS and Android
 */
export type FontFamily = 
  | 'System'           // SF Pro on iOS, Roboto on Android
  | 'Helvetica'
  | 'Georgia'
  | 'Playfair'
  | 'Montserrat'
  | 'Roboto'
  | 'Lato'
  | 'OpenSans'
  | 'PTSerif'
  | 'Oswald';

/**
 * Font family display names and actual font names
 */
export const FONT_OPTIONS: { id: FontFamily; label: string; fontName: string }[] = [
  { id: 'System', label: 'System', fontName: 'System' },
  { id: 'Helvetica', label: 'Helvetica', fontName: 'Helvetica' },
  { id: 'Georgia', label: 'Georgia', fontName: 'Georgia' },
  { id: 'Playfair', label: 'Playfair', fontName: 'PlayfairDisplay-Regular' },
  { id: 'Montserrat', label: 'Montserrat', fontName: 'Montserrat-Regular' },
  { id: 'Roboto', label: 'Roboto', fontName: 'Roboto-Regular' },
  { id: 'Lato', label: 'Lato', fontName: 'Lato-Regular' },
  { id: 'OpenSans', label: 'Open Sans', fontName: 'OpenSans-Regular' },
  { id: 'PTSerif', label: 'PT Serif', fontName: 'PTSerif-Regular' },
  { id: 'Oswald', label: 'Oswald', fontName: 'Oswald-Regular' },
];

// ============================================
// Date Format Types
// ============================================

/**
 * Available date formats for date overlays
 */
export type DateFormat = 
  | 'short'        // 1/12/26
  | 'medium'       // Jan 12, 2026
  | 'long'         // January 12, 2026
  | 'iso'          // 2026-01-12
  | 'european';    // 12/01/2026

/**
 * Date format options with labels and examples
 */
export const DATE_FORMAT_OPTIONS: { id: DateFormat; label: string; example: string }[] = [
  { id: 'short', label: 'Short', example: '1/12/26' },
  { id: 'medium', label: 'Medium', example: 'Jan 12, 2026' },
  { id: 'long', label: 'Long', example: 'January 12, 2026' },
  { id: 'iso', label: 'ISO', example: '2026-01-12' },
  { id: 'european', label: 'European', example: '12/01/2026' },
];

/**
 * Format a date according to the specified format
 */
export function formatDate(date: Date, format: DateFormat): string {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const shortYear = year.toString().slice(-2);
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const shortMonthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  switch (format) {
    case 'short':
      return `${month + 1}/${day}/${shortYear}`;
    case 'medium':
      return `${shortMonthNames[month]} ${day}, ${year}`;
    case 'long':
      return `${monthNames[month]} ${day}, ${year}`;
    case 'iso':
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'european':
      return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
    default:
      return `${monthNames[month]} ${day}, ${year}`;
  }
}

// ============================================
// Color Presets
// ============================================

/**
 * Preset colors for text overlays
 */
export const COLOR_PRESETS: string[] = [
  '#FFFFFF',  // White
  '#000000',  // Black
  '#1A1A1A',  // Near Black
  '#F5F5F5',  // Off White
  '#E74C3C',  // Red
  '#E91E63',  // Pink
  '#9C27B0',  // Purple
  '#3F51B5',  // Indigo
  '#2196F3',  // Blue
  '#00BCD4',  // Cyan
  '#009688',  // Teal
  '#4CAF50',  // Green
  '#8BC34A',  // Light Green
  '#CDDC39',  // Lime
  '#FFEB3B',  // Yellow
  '#FFC107',  // Amber
  '#FF9800',  // Orange
  '#FF5722',  // Deep Orange
  '#795548',  // Brown
  '#9E9E9E',  // Grey
];

/**
 * Preset colors for background (includes transparent option)
 * Ordered by most useful: none, then solids with good contrast, then semi-transparent
 */
export const BACKGROUND_COLOR_PRESETS: (string | null)[] = [
  null,       // Transparent/None
  '#000000',  // Black (high contrast, most popular)
  '#FFFFFF',  // White (high contrast, most popular)
  '#1A1A1A',  // Near Black (elegant dark)
  '#F5F5F5',  // Off White (soft light)
  '#00000099', // Semi-transparent black (90% opacity - readable)
  '#FFFFFFCC', // Semi-transparent white (80% opacity - readable)
  '#E74C3C',  // Red
  '#FF9800',  // Orange
  '#FFEB3B',  // Yellow
  '#4CAF50',  // Green
  '#2196F3',  // Blue
  '#9C27B0',  // Purple
  '#E91E63',  // Pink
  '#795548',  // Brown (earthy tone)
  '#607D8B',  // Blue Grey (professional)
];

/**
 * Background styling constraints
 */
export const BACKGROUND_CONSTRAINTS = {
  minPadding: 4,
  maxPadding: 24,
  defaultPadding: 8,
  minBorderRadius: 0,
  maxBorderRadius: 20,
  defaultBorderRadius: 6,
};

// ============================================
// Size Constraints
// ============================================

/**
 * Font size range constraints (in points)
 */
export const FONT_SIZE_CONSTRAINTS = {
  min: 12,
  max: 120,
  default: 32,
  step: 2,
};

/**
 * Logo size constraints (as ratio of canvas width)
 */
export const LOGO_SIZE_CONSTRAINTS = {
  minScale: 0.1,    // 10% of original
  maxScale: 3.0,    // 300% of original
  defaultScale: 1.0,
};

// ============================================
// Default Values
// ============================================

/**
 * Default text overlay configuration
 */
export const DEFAULT_TEXT_OVERLAY: Omit<TextOverlay, 'id' | 'createdAt' | 'updatedAt'> = {
  type: 'text',
  content: 'Your Text',
  fontFamily: 'System',
  fontSize: 32,
  color: '#FFFFFF',
  textShadow: true,
  backgroundColor: undefined, // No background by default
  backgroundPadding: BACKGROUND_CONSTRAINTS.defaultPadding,
  backgroundBorderRadius: BACKGROUND_CONSTRAINTS.defaultBorderRadius,
  transform: { ...DEFAULT_TRANSFORM, y: 0.8 }, // Bottom area
};

/**
 * Default date overlay configuration
 */
export const DEFAULT_DATE_OVERLAY: Omit<DateOverlay, 'id' | 'createdAt' | 'updatedAt'> = {
  type: 'date',
  date: new Date().toISOString(),
  format: 'medium',
  fontFamily: 'System',
  fontSize: 24,
  color: '#FFFFFF',
  textShadow: true,
  backgroundColor: undefined, // No background by default
  backgroundPadding: BACKGROUND_CONSTRAINTS.defaultPadding,
  backgroundBorderRadius: BACKGROUND_CONSTRAINTS.defaultBorderRadius,
  transform: { ...DEFAULT_TRANSFORM, x: 0.15, y: 0.9 }, // Bottom left
};

/**
 * Default logo overlay configuration
 */
export const DEFAULT_LOGO_OVERLAY: Omit<LogoOverlay, 'id' | 'createdAt' | 'updatedAt' | 'imageUri' | 'originalWidth' | 'originalHeight'> = {
  type: 'logo',
  isBrandKit: false,
  transform: { ...DEFAULT_TRANSFORM, scale: 1.0 }, // Center position (DEFAULT_TRANSFORM already has x: 0.5, y: 0.5)
};

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique overlay ID
 */
export function generateOverlayId(): string {
  return `overlay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new text overlay with defaults
 */
export function createTextOverlay(overrides?: Partial<TextOverlay>): TextOverlay {
  const now = new Date().toISOString();
  return {
    ...DEFAULT_TEXT_OVERLAY,
    id: generateOverlayId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as TextOverlay;
}

/**
 * Create a new date overlay with defaults
 */
export function createDateOverlay(overrides?: Partial<DateOverlay>): DateOverlay {
  const now = new Date().toISOString();
  return {
    ...DEFAULT_DATE_OVERLAY,
    id: generateOverlayId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as DateOverlay;
}

/**
 * Create a new logo overlay
 */
export function createLogoOverlay(
  imageUri: string,
  originalWidth: number,
  originalHeight: number,
  isBrandKit: boolean = false
): LogoOverlay {
  const now = new Date().toISOString();
  return {
    ...DEFAULT_LOGO_OVERLAY,
    id: generateOverlayId(),
    imageUri,
    originalWidth,
    originalHeight,
    isBrandKit,
    createdAt: now,
    updatedAt: now,
  } as LogoOverlay;
}

/**
 * Check if an overlay is a text-based overlay
 */
export function isTextBasedOverlay(overlay: Overlay): overlay is TextOverlay | DateOverlay {
  return overlay.type === 'text' || overlay.type === 'date';
}

/**
 * Check if an overlay is a logo overlay
 */
export function isLogoOverlay(overlay: Overlay): overlay is LogoOverlay {
  return overlay.type === 'logo';
}

/**
 * Get display text for an overlay (for accessibility)
 */
export function getOverlayDisplayText(overlay: Overlay): string {
  switch (overlay.type) {
    case 'text':
      return overlay.content || 'Text overlay';
    case 'date':
      return formatDate(new Date(overlay.date), overlay.format);
    case 'logo':
      return overlay.isBrandKit ? 'Brand logo' : 'Logo overlay';
    default:
      return 'Overlay';
  }
}
