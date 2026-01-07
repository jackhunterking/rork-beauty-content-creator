import { supabase } from '@/lib/supabase';
import { Template, TemplateRow, TemplateFormat } from '@/types';

// Default placeholder image for slots without custom placeholders
const DEFAULT_BEFORE_PLACEHOLDER = 'https://placehold.co/400x600/1a1a1a/ffffff?text=%2B%0ABefore';
const DEFAULT_AFTER_PLACEHOLDER = 'https://placehold.co/400x600/1a1a1a/ffffff?text=%2B%0AAfter';

/**
 * Convert database row (snake_case) to Template type (camelCase)
 * Exported for use by real-time subscription hooks
 */
export function mapRowToTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    // Use templated_preview_url if available, otherwise fall back to thumbnail
    thumbnail: row.templated_preview_url || row.thumbnail,
    canvasWidth: row.canvas_width,
    canvasHeight: row.canvas_height,
    backgroundUrl: row.background_url || undefined,
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
    format: (row.format || 'square') as TemplateFormat,
    createdAt: row.created_at,
    // Templated.io integration fields
    templatedId: row.templated_id || undefined,
    templatedPreviewUrl: row.templated_preview_url || undefined,
    // Frame preview URL - template with slot layers hidden for clean editor background
    framePreviewUrl: row.frame_preview_url || undefined,
    // Source of truth for dynamic slots
    layersJson: row.layers_json || undefined,
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
