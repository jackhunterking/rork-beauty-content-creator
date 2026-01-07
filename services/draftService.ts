import { supabase } from '@/lib/supabase';
import { Draft, DraftRow } from '@/types';
import { uploadDraftImage, deleteDraftImages } from './storageService';

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
  };
}

/**
 * Fetch all drafts
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

  return (data as DraftRow[]).map(mapRowToDraft);
}

/**
 * Fetch a single draft by ID
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

  return mapRowToDraft(data as DraftRow);
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
 */
export async function saveDraftWithImages(
  templateId: string,
  beforeImageUri: string | null,
  afterImageUri: string | null,
  existingDraftId?: string,
  capturedImageUris?: Record<string, string>
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
    if (beforeImageUri && !beforeImageUri.includes('supabase')) {
      beforeImageUrl = await uploadDraftImage(draft.id, beforeImageUri, 'before');
    } else if (beforeImageUri === null) {
      beforeImageUrl = null;
    }

    // Upload after image if it's a new local file
    if (afterImageUri && !afterImageUri.includes('supabase')) {
      afterImageUrl = await uploadDraftImage(draft.id, afterImageUri, 'after');
    } else if (afterImageUri === null) {
      afterImageUrl = null;
    }

    // Handle new dynamic captured images format
    if (capturedImageUris) {
      for (const [slotId, localUri] of Object.entries(capturedImageUris)) {
        if (localUri && !localUri.includes('supabase')) {
          // Upload new local image
          const publicUrl = await uploadDraftImage(draft.id, localUri, slotId);
          capturedImageUrls[slotId] = publicUrl;
        } else if (localUri) {
          // Keep existing Supabase URL
          capturedImageUrls[slotId] = localUri;
        }
        // If localUri is empty/null, the slot will be removed from capturedImageUrls
      }
    }

    // Update the draft with the new URLs
    const updatedDraft = await updateDraft(draft.id, {
      beforeImageUrl,
      afterImageUrl,
      capturedImageUrls: Object.keys(capturedImageUrls).length > 0 ? capturedImageUrls : null,
    });

    return updatedDraft;
  } catch (error) {
    console.error('Failed to save draft with images:', error);
    throw error;
  }
}

/**
 * Delete a draft and its associated images
 */
export async function deleteDraft(id: string): Promise<void> {
  try {
    // First delete images from storage
    await deleteDraftImages(id);

    // Then delete the draft record
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
