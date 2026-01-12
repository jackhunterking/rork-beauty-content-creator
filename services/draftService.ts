import { supabase } from '@/lib/supabase';
import { Draft, DraftRow } from '@/types';
import { uploadDraftImage, deleteDraftImages } from './storageService';
import { getLocalPreviewPath, deleteDirectory, getDraftDirectory } from './localStorageService';

/**
 * Helper to check if a URI is already uploaded to Supabase Storage
 * Returns true if the URI is a Supabase storage URL, false if it's a local file
 */
function isSupabaseStorageUrl(uri: string | null | undefined): boolean {
  if (!uri) return false;
  
  // Check for common Supabase storage URL patterns
  // Pattern 1: Contains 'supabase.co/storage'
  // Pattern 2: Contains the project ID followed by '.supabase.co'
  const isSupabaseUrl = (
    uri.includes('supabase.co/storage') ||
    uri.includes('.supabase.co/') ||
    // Also check for direct storage URLs
    (uri.startsWith('https://') && uri.includes('/storage/v1/object/'))
  );
  
  // Local files start with 'file://' or are absolute paths starting with '/'
  const isLocalFile = uri.startsWith('file://') || (uri.startsWith('/') && !uri.startsWith('//'));
  
  // If it's explicitly a local file, it's not a Supabase URL
  if (isLocalFile) return false;
  
  return isSupabaseUrl;
}

/**
 * Convert database row (snake_case) to Draft type (camelCase)
 */
function mapRowToDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    templateId: row.template_id,
    // Legacy fields for backwards compatibility
    beforeImageUrl: row.before_image_url,
    afterImageUrl: row.after_image_url,
    // New dynamic captured images field
    capturedImageUrls: row.captured_image_urls || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Cached preview URL from Templated.io
    renderedPreviewUrl: row.rendered_preview_url || undefined,
    // Premium status when preview was rendered
    wasRenderedAsPremium: row.was_rendered_as_premium ?? undefined,
  };
}

/**
 * Fetch all drafts
 * Also checks for locally cached preview files and adds them to the draft objects
 */
export async function fetchDrafts(): Promise<Draft[]> {
  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching drafts:', error);
    throw error;
  }

  // Map database rows to Draft objects and check for local preview files
  const drafts = (data as DraftRow[]).map(mapRowToDraft);
  
  // Enhance drafts with local preview paths (if they exist)
  const enhancedDrafts = await Promise.all(
    drafts.map(async (draft) => {
      try {
        const localPath = await getLocalPreviewPath(draft.id);
        return {
          ...draft,
          localPreviewPath: localPath,
        };
      } catch {
        // If checking local path fails, just return draft without it
        return draft;
      }
    })
  );

  return enhancedDrafts;
}

/**
 * Fetch a single draft by ID
 * Also checks for locally cached preview file and adds it to the draft object
 */
export async function fetchDraftById(id: string): Promise<Draft | null> {
  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching draft:', error);
    throw error;
  }

  const draft = mapRowToDraft(data as DraftRow);
  
  // Check for local preview path
  try {
    const localPath = await getLocalPreviewPath(id);
    return {
      ...draft,
      localPreviewPath: localPath,
    };
  } catch {
    return draft;
  }
}

/**
 * Fetch draft by template ID (returns the most recent one)
 */
export async function fetchDraftByTemplateId(templateId: string): Promise<Draft | null> {
  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('template_id', templateId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching draft by template:', error);
    throw error;
  }

  return mapRowToDraft(data as DraftRow);
}

/**
 * Create a new draft (without images initially)
 */
export async function createDraft(
  templateId: string,
  beforeImageUrl: string | null = null,
  afterImageUrl: string | null = null,
  capturedImageUrls: Record<string, string> | null = null
): Promise<Draft> {
  const { data, error } = await supabase
    .from('drafts')
    .insert({
      template_id: templateId,
      before_image_url: beforeImageUrl,
      after_image_url: afterImageUrl,
      captured_image_urls: capturedImageUrls,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating draft:', error);
    throw error;
  }

  return mapRowToDraft(data as DraftRow);
}

/**
 * Update an existing draft
 */
export async function updateDraft(
  id: string,
  updates: {
    beforeImageUrl?: string | null;
    afterImageUrl?: string | null;
    capturedImageUrls?: Record<string, string> | null;
    renderedPreviewUrl?: string | null;
    wasRenderedAsPremium?: boolean | null;
  }
): Promise<Draft> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.beforeImageUrl !== undefined) {
    updateData.before_image_url = updates.beforeImageUrl;
  }
  if (updates.afterImageUrl !== undefined) {
    updateData.after_image_url = updates.afterImageUrl;
  }
  if (updates.capturedImageUrls !== undefined) {
    updateData.captured_image_urls = updates.capturedImageUrls;
  }
  if (updates.renderedPreviewUrl !== undefined) {
    updateData.rendered_preview_url = updates.renderedPreviewUrl;
  }
  if (updates.wasRenderedAsPremium !== undefined) {
    updateData.was_rendered_as_premium = updates.wasRenderedAsPremium;
  }

  const { data, error } = await supabase
    .from('drafts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating draft:', error);
    throw error;
  }

  return mapRowToDraft(data as DraftRow);
}

