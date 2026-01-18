import { supabase } from '@/lib/supabase';
import { PortfolioItem, PortfolioRow, TemplateFormat, PublishPlatform } from '@/types';

/**
 * Supported format values for portfolio items
 * Must match the database constraint in portfolio table
 */
const SUPPORTED_FORMATS: readonly TemplateFormat[] = ['4:5', '1:1', '9:16'] as const;

/**
 * Helper to get the current authenticated user ID
 * Throws an error if no user is authenticated
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('User must be authenticated to access portfolio');
  }
  
  return user.id;
}

/**
 * Convert database row (snake_case) to PortfolioItem type (camelCase)
 */
function mapRowToPortfolioItem(row: PortfolioRow): PortfolioItem {
  return {
    id: row.id,
    userId: row.user_id,
    draftId: row.draft_id || undefined,
    templateId: row.template_id,
    templateName: row.template_name,
    imageUrl: row.image_url,
    localPath: row.local_path || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    format: row.format as TemplateFormat,
    publishedTo: row.published_to as PublishPlatform[],
    createdAt: row.created_at,
  };
}

/**
 * Fetch all portfolio items for the current user, sorted by creation date (most recent first)
 * Note: RLS policies ensure only the user's own items are returned
 */
export async function fetchPortfolioItems(): Promise<PortfolioItem[]> {
  // Ensure user is authenticated (RLS will handle filtering)
  await getCurrentUserId();
  
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
 * Note: RLS policies ensure only the user's own item can be fetched
 */
export async function getPortfolioItem(id: string): Promise<PortfolioItem | null> {
  // Ensure user is authenticated (RLS will handle authorization)
  await getCurrentUserId();
  
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
 * Automatically associates the item with the current user
 */
export async function createPortfolioItem(item: Omit<PortfolioItem, 'id' | 'createdAt' | 'userId'>): Promise<PortfolioItem> {
  // Validate format before attempting database insert
  if (!SUPPORTED_FORMATS.includes(item.format)) {
    throw new Error(`Unsupported format: ${item.format}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
  }
  
  // Get current user ID to associate with the portfolio item
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('portfolio')
    .insert({
      user_id: userId,
      draft_id: item.draftId || null,
      template_id: item.templateId,
      template_name: item.templateName,
      image_url: item.imageUrl,
      local_path: item.localPath || null,
      thumbnail_url: item.thumbnailUrl || null,
      format: item.format,
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
 * Note: RLS policies ensure only the user's own item can be updated
 */
export async function updatePortfolioItemPlatforms(
  id: string,
  newPlatform: PublishPlatform
): Promise<PortfolioItem> {
  // Ensure user is authenticated (RLS will handle authorization)
  await getCurrentUserId();
  
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
 * Note: RLS policies ensure only the user's own item can be deleted
 */
export async function deletePortfolioItem(id: string): Promise<void> {
  // Ensure user is authenticated (RLS will handle authorization)
  await getCurrentUserId();
  
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
 * Get portfolio item count for the current user
 * Note: RLS policies ensure only the user's own items are counted
 */
export async function getPortfolioCount(): Promise<number> {
  // Ensure user is authenticated (RLS will handle filtering)
  await getCurrentUserId();
  
  const { count, error } = await supabase
    .from('portfolio')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error getting portfolio count:', error);
    return 0;
  }

  return count || 0;
}
