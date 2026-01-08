export type ContentType = 'single' | 'carousel' | 'video';
export type TemplateFormat = 'square' | 'vertical';

// ============================================
// Slot State Management (NEW)
// ============================================

/**
 * State machine for individual slot loading/rendering
 * Used for per-slot loading indicators in the editor
 */
export type SlotState = 
  | 'empty'           // No photo yet
  | 'capturing'       // Camera/picker open
  | 'processing'      // Cropping, resizing locally
  | 'uploading'       // Uploading to Supabase for API access
  | 'rendering'       // Waiting for Templated.io
  | 'ready'           // Photo captured and processed
  | 'error';          // Something failed

/**
 * Extended slot state with error info
 */
export interface SlotStateInfo {
  state: SlotState;
  errorMessage?: string;
  progress?: number;  // 0-100 for upload/render progress
}

/**
 * Map of slot IDs to their current state
 */
export type SlotStates = Record<string, SlotStateInfo>;

// ============================================
// Local Draft System (NEW)
// ============================================

/**
 * Local-first draft stored in device file system
 * Replaces Supabase-based drafts for privacy and offline support
 */
export interface LocalDraft {
  id: string;
  templateId: string;
  templatedId?: string;  // Templated.io template ID for rendering
  createdAt: string;
  updatedAt: string;
  
  // Slot images stored locally
  // Map of slotId -> relative path within draft folder
  slots: Record<string, LocalSlotImage>;
  
  // Cached renders for different themes
  // Map of themeId -> relative path to rendered image
  cachedRenders: Record<string, string>;
  
  // Currently selected theme
  selectedTheme: string;
  
  // Optional theme customizations (future)
  themeCustomizations?: Record<string, ThemeOverride>;
}

/**
 * Information about a locally stored slot image
 */
export interface LocalSlotImage {
  localPath: string;      // Full path to image file
  originalWidth: number;
  originalHeight: number;
  capturedAt: string;     // ISO timestamp
}

/**
 * Lightweight draft metadata for index/listing
 */
export interface LocalDraftIndex {
  id: string;
  templateId: string;
  templateName: string;
  thumbnailPath?: string;  // Path to first slot image for preview
  slotCount: number;
  filledSlotCount: number;
  hasRender: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Theme System (NEW - Future Ready)
// ============================================

/**
 * Theme definition for template customization
 * Each template can have multiple themes with different colors
 */
export interface TemplateTheme {
  id: string;
  name: string;
  preview: string;  // Color hex or preview image URL
  
  // Layer color overrides
  // Map of layerId -> color value
  layerColors: Record<string, string>;
}

/**
 * User-applied theme customizations
 */
export interface ThemeOverride {
  layerId: string;
  color?: string;
  text?: string;
}

// ============================================
// Editor State (NEW)
// ============================================

/**
 * Current editor/preview state
 */
export type EditorState =
  | 'editing'          // User is adding/changing photos
  | 'preview_loading'  // Composed preview is being generated
  | 'preview_ready'    // Full composed image ready to download
  | 'downloading'      // Saving/sharing in progress
  | 'error';

/**
 * Complete editor session state
 */
export interface EditorSession {
  draftId: string;
  templateId: string;
  state: EditorState;
  slotStates: SlotStates;
  composedPreviewPath?: string;
  selectedTheme: string;
  errorMessage?: string;
}

// ============================================
// Legacy Theme Interface (Backwards Compatibility)
// ============================================

/**
 * @deprecated Use TemplateTheme instead
 */
export interface Theme {
  id: string;
  thumbnail: string;
  supports: ContentType[];
  isFavourite: boolean;
}

// ============================================
// Slot & Template Types
// ============================================

// Legacy Image slot with dimensions, position, and placeholder
// Kept for backwards compatibility - use Slot instead
export interface ImageSlot {
  // Dimensions for camera overlay aspect ratio
  width: number;        // pixels
  height: number;       // pixels
  
  // Position on canvas (percentage-based, 0-100)
  xPercent: number;     // position from left
  yPercent: number;     // position from top
  
  // Placeholder image URL (designed to look like a button)
  placeholderUrl: string;
}

// Dynamic slot extracted from layers_json
// Any layer with "slot" in the name is a replaceable slot
export interface Slot {
  layerId: string;        // e.g., "slot-before", "slot-after", "slot-hero"
  label: string;          // Human-readable: "Before", "After", "Hero"
  x: number;              // Position on canvas (pixels)
  y: number;
  width: number;          // Slot dimensions (pixels)
  height: number;
  placeholderUrl?: string;
  captureOrder: number;   // Order in capture flow (1, 2, 3...)
}

// Captured images keyed by layer ID
// e.g., { "slot-before": MediaAsset, "slot-after": MediaAsset }
export type CapturedImages = Record<string, MediaAsset | null>;

// Template with canvas and slot specifications
export interface Template {
  id: string;
  name: string;
  thumbnail: string;
  
  // Canvas dimensions (fixed pixels) - overall output size
  canvasWidth: number;
  canvasHeight: number;
  
  // Optional background image (frame design, branding)
  backgroundUrl?: string;
  
  // Legacy slot definitions - kept for backwards compatibility
  // Use layersJson and extractSlots() for dynamic slot support
  beforeSlot?: ImageSlot;
  afterSlot?: ImageSlot;
  
