import { supabase } from '@/lib/supabase';
import { Template, TemplateRow, TemplateFormat } from '@/types';
import { detectFormatFromDimensions } from '@/constants/formats';

// Default placeholder image for slots without custom placeholders
const DEFAULT_BEFORE_PLACEHOLDER = 'https://placehold.co/400x600/1a1a1a/ffffff?text=%2B%0ABefore';
const DEFAULT_AFTER_PLACEHOLDER = 'https://placehold.co/400x600/1a1a1a/ffffff?text=%2B%0AAfter';

/**
 * Add cache-busting query parameter to image URLs.
 * This forces browsers/CDNs to fetch fresh content when timestamps change.
 * 
 * @param url - The image URL
 * @param timestamp - ISO timestamp string (usually updated_at)
 * @returns URL with cache-busting query parameter, or undefined if no URL
 */
function addCacheBuster(url: string | null | undefined, timestamp: string): string | undefined {
  if (!url) return undefined;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${new Date(timestamp).getTime()}`;
}

// Format detection moved to @/constants/formats.ts for centralized management
// Use: import { detectFormatFromDimensions } from '@/constants/formats';

/**
 * Convert database row (snake_case) to Template type (camelCase)
 * Exported for use by real-time subscription hooks
 * 
 * Applies cache-busting to all image URLs using the updated_at timestamp.
 * This ensures images refresh when templates are updated in the backend.
 */
export function mapRowToTemplate(row: TemplateRow): Template {
  const cacheBuster = row.updated_at;
  
  // Apply cache-busting to image URLs
  const thumbnail = addCacheBuster(row.thumbnail, cacheBuster);
  const templatedPreviewUrl = addCacheBuster(row.templated_preview_url, cacheBuster);
  const watermarkedPreviewUrl = addCacheBuster(row.watermarked_preview_url, cacheBuster);
  const backgroundUrl = addCacheBuster(row.background_url, cacheBuster);
  const framePreviewUrl = addCacheBuster(row.frame_preview_url, cacheBuster);
  
  return {
    id: row.id,
    name: row.name,
    // Thumbnail for Create tab - always clean, no watermark
    // Falls back to templated_preview_url for backwards compatibility
    thumbnail: thumbnail || templatedPreviewUrl || '',
    canvasWidth: row.canvas_width,
    canvasHeight: row.canvas_height,
    backgroundUrl,
    // Legacy slot data - kept for backwards compatibility
    beforeSlot: {
      width: row.before_slot_width,
      height: row.before_slot_height,
      xPercent: row.before_slot_x_percent ?? 5,
      yPercent: row.before_slot_y_percent ?? 20,
      placeholderUrl: row.before_placeholder_url || DEFAULT_BEFORE_PLACEHOLDER,
    },
    afterSlot: {
      width: row.after_slot_width,
      height: row.after_slot_height,
      xPercent: row.after_slot_x_percent ?? 52,
      yPercent: row.after_slot_y_percent ?? 20,
      placeholderUrl: row.after_placeholder_url || DEFAULT_AFTER_PLACEHOLDER,
    },
    supports: row.supports,
    isFavourite: row.is_favourite,
    isActive: row.is_active,
    format: detectFormatFromDimensions(row.canvas_width, row.canvas_height) as TemplateFormat,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Templated.io integration fields
    templatedId: row.templated_id || undefined,
    // Clean preview (no watermark) - used for Pro users in Editor
    templatedPreviewUrl,
    // Watermarked preview - shown to Free users in Editor before adding photos
    watermarkedPreviewUrl,
    // Frame preview URL - optional fallback
    framePreviewUrl,
    // Source of truth for dynamic slots
    layersJson: row.layers_json || undefined,
    // Premium template flag - requires Pro subscription when true
    isPremium: row.is_premium ?? false,
  };
}

/**
 * Fetch all active templates from Supabase
 */
export async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }

  return (data as TemplateRow[]).map(mapRowToTemplate);
}

/**
 * Fetch a single template by ID
 */
export async function fetchTemplateById(id: string): Promise<Template | null> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching template:', error);
    throw error;
  }

  return mapRowToTemplate(data as TemplateRow);
}

/**
 * Toggle favourite status for a template
 */
export async function toggleTemplateFavourite(id: string, isFavourite: boolean): Promise<void> {
  const { error } = await supabase
    .from('templates')
    .update({ is_favourite: isFavourite })
    .eq('id', id);

  if (error) {
    console.error('Error updating template favourite:', error);
    throw error;
  }
}

/**
 * Get favourite templates
 */
export async function fetchFavouriteTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('is_active', true)
    .eq('is_favourite', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching favourite templates:', error);
    throw error;
  }

  return (data as TemplateRow[]).map(mapRowToTemplate);
}
