export type ContentType = 'single' | 'carousel' | 'video';

// Legacy Theme interface - kept for backwards compatibility
export interface Theme {
  id: string;
  thumbnail: string;
  supports: ContentType[];
  isFavourite: boolean;
}

// Image slot with dimensions, position, and placeholder
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
  
  // Slot definitions with positions and placeholders
  beforeSlot: ImageSlot;
  afterSlot: ImageSlot;
  
  // Content type support
  supports: ContentType[];
  isFavourite: boolean;
  isActive: boolean;
  
  createdAt: string;
}

// Database row type (snake_case from Supabase)
export interface TemplateRow {
  id: string;
  name: string;
  thumbnail: string;
  canvas_width: number;
  canvas_height: number;
  background_url: string | null;
  // Before slot
  before_slot_width: number;
  before_slot_height: number;
  before_slot_x_percent: number;
  before_slot_y_percent: number;
  before_placeholder_url: string | null;
  // After slot
  after_slot_width: number;
  after_slot_height: number;
  after_slot_x_percent: number;
  after_slot_y_percent: number;
  after_placeholder_url: string | null;
  // Other fields
  supports: ContentType[];
  is_active: boolean;
  is_favourite: boolean;
  created_at: string;
}

// Draft for save-for-later functionality
export interface Draft {
  id: string;
  templateId: string;
  beforeImageUri: string | null;
  afterImageUri: string | null;
  createdAt: string;
  updatedAt: string;
}

// Database row type for drafts
export interface DraftRow {
  id: string;
  template_id: string;
  before_image_uri: string | null;
  after_image_uri: string | null;
  created_at: string;
  updated_at: string;
}

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
  creditCost: number;
}

export interface UserCredits {
  balance: number;
  history: CreditTransaction[];
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: 'purchase' | 'spend' | 'refund';
  description: string;
  timestamp: string;
}

export interface BrandKit {
  logoUri?: string;
  primaryColor?: string;
  applyLogoAutomatically: boolean;
  addDisclaimer: boolean;
}
