export type ContentType = 'single' | 'carousel' | 'video';
export type TemplateFormat = '4:5' | '1:1' | '9:16';

// ============================================
// Platform & Publishing Types
// ============================================

/**
 * Platform types for sharing/downloading content
 * Simplified to just download and share until native sharing is implemented
 */
export type PublishPlatform = 'download' | 'share';

/**
 * Platform option for the publish screen
 */
export interface PlatformOption {
  id: PublishPlatform;
  name: string;
  icon: string;
  supportedFormats: TemplateFormat[];
}

// ============================================
// Portfolio Types
// ============================================

/**
 * Portfolio item - created when user completes publish flow
 * Represents finished creations that appear in the Portfolio tab
 */
export interface PortfolioItem {
  id: string;
  draftId?: string;
  templateId: string;
  templateName: string;
  
  // Rendered image
  imageUrl: string;
  localPath?: string;
  thumbnailUrl?: string;
  
  // Metadata
  format: TemplateFormat;
  hasWatermark: boolean;
  
  // Export tracking - which platforms it was published to
  publishedTo: PublishPlatform[];
  
  createdAt: string;
}

/**
 * Database row type for portfolio (snake_case from Supabase)
 */
export interface PortfolioRow {
  id: string;
  draft_id: string | null;
  template_id: string;
  template_name: string;
  image_url: string;
  local_path: string | null;
  thumbnail_url: string | null;
  format: string;
  has_watermark: boolean;
  published_to: string[];
  created_at: string;
}

/**
 * Params passed to the publish screen
 */
export interface PublishScreenParams {
  draftId?: string;
  templateId: string;
  templateName: string;
  previewUri: string;
  format: TemplateFormat;
  hasWatermark: string; // "true" or "false" as string for URL params
}

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
// Camera Capture Types
// ============================================

/**
 * Frame position data for position-aware image cropping
 * Used to ensure captured image matches camera preview exactly
 * 
 * The camera preview displays a zoomed/cropped version of the camera sensor
 * due to aspect ratio differences between the screen and sensor.
 * This data allows us to map from screen coordinates to sensor coordinates
 * to crop the exact region the user saw in the preview.
 */
export interface FramePositionInfo {
  // Frame position and dimensions on screen (pixels)
  frameTop: number;      // Frame Y position from screen top
  frameLeft: number;     // Frame X position from screen left
  frameWidth: number;    // Frame width on screen
  frameHeight: number;   // Frame height on screen
  
  // Screen dimensions (pixels)
  screenWidth: number;   // Total screen width
  screenHeight: number;  // Total screen height
}

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
  updatedAt: string;
  
  // Templated.io integration fields
  templatedId?: string;
  templatedPreviewUrl?: string;
  
  // Frame preview URL - optional fallback when templatedPreviewUrl isn't available
  // Not actively used in new architecture - Templated.io handles all rendering
  framePreviewUrl?: string;
  
  // Preview WITH watermark visible - shown to free users in Editor before adding photos
  watermarkedPreviewUrl?: string;
  
  // Source of truth for all layers - slots are extracted from this
  layersJson?: TemplatedLayer[];
  
  // Available themes for this template (future)
  themes?: TemplateTheme[];
  
  // Whether this template requires Pro subscription
  isPremium: boolean;
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
  updated_at: string;
  // Templated.io integration fields
  templated_id: string | null;
  templated_preview_url: string | null;
  // Frame preview URL - optional fallback
  frame_preview_url: string | null;
  // Preview with watermark visible - shown to free users in Editor
  watermarked_preview_url: string | null;
  // Source of truth for layers
  layers_json: TemplatedLayer[] | null;
  // Whether this template requires Pro subscription
  is_premium: boolean;
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
  // Local file path to cached preview image (client-side only, not in Supabase)
  // Used for instant preview display without network requests
  localPreviewPath?: string | null;
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

/**
 * @deprecated Use PortfolioItem instead
 * Kept for backwards compatibility during migration
 */
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
// Authentication & User Profile
// ============================================

/**
 * User profile from Supabase profiles table
 */
export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  businessName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  // Onboarding survey data
  industry?: string;
  goal?: string;
  onboardingCompletedAt?: string;
}

/**
 * Database row type for profiles (snake_case from Supabase)
 */
export interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  business_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  // Onboarding survey data
  industry: string | null;
  goal: string | null;
  onboarding_completed_at: string | null;
}

/**
 * Onboarding survey data collected from Superwall
 */
export interface OnboardingSurveyData {
  industry: string;
  goal: string;
}

/**
 * Industry options for onboarding survey
 */
export type OnboardingIndustry = 
  | 'beauty_wellness'
  | 'medical_aesthetic'
  | 'body_art'
  | 'fitness_health'
  | 'photography'
  | 'other';

/**
 * Goal options for onboarding survey (single selection)
 */
export type OnboardingGoal = 
  | 'get_customers'
  | 'online_presence'
  | 'showcase_work'
  | 'stand_out';

/**
 * Auth provider types supported
 */
export type AuthProvider = 'apple' | 'google' | 'email';

/**
 * Auth state for the application
 */
export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Sign in result from auth operations
 */
export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
}

/**
 * App preferences stored locally
 */
export interface AppPreferences {
  defaultFormat: '1:1' | '9:16';
  hapticFeedback: boolean;
  showWatermarkWarning: boolean;
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