/**
 * Save a draft with images - uploads images to Supabase Storage
 * Supports both legacy before/after format and new dynamic captured images
 * @param templateId - The template ID
 * @param beforeImageUri - Local URI of the before image (or null) - legacy format
 * @param afterImageUri - Local URI of the after image (or null) - legacy format
 * @param existingDraftId - Optional existing draft ID to update
 * @param capturedImageUris - Optional map of slot ID to local URIs - new dynamic format
 * @param renderedPreviewUrl - Optional cached Templated.io preview URL
 * @param wasRenderedAsPremium - Optional premium status when preview was rendered
 * @param localPreviewPath - Optional local file path for cached preview (client-side only, not stored in DB)
 */
export async function saveDraftWithImages(
  templateId: string,
  beforeImageUri: string | null,
  afterImageUri: string | null,
  existingDraftId?: string,
  capturedImageUris?: Record<string, string>,
  renderedPreviewUrl?: string | null,
  wasRenderedAsPremium?: boolean,
  localPreviewPath?: string | null
): Promise<Draft> {
  try {
    let draft: Draft;

    // Create or get existing draft
    if (existingDraftId) {
      const existingDraft = await fetchDraftById(existingDraftId);
      if (!existingDraft) {
        throw new Error('Draft not found');
      }
      draft = existingDraft;
    } else {
      // Check if there's an existing draft for this template
      const existingDraft = await fetchDraftByTemplateId(templateId);
      if (existingDraft) {
        draft = existingDraft;
      } else {
        // Create a new draft first to get the ID
        draft = await createDraft(templateId);
      }
    }

    // Upload images if they are local URIs (not already Supabase URLs)
    let beforeImageUrl = draft.beforeImageUrl;
    let afterImageUrl = draft.afterImageUrl;
    let capturedImageUrls = draft.capturedImageUrls || {};

    // Handle legacy before/after format
    // Upload before image if it's a new local file
    if (beforeImageUri && !isSupabaseStorageUrl(beforeImageUri)) {
      console.log('[DraftService] Uploading before image from local:', beforeImageUri.substring(0, 50));
      beforeImageUrl = await uploadDraftImage(draft.id, beforeImageUri, 'before');
    } else if (beforeImageUri === null) {
      beforeImageUrl = null;
    } else if (beforeImageUri) {
      // Keep existing Supabase URL
      beforeImageUrl = beforeImageUri;
    }

    // Upload after image if it's a new local file
    if (afterImageUri && !isSupabaseStorageUrl(afterImageUri)) {
      console.log('[DraftService] Uploading after image from local:', afterImageUri.substring(0, 50));
      afterImageUrl = await uploadDraftImage(draft.id, afterImageUri, 'after');
    } else if (afterImageUri === null) {
      afterImageUrl = null;
    } else if (afterImageUri) {
      // Keep existing Supabase URL
      afterImageUrl = afterImageUri;
    }

    // Handle new dynamic captured images format
    if (capturedImageUris) {
      for (const [slotId, uri] of Object.entries(capturedImageUris)) {
        if (uri && !isSupabaseStorageUrl(uri)) {
          // Upload new local image
          console.log(`[DraftService] Uploading slot ${slotId} from local:`, uri.substring(0, 50));
          const publicUrl = await uploadDraftImage(draft.id, uri, slotId);
          capturedImageUrls[slotId] = publicUrl;
        } else if (uri) {
          // Keep existing Supabase URL
          capturedImageUrls[slotId] = uri;
        }
        // If uri is empty/null, the slot will be removed from capturedImageUrls
      }
    }

    // Update the draft with the new URLs including preview cache
    const updatedDraft = await updateDraft(draft.id, {
      beforeImageUrl,
      afterImageUrl,
      capturedImageUrls: Object.keys(capturedImageUrls).length > 0 ? capturedImageUrls : null,
      renderedPreviewUrl: renderedPreviewUrl ?? draft.renderedPreviewUrl,
      wasRenderedAsPremium: wasRenderedAsPremium ?? draft.wasRenderedAsPremium,
    });

    // Return draft with localPreviewPath appended (client-side only, not in DB)
    // This allows the caller to have the local path for immediate use
    return {
      ...updatedDraft,
      localPreviewPath: localPreviewPath || null,
    };
  } catch (error) {
    console.error('Failed to save draft with images:', error);
    throw error;
  }
}

/**
 * Delete a draft and its associated images (both remote and local)
 */
export async function deleteDraft(id: string): Promise<void> {
  try {
    // Delete images from Supabase storage
    await deleteDraftImages(id);

    // Delete local draft files (preview cache, slot images, etc.)
    try {
      const localDraftDir = getDraftDirectory(id);
      await deleteDirectory(localDraftDir);
      console.log('[DraftService] Deleted local draft directory:', localDraftDir);
    } catch (localError) {
      // Non-critical - local files may not exist
      console.warn('[DraftService] Failed to delete local files:', localError);
    }

    // Then delete the draft record from database
    const { error } = await supabase
      .from('drafts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting draft:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete draft:', error);
    throw error;
  }
}

/**
 * Get draft count
 */
export async function getDraftCount(): Promise<number> {
  const { count, error } = await supabase
    .from('drafts')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error getting draft count:', error);
    return 0;
  }

  return count || 0;
}
