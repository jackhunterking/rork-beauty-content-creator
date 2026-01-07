import { supabase } from '@/lib/supabase';
import { Draft, DraftRow } from '@/types';

/**
 * Convert database row (snake_case) to Draft type (camelCase)
 */
function mapRowToDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    templateId: row.template_id,
    beforeImageUri: row.before_image_uri,
    afterImageUri: row.after_image_uri,
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
 * Create a new draft
 */
export async function createDraft(
  templateId: string,
  beforeImageUri: string | null = null,
  afterImageUri: string | null = null
): Promise<Draft> {
  const { data, error } = await supabase
    .from('drafts')
    .insert({
      template_id: templateId,
      before_image_uri: beforeImageUri,
      after_image_uri: afterImageUri,
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
    beforeImageUri?: string | null;
    afterImageUri?: string | null;
  }
): Promise<Draft> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.beforeImageUri !== undefined) {
    updateData.before_image_uri = updates.beforeImageUri;
  }
  if (updates.afterImageUri !== undefined) {
    updateData.after_image_uri = updates.afterImageUri;
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
 * Save or update a draft (upsert behavior)
 * If a draft exists for the template, update it; otherwise create new
 */
export async function saveDraft(
  templateId: string,
  beforeImageUri: string | null,
  afterImageUri: string | null
): Promise<Draft> {
  // Check if draft exists for this template
  const existingDraft = await fetchDraftByTemplateId(templateId);

  if (existingDraft) {
    return updateDraft(existingDraft.id, { beforeImageUri, afterImageUri });
  } else {
    return createDraft(templateId, beforeImageUri, afterImageUri);
  }
}

/**
 * Delete a draft
 */
export async function deleteDraft(id: string): Promise<void> {
  const { error } = await supabase
    .from('drafts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting draft:', error);
    throw error;
  }
}

