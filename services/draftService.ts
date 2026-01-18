import { supabase } from '@/lib/supabase';
import { Draft, DraftRow } from '@/types';
import { uploadDraftImage, deleteDraftImages, copyDraftImages } from './storageService';
import { getLocalPreviewPath, deleteDirectory, getDraftDirectory, copyFile, getCachedRenderPath, createDraftDirectories } from './localStorageService';
import { copyOverlays } from './overlayPersistenceService';
import { getDuplicateProjectName } from '@/utils/projectName';

/**
 * Helper to get the current authenticated user ID
 * Throws an error if no user is authenticated
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('User must be authenticated to access drafts');
  }
  
  return user.id;
}

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
    userId: row.user_id,
    templateId: row.template_id,
    // User-editable project name for personal reference
    projectName: row.project_name || undefined,
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
 * Fetch all drafts for the current user
 * Also checks for locally cached preview files and adds them to the draft objects
 * Note: RLS policies ensure only the user's own drafts are returned
 */
export async function fetchDrafts(): Promise<Draft[]> {
  // Ensure user is authenticated (RLS will handle filtering)
  await getCurrentUserId();
  
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
 * Note: RLS policies ensure only the user's own draft can be fetched
 */
export async function fetchDraftById(id: string): Promise<Draft | null> {
  // Ensure user is authenticated (RLS will handle authorization)
  await getCurrentUserId();
  
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
 * Fetch draft by template ID for the current user (returns the most recent one)
 * Note: RLS policies ensure only the user's own drafts are searched
 */
export async function fetchDraftByTemplateId(templateId: string): Promise<Draft | null> {
  // Ensure user is authenticated (RLS will handle filtering)
  await getCurrentUserId();
  
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
 * Automatically associates the draft with the current user
 */
export async function createDraft(
  templateId: string,
  beforeImageUrl: string | null = null,
  afterImageUrl: string | null = null,
  capturedImageUrls: Record<string, string> | null = null,
  projectName: string | null = null
): Promise<Draft> {
  // Get current user ID to associate with the draft
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('drafts')
    .insert({
      user_id: userId,
      template_id: templateId,
      before_image_url: beforeImageUrl,
      after_image_url: afterImageUrl,
      captured_image_urls: capturedImageUrls,
      project_name: projectName,
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
 * Note: RLS policies ensure only the user's own draft can be updated
 */
export async function updateDraft(
  id: string,
  updates: {
    beforeImageUrl?: string | null;
    afterImageUrl?: string | null;
    capturedImageUrls?: Record<string, string> | null;
    renderedPreviewUrl?: string | null;
    wasRenderedAsPremium?: boolean | null;
    projectName?: string | null;
  }
): Promise<Draft> {
  // Ensure user is authenticated (RLS will handle authorization)
  await getCurrentUserId();
  
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
  if (updates.projectName !== undefined) {
    updateData.project_name = updates.projectName;
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
 * @param projectName - Optional user-editable project name for personal reference
 */
export async function saveDraftWithImages(
  templateId: string,
  beforeImageUri: string | null,
  afterImageUri: string | null,
  existingDraftId?: string,
  capturedImageUris?: Record<string, string>,
  renderedPreviewUrl?: string | null,
  wasRenderedAsPremium?: boolean,
  localPreviewPath?: string | null,
  projectName?: string | null
): Promise<Draft> {
  try {
    let draft: Draft;

    // Create or get existing draft
    if (existingDraftId) {
      // Update existing draft (user explicitly editing a saved draft)
      const existingDraft = await fetchDraftById(existingDraftId);
      if (!existingDraft) {
        throw new Error('Draft not found');
      }
      draft = existingDraft;
    } else {
      // Always create a new draft when no existingDraftId is provided
      // This allows multiple drafts per template and prevents overwriting old drafts
      draft = await createDraft(templateId, null, null, null, projectName);
    }

    // Upload images if they are local URIs (not already Supabase URLs)
    let beforeImageUrl = draft.beforeImageUrl;
    let afterImageUrl = draft.afterImageUrl;
    let capturedImageUrls = draft.capturedImageUrls || {};

    // Handle legacy before/after format
    // Upload before image if it's a new local file
    if (beforeImageUri && !isSupabaseStorageUrl(beforeImageUri)) {
      beforeImageUrl = await uploadDraftImage(draft.id, beforeImageUri, 'before');
    } else if (beforeImageUri === null) {
      beforeImageUrl = null;
    } else if (beforeImageUri) {
      beforeImageUrl = beforeImageUri;
    }

    // Upload after image if it's a new local file
    if (afterImageUri && !isSupabaseStorageUrl(afterImageUri)) {
      afterImageUrl = await uploadDraftImage(draft.id, afterImageUri, 'after');
    } else if (afterImageUri === null) {
      afterImageUrl = null;
    } else if (afterImageUri) {
      afterImageUrl = afterImageUri;
    }

    // Handle new dynamic captured images format
    // IMPORTANT: If capturedImageUris is provided, it replaces the entire capturedImageUrls
    // This ensures slots that were removed are actually cleared
    if (capturedImageUris !== undefined) {
      // Start fresh - only include slots that are explicitly provided
      const newCapturedImageUrls: Record<string, string> = {};
      
      for (const [slotId, uri] of Object.entries(capturedImageUris)) {
        if (uri && !isSupabaseStorageUrl(uri)) {
          const publicUrl = await uploadDraftImage(draft.id, uri, slotId);
          newCapturedImageUrls[slotId] = publicUrl;
        } else if (uri) {
          newCapturedImageUrls[slotId] = uri;
        }
      }
      
      capturedImageUrls = newCapturedImageUrls;
    }

    // Update the draft with the new URLs including preview cache
    const updatedDraft = await updateDraft(draft.id, {
      beforeImageUrl,
      afterImageUrl,
      capturedImageUrls: Object.keys(capturedImageUrls).length > 0 ? capturedImageUrls : null,
      renderedPreviewUrl: renderedPreviewUrl ?? draft.renderedPreviewUrl,
      wasRenderedAsPremium: wasRenderedAsPremium ?? draft.wasRenderedAsPremium,
      projectName: projectName !== undefined ? projectName : draft.projectName,
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
 * Note: RLS policies ensure only the user's own draft can be deleted
 */
export async function deleteDraft(id: string): Promise<void> {
  try {
    // Ensure user is authenticated (RLS will handle authorization)
    await getCurrentUserId();
    
    // Delete images from Supabase storage
    await deleteDraftImages(id);

    // Delete local draft files (preview cache, slot images, etc.)
    try {
      const localDraftDir = getDraftDirectory(id);
      await deleteDirectory(localDraftDir);
    } catch {
      // Non-critical - local files may not exist
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
 * Rename a draft
 * Updates only the project_name field for the specified draft
 * Note: RLS policies ensure only the user's own draft can be renamed
 * 
 * @param draftId - The ID of the draft to rename
 * @param projectName - The new project name (or null to clear)
 * @returns The updated draft
 */
export async function renameDraft(draftId: string, projectName: string | null): Promise<Draft> {
  // Ensure user is authenticated (RLS will handle authorization)
  await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('drafts')
    .update({
      project_name: projectName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)
    .select()
    .single();

  if (error) {
    console.error('Error renaming draft:', error);
    throw error;
  }

  return mapRowToDraft(data as DraftRow);
}

/**
 * Get draft count for the current user
 * Note: RLS policies ensure only the user's own drafts are counted
 */
export async function getDraftCount(): Promise<number> {
  // Ensure user is authenticated (RLS will handle filtering)
  await getCurrentUserId();
  
  const { count, error } = await supabase
    .from('drafts')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error getting draft count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Duplicate an existing draft
 * Creates a new draft with the same template and copied images
 * Also copies any overlays associated with the draft
 * @param sourceDraftId - The ID of the draft to duplicate
 * @returns The newly created draft
 */
export async function duplicateDraft(sourceDraftId: string): Promise<Draft> {
  try {
    // Get current user ID (RLS will verify ownership)
    const userId = await getCurrentUserId();
    
    // Fetch the source draft
    const sourceDraft = await fetchDraftById(sourceDraftId);
    if (!sourceDraft) {
      throw new Error('Source draft not found');
    }
    
    // Generate project name for the duplicate
    const duplicateProjectName = getDuplicateProjectName(sourceDraft.projectName, sourceDraft.createdAt);
    
    // Create a new draft record with the same template
    // IMPORTANT: Copy the rendered preview URL so thumbnails work immediately
    const { data: newDraftData, error: createError } = await supabase
      .from('drafts')
      .insert({
        user_id: userId,
        template_id: sourceDraft.templateId,
        // Leave image URLs null initially - we'll update after copying
        before_image_url: null,
        after_image_url: null,
        captured_image_urls: null,
        // Copy the rendered preview URL (Templated.io URL still valid for duplicate)
        rendered_preview_url: sourceDraft.renderedPreviewUrl || null,
        was_rendered_as_premium: sourceDraft.wasRenderedAsPremium ?? null,
        // Copy project name with (Copy) suffix
        project_name: duplicateProjectName,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating duplicate draft:', createError);
      throw createError;
    }

    const newDraft = mapRowToDraft(newDraftData as DraftRow);
    
    // Copy images from source to new draft in storage
    const copiedImageUrls = await copyDraftImages(sourceDraftId, newDraft.id);
    
    // Build the update data based on what was copied
    const updatePayload: {
      beforeImageUrl?: string | null;
      afterImageUrl?: string | null;
      capturedImageUrls?: Record<string, string> | null;
    } = {};
    
    // Map copied URLs back to the appropriate fields
    // Check for legacy before/after fields
    if (copiedImageUrls['before']) {
      updatePayload.beforeImageUrl = copiedImageUrls['before'];
    }
    if (copiedImageUrls['after']) {
      updatePayload.afterImageUrl = copiedImageUrls['after'];
    }
    
    // Build captured image URLs map (excluding legacy before/after)
    const capturedUrls: Record<string, string> = {};
    for (const [slotId, url] of Object.entries(copiedImageUrls)) {
      if (slotId !== 'before' && slotId !== 'after') {
        capturedUrls[slotId] = url;
      }
    }
    
    if (Object.keys(capturedUrls).length > 0) {
      updatePayload.capturedImageUrls = capturedUrls;
    }
    
    // Update the new draft with the copied image URLs
    let updatedDraft = newDraft;
    if (Object.keys(updatePayload).length > 0) {
      updatedDraft = await updateDraft(newDraft.id, updatePayload);
    }
    
    // Copy overlays from source to new draft (local storage)
    await copyOverlays(sourceDraftId, newDraft.id);
    
    // Copy local preview file if it exists (contains rendered template + overlays)
    let copiedLocalPreviewPath: string | null = null;
    try {
      const sourceLocalPreview = await getLocalPreviewPath(sourceDraftId);
      if (sourceLocalPreview) {
        // Ensure destination directories exist
        await createDraftDirectories(newDraft.id);
        
        // Copy the local preview file
        const destPreviewPath = getCachedRenderPath(newDraft.id, 'default');
        await copyFile(sourceLocalPreview, destPreviewPath);
        copiedLocalPreviewPath = destPreviewPath;
        console.log(`Copied local preview from ${sourceDraftId} to ${newDraft.id}`);
      }
    } catch (copyError) {
      console.warn('Failed to copy local preview file:', copyError);
      // Non-critical - thumbnail will use rendered preview URL instead
    }
    
    console.log(`Successfully duplicated draft ${sourceDraftId} to ${newDraft.id}`);
    
    // Return draft with localPreviewPath if copied
    return {
      ...updatedDraft,
      localPreviewPath: copiedLocalPreviewPath,
    };
  } catch (error) {
    console.error('Failed to duplicate draft:', error);
    throw error;
  }
}