  // Content type support
  supports: ContentType[];
  isFavourite: boolean;
  isActive: boolean;
  
  // Template format (aspect ratio category)
  format: TemplateFormat;
  
  createdAt: string;
  
  // Templated.io integration fields
  templatedId?: string;
  templatedPreviewUrl?: string;
  
  // Frame preview URL - optional fallback when templatedPreviewUrl isn't available
  // Not actively used in new architecture - Templated.io handles all rendering
  framePreviewUrl?: string;
  
  // Source of truth for all layers - slots are extracted from this
  layersJson?: TemplatedLayer[];
  
  // Available themes for this template (future)
  themes?: TemplateTheme[];
}

// Templated.io layer structure
export interface TemplatedLayer {
  layer: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  image_url?: string;
  text?: string;
  color?: string;
  fill?: string;
  // Other properties can be added as needed
  [key: string]: unknown;
}

// Database row type (snake_case from Supabase)
export interface TemplateRow {
  id: string;
  name: string;
  thumbnail: string;
  canvas_width: number;
  canvas_height: number;
  background_url: string | null;
  // Legacy before slot - kept for backwards compatibility
  before_slot_width: number;
  before_slot_height: number;
  before_slot_x_percent: number;
  before_slot_y_percent: number;
  before_placeholder_url: string | null;
  // Legacy after slot - kept for backwards compatibility
  after_slot_width: number;
  after_slot_height: number;
  after_slot_x_percent: number;
  after_slot_y_percent: number;
  after_placeholder_url: string | null;
  // Other fields
  supports: ContentType[];
  is_active: boolean;
  is_favourite: boolean;
  format: string;
  created_at: string;
  // Templated.io integration fields
  templated_id: string | null;
  templated_preview_url: string | null;
  // Frame preview URL - optional fallback
  frame_preview_url: string | null;
  // Source of truth for layers
  layers_json: TemplatedLayer[] | null;
}

// ============================================
// Draft Types (Legacy Supabase - for migration)
// ============================================

/**
 * @deprecated Use LocalDraft for new implementations
 * Kept for migration from Supabase-based drafts
 */
export interface Draft {
  id: string;
  templateId: string;
  // Legacy fields - kept for backwards compatibility
  beforeImageUrl: string | null;  // Supabase Storage URL
  afterImageUrl: string | null;   // Supabase Storage URL
  // Dynamic captured images keyed by slot layer ID
  // e.g., { "slot-before": "url", "slot-after": "url" }
  capturedImageUrls?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  // Cached preview URL from Templated.io (avoids re-rendering on draft load)
  renderedPreviewUrl?: string | null;
  // Premium status when preview was rendered (for cache invalidation)
  wasRenderedAsPremium?: boolean | null;
}

// Database row type for drafts
export interface DraftRow {
  id: string;
  template_id: string;
  // Legacy fields - kept for backwards compatibility
  before_image_url: string | null;
  after_image_url: string | null;
  // Dynamic captured images as JSONB
  captured_image_urls: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  // Cached preview URL from Templated.io
  rendered_preview_url: string | null;
  // Premium status when preview was rendered
  was_rendered_as_premium: boolean | null;
}

// ============================================
// Media & Asset Types
// ============================================

export interface MediaAsset {
  uri: string;
  width: number;
  height: number;
  adjustments?: {
    translateX: number;
    translateY: number;
    scale: number;
  };
}

export interface Project {
  id: string;
  contentType: 'single' | 'carousel';
  themeId: string;
  beforeMedia: MediaAsset;
  afterMedia: MediaAsset;
  outputs: SavedAsset[];
  createdAt: string;
}

export interface SavedAsset {
  id: string;
  type: 'single' | 'carousel';
  projectId: string;
  themeId: string;
  thumbnailUri: string;
  outputUris: string[];
  createdAt: string;
  /** @deprecated Credits removed - subscription model now */
  creditCost?: number;
}

// ============================================
// Credits (DEPRECATED - Subscription Model)
// ============================================

/**
 * @deprecated Credits system removed - using subscription model
 */
export interface UserCredits {
  balance: number;
  history: CreditTransaction[];
}

/**
 * @deprecated Credits system removed - using subscription model
 */
export interface CreditTransaction {
  id: string;
  amount: number;
  type: 'purchase' | 'spend' | 'refund';
  description: string;
  timestamp: string;
}

// ============================================
// Brand Kit & User Preferences
// ============================================

export interface BrandKit {
  logoUri?: string;
  primaryColor?: string;
  applyLogoAutomatically: boolean;
  addDisclaimer: boolean;
}

// ============================================
// Render Types
// ============================================

/**
 * Result from render operation
 */
export interface RenderResult {
  success: boolean;
  localPath?: string;      // Local cached file path
  renderUrl?: string;      // Original Templated.io URL
  fromCache: boolean;      // Whether result came from cache
  error?: string;
}

/**
 * Progress update during render
 */
export interface RenderProgress {
  stage: 'checking_cache' | 'uploading' | 'rendering' | 'downloading' | 'caching' | 'complete' | 'error';
  progress?: number;  // 0-100
  message?: string;
}
