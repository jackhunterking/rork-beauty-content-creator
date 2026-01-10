import { supabase } from '@/lib/supabase';
import { PortfolioItem, PortfolioRow, TemplateFormat, PublishPlatform } from '@/types';

/**
 * Convert database row (snake_case) to PortfolioItem type (camelCase)
 */
function mapRowToPortfolioItem(row: PortfolioRow): PortfolioItem {
  return {
    id: row.id,
    draftId: row.draft_id || undefined,
    templateId: row.template_id,
    templateName: row.template_name,
    imageUrl: row.image_url,
    localPath: row.local_path || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    format: row.format as TemplateFormat,
    hasWatermark: row.has_watermark,
    publishedTo: row.published_to as PublishPlatform[],
    createdAt: row.created_at,
  };
}

/**
 * Fetch all portfolio items, sorted by creation date (most recent first)
 */
export async function fetchPortfolioItems(): Promise<PortfolioItem[]> {
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching portfolio items:', error);
    throw error;
  }

  return (data as PortfolioRow[]).map(mapRowToPortfolioItem);
}

/**
 * Fetch a single portfolio item by ID
 */
export async function getPortfolioItem(id: string): Promise<PortfolioItem | null> {
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching portfolio item:', error);
    throw error;
  }

  return mapRowToPortfolioItem(data as PortfolioRow);
}

/**
 * Create a new portfolio item
 * Called when user completes the publish flow
 */
export async function createPortfolioItem(item: Omit<PortfolioItem, 'id' | 'createdAt'>): Promise<PortfolioItem> {
  const { data, error } = await supabase
    .from('portfolio')
    .insert({
      draft_id: item.draftId || null,
      template_id: item.templateId,
      template_name: item.templateName,
      image_url: item.imageUrl,
      local_path: item.localPath || null,
      thumbnail_url: item.thumbnailUrl || null,
      format: item.format,
      has_watermark: item.hasWatermark,
      published_to: item.publishedTo,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating portfolio item:', error);
    throw error;
  }

  return mapRowToPortfolioItem(data as PortfolioRow);
}

/**
 * Update a portfolio item's published platforms
 * Used when user shares to additional platforms
 */
export async function updatePortfolioItemPlatforms(
  id: string,
  newPlatform: PublishPlatform
): Promise<PortfolioItem> {
  // First get current platforms
  const current = await getPortfolioItem(id);
  if (!current) {
    throw new Error('Portfolio item not found');
  }

  // Add new platform if not already present
  const updatedPlatforms = current.publishedTo.includes(newPlatform)
    ? current.publishedTo
    : [...current.publishedTo, newPlatform];

  const { data, error } = await supabase
    .from('portfolio')
    .update({ published_to: updatedPlatforms })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating portfolio item:', error);
    throw error;
  }

  return mapRowToPortfolioItem(data as PortfolioRow);
}

/**
 * Delete a portfolio item
 */
export async function deletePortfolioItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('portfolio')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting portfolio item:', error);
    throw error;
  }
}

/**
 * Get portfolio item count
 */
export async function getPortfolioCount(): Promise<number> {
  const { count, error } = await supabase
    .from('portfolio')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error getting portfolio count:', error);
    return 0;
  }

  return count || 0;
}
