export type ContentType = 'single' | 'carousel' | 'video';

/**
 * Template format type
 * 
 * Common formats: '4:5', '1:1', '9:16', '16:9'
 * Add new formats in constants/formats.ts - they'll be automatically supported.
 * 
 * Using string type for extensibility while maintaining common format suggestions.
 */
export type TemplateFormat = '4:5' | '1:1' | '9:16' | '16:9' | (string & {});

// Re-export overlay types for convenience
export * from './overlays';

// ============================================
// App Configuration Types (Force Update)
// ============================================

/**
 * App configuration from Supabase for remote control
 * Used for forced updates and other app-wide settings
 */
export interface AppConfig {
  id: string;
  minIosVersion: string;
  minAndroidVersion: string;
  forceUpdateEnabled: boolean;
  updateMessage: string;
  storeUrlIos: string | null;
  storeUrlAndroid: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Database row type for app_config (snake_case from Supabase)
 */
export interface AppConfigRow {
  id: string;
  min_ios_version: string;
  min_android_version: string;
  force_update_enabled: boolean;
  update_message: string;
  store_url_ios: string | null;
  store_url_android: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Force update check result
 */
export interface ForceUpdateStatus {
  isRequired: boolean;
  message: string;
  storeUrl: string | null;
  currentVersion: string;
  minimumVersion: string;
}

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
  userId: string;  // Owner of the portfolio item - links to auth.users
  draftId?: string;
  templateId: string;
  templateName: string;
  
  // Rendered image
  imageUrl: string;
  localPath?: string;
  thumbnailUrl?: string;
  
  // Metadata
  format: TemplateFormat;
  
  // Export tracking - which platforms it was published to
  publishedTo: PublishPlatform[];
  
  createdAt: string;
}

/**
 * Database row type for portfolio (snake_case from Supabase)
 */
export interface PortfolioRow {
  id: string;
  user_id: string;  // Owner of the portfolio item - links to auth.users
  draft_id: string | null;
  template_id: string;
  template_name: string;
  image_url: string;
  local_path: string | null;
  thumbnail_url: string | null;
  format: string;
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
  
  // Source of truth for all layers - slots are extracted from this
  layersJson?: TemplatedLayer[];
  
  // Available themes for this template (future)
  themes?: TemplateTheme[];
  
  // Whether this template requires Pro subscription
  isPremium: boolean;
  
  // List of layer IDs that users can customize the background color of
  customizableBackgroundLayers?: string[];
  
  // PNG URL with transparent slots and background - for client-side compositing
  // Used by LayeredCanvas for zero-API-call background color changes
  frameOverlayUrl?: string;
  
  // Theme layer geometries for client-side rendering
  // Layers with 'theme-' prefix are hidden in frame overlay and rendered as colored shapes
  themeLayers?: ThemeLayer[];
  
