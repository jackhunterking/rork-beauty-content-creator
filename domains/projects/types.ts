/**
 * Projects Domain Types
 * 
 * Types for project/draft management.
 */

import type { CapturedSlots } from '@/domains/editor/types';
import type { Overlay } from '@/types/overlays';

/**
 * Project data structure for the new unified slot_data column
 */
export interface Project {
  id: string;
  userId: string;
  templateId: string;
  projectName: string | null;
  
  // Unified slot data - THE single source of truth
  slotData: CapturedSlots;
  
  // Canvas appearance
  backgroundColor: string | null;
  themeColor: string | null;
  
  // Rendered preview
  renderedPreviewUrl: string | null;
  wasRenderedAsPremium: boolean | null;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Local-only fields (not stored in DB)
  localPreviewPath?: string | null;
  overlays?: Overlay[];
}

/**
 * Database row type for drafts (snake_case from Supabase)
 * Updated to include new slot_data column
 */
export interface ProjectRow {
  id: string;
  user_id: string;
  template_id: string;
  project_name: string | null;
  
  // NEW: Unified slot data
  slot_data: CapturedSlots | null;
  
  // Legacy fields (kept for backward compatibility during migration)
  before_image_url: string | null;
  after_image_url: string | null;
  captured_image_urls: Record<string, string> | null;
  captured_image_adjustments: Record<string, { scale: number; translateX: number; translateY: number; rotation: number }> | null;
  captured_image_background_info: Record<string, {
    type: 'solid' | 'gradient' | 'transparent';
    solidColor?: string;
    gradient?: {
      type: 'linear';
      colors: [string, string];
      direction: 'vertical' | 'horizontal' | 'diagonal-tl' | 'diagonal-tr';
    };
  }> | null;
  
  // Canvas appearance
  background_overrides: Record<string, string> | null;
  theme_color: string | null;
  
  // Rendered preview
  rendered_preview_url: string | null;
  was_rendered_as_premium: boolean | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Options for saving a project
 */
export interface SaveProjectOptions {
  projectId?: string | null;
  templateId: string;
  projectName?: string | null;
  slotData: CapturedSlots;
  backgroundColor?: string | null;
  themeColor?: string | null;
  renderedPreviewUrl?: string | null;
  wasRenderedAsPremium?: boolean;
}

/**
 * Options for loading a project
 */
export interface LoadProjectResult {
  project: Project;
  overlays: Overlay[];
}