  // Default colors for template design (used to initialize editor)
  /** Original background color of template design (hex) */
  defaultBackgroundColor?: string;
  /** Original theme color for theme-prefixed layers (hex) */
  defaultThemeColor?: string;
}

// Templated.io layer structure
export interface TemplatedLayer {
  layer: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  image_url?: string;
  text?: string;
  color?: string;
  fill?: string;
  border_radius?: number;
  // Other properties can be added as needed
  [key: string]: unknown;
}

/**
 * Theme layer geometry for client-side rendering
 * Theme layers are identified by 'theme-' prefix in Templated.io
 * These are rendered as colored shapes that change with the theme color
 */
// ============================================================================
// Theme Layer Types (for client-side rendering of customizable layers)
// ============================================================================

/** Base properties shared by all theme layers */
interface ThemeLayerBase {
  /** Layer ID from Templated.io (e.g., 'theme-before-label') */
  id: string;
  /** X position in template pixels */
  x: number;
  /** Y position in template pixels */
  y: number;
  /** Width in template pixels */
  width: number;
  /** Height in template pixels */
  height: number;
  /** Rotation in degrees */
  rotation?: number;
}

/** Shape theme layer - renders as colored rectangle/background */
export interface ShapeThemeLayer extends ThemeLayerBase {
  type: 'shape';
  /** Border radius in pixels */
  borderRadius?: number;
}

/** Text theme layer - renders as styled, colorable text */
export interface TextThemeLayer extends ThemeLayerBase {
  type: 'text';
  /** The actual text content to display */
  text: string;
  /** Font family name from Templated.io */
  fontFamily?: string;
  /** Font size in pixels (parsed from "58px" format) */
  fontSize?: number;
  /** Font weight (e.g., 'normal', 'bold', '600') */
  fontWeight?: string;
  /** Horizontal text alignment */
  horizontalAlign?: 'left' | 'center' | 'right';
  /** Vertical text alignment */
  verticalAlign?: 'top' | 'center' | 'bottom';
  /** Letter spacing */
  letterSpacing?: number;
}

/** Discriminated union of all theme layer types */
export type ThemeLayer = ShapeThemeLayer | TextThemeLayer;

/** Type guard to check if layer is text type */
export function isTextThemeLayer(layer: ThemeLayer): layer is TextThemeLayer {
  return layer.type === 'text';
}

/** Type guard to check if layer is shape type */
export function isShapeThemeLayer(layer: ThemeLayer): layer is ShapeThemeLayer {
  return layer.type === 'shape' || !('type' in layer);
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
  // Source of truth for layers
  layers_json: TemplatedLayer[] | null;
  // Whether this template requires Pro subscription
  is_premium: boolean;
  // List of layer IDs that users can customize the background color of
  customizable_background_layers: string[] | null;
  // PNG URL with transparent slots and background - for client-side compositing
  frame_overlay_url: string | null;
  // Theme layer geometries for client-side rendering
  theme_layers: ThemeLayer[] | null;
  // Default colors for template design (used to initialize editor)
  default_background_color: string | null;
  default_theme_color: string | null;
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
  userId: string;  // Owner of the draft - links to auth.users
  templateId: string;
  // User-editable project name for personal reference
  // If null, UI shows formatted date as placeholder
  projectName?: string | null;
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
  // Overlays added to the draft (Pro feature, stored locally)
  overlays?: Overlay[];
  // User-customized background layer colors (layerId -> fill color)
  backgroundOverrides?: Record<string, string>;
}

// Database row type for drafts
export interface DraftRow {
  id: string;
  user_id: string;  // Owner of the draft - links to auth.users
  template_id: string;
  // User-editable project name for personal reference
  project_name: string | null;
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
  // User-customized background layer colors (layerId -> fill color)
  background_overrides: Record<string, string> | null;
}

// ============================================
// Background Layer Customization Types
// ============================================

/**
 * Background layer override for custom colors
 */
export interface BackgroundLayerOverride {
  layerId: string;
  fill: string; // Hex color (e.g., "#FF5733")
}

/**
 * Map of layer IDs to their fill color overrides
 */
export type BackgroundOverrides = Record<string, string>;

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
    rotation?: number;
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
  logoWidth?: number;
  logoHeight?: number;
  primaryColor?: string;
  applyLogoAutomatically: boolean;
  addDisclaimer: boolean;
  updatedAt?: string;
}

/**
 * Database row type for brand_kits (snake_case from Supabase)
 */
export interface BrandKitRow {
  id: string;
  user_id: string;
  logo_url: string | null;
  logo_width: number | null;
  logo_height: number | null;
  primary_color: string | null;
  apply_logo_automatically: boolean;
  add_disclaimer: boolean;
  created_at: string;
  updated_at: string;
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
  // Complimentary pro access (admin-granted)
  isComplimentaryPro?: boolean;
  complimentaryProGrantedAt?: string;
  complimentaryProNotes?: string;
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
  // Complimentary pro access (admin-granted)
  is_complimentary_pro: boolean | null;
  complimentary_pro_granted_at: string | null;
  complimentary_pro_notes: string | null;
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

// ============================================
// AI Enhancement Types
// ============================================

/**
 * Available AI feature keys
 * Maps to feature_key in ai_model_config table
 */
export type AIFeatureKey = 'auto_quality' | 'background_remove' | 'background_replace';

/**
 * AI enhancement type for editor (same as AIFeatureKey but more explicit)
 */
export type AIEnhancementType = AIFeatureKey;

/**
 * AI model configuration from Supabase
 * Used to dynamically render available AI features
 */
export interface AIModelConfig {
  featureKey: AIFeatureKey;
  displayName: string;
  description: string;
  icon: string;
  costCredits: number;
  isEnabled: boolean;
  isPremiumOnly: boolean;
  sortOrder: number;
}

/**
 * Database row type for ai_model_config (snake_case from Supabase)
 */
export interface AIModelConfigRow {
  id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  icon: string;
  provider: string;
  model_id: string;
  model_version: string | null;
  endpoint_url: string | null;
  default_params: Record<string, unknown>;
  system_prompt: string | null;
  cost_credits: number;
  is_enabled: boolean;
  is_premium_only: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * User AI credits balance
 */
export interface AICredits {
  creditsRemaining: number;
  creditsUsedThisPeriod: number;
  monthlyAllocation: number;
  periodEnd: string;
  daysUntilReset: number;
}

/**
 * Database row type for ai_credits (snake_case from Supabase)
 */
export interface AICreditsRow {
  id: string;
  user_id: string;
  credits_remaining: number;
  credits_used_this_period: number;
  monthly_allocation: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

/**
 * AI generation status
 */
export type AIGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * AI generation record
 * Tracks individual AI enhancement operations
 */
export interface AIGeneration {
  id: string;
  featureKey: AIFeatureKey;
  status: AIGenerationStatus;
  inputImageUrl: string;
  outputImageUrl?: string;
  creditsCharged: number;
  processingTimeMs?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Database row type for ai_generations (snake_case from Supabase)
 */
export interface AIGenerationRow {
  id: string;
  user_id: string;
  draft_id: string | null;
  slot_id: string | null;
  feature_key: string;
  model_id: string;
  provider: string;
  input_image_url: string;
  output_image_url: string | null;
  input_params: Record<string, unknown>;
  background_preset_id: string | null;
  custom_prompt: string | null;
  status: string;
  error_message: string | null;
  error_code: string | null;
  credits_charged: number;
  estimated_cost_usd: number | null;
  started_at: string;
  completed_at: string | null;
  processing_time_ms: number | null;
  app_version: string | null;
  created_at: string;
}

/**
 * Background preset for AI background replacement
 */
export interface BackgroundPreset {
  id: string;
  name: string;
  category: BackgroundPresetCategory;
  previewUrl?: string;
  previewColor: string;
  isPremium: boolean;
  sortOrder: number;
}

/**
 * Background preset categories
 */
export type BackgroundPresetCategory = 'studio' | 'solid' | 'nature' | 'blur' | 'professional';

/**
 * Database row type for background_presets (snake_case from Supabase)
 */
export interface BackgroundPresetRow {
  id: string;
  name: string;
  category: string;
  prompt: string;
  negative_prompt: string | null;
  preview_url: string | null;
  preview_color: string | null;
  sort_order: number;
  is_premium: boolean;
  is_active: boolean;
  created_at: string;
}

/**
 * Grouped background presets by category
 */
export interface GroupedBackgroundPresets {
  studio: BackgroundPreset[];
  solid: BackgroundPreset[];
  nature: BackgroundPreset[];
  blur: BackgroundPreset[];
  professional: BackgroundPreset[];
}

/**
 * Request payload for AI enhancement
 */
export interface AIEnhanceRequest {
  featureKey: AIFeatureKey;
  imageUrl: string;
  draftId?: string;
  slotId?: string;
  presetId?: string;  // For background_replace
  customPrompt?: string;  // For background_replace with custom prompt
  params?: Record<string, unknown>;
}

/**
 * Response from AI enhancement
 */
export interface AIEnhanceResponse {
  success: boolean;
  generationId: string;
  outputUrl?: string;
  creditsCharged: number;
  creditsRemaining: number;
  processingTimeMs?: number;
  error?: string;
}

/**
 * AI feature check result
 */
export interface AIFeatureCheck {
  hasCredits: boolean;
  creditsRemaining: number;
  creditsRequired: number;
}

/**
 * AI config response from edge function
 */
export interface AIConfigResponse {
  features: AIModelConfig[];
  version: string;
}

/**
 * AI presets response from edge function
 */
export interface AIPresetsResponse {
  presets: BackgroundPreset[];
  grouped: GroupedBackgroundPresets;
}

/**
 * AI processing state for UI feedback
 */
export interface AIProcessingState {
  isProcessing: boolean;
  featureKey?: AIFeatureKey;
  progress?: number;  // 0-100
  message?: string;
}
