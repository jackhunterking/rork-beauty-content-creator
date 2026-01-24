/**
 * Project Service
 * 
 * Handles CRUD operations for projects (drafts) using the new unified slot_data column.
 * This service replaces the fragmented approach of storing slot data across multiple columns.
 * 
 * Key features:
 * 1. Single slot_data column for all slot information
 * 2. Backward compatibility - reads from old columns if slot_data is empty
 * 3. Always writes to new slot_data column
 */

import { supabase } from '@/lib/supabase';
import { Project, ProjectRow, SaveProjectOptions, LoadProjectResult } from './types';
import type { CapturedSlots, SlotData } from '@/domains/editor/types';
import type { Overlay } from '@/types/overlays';
import { loadOverlays } from '@/services/overlayPersistenceService';
import { getLocalPreviewPath } from '@/services/localStorageService';

// ============================================
// Helper Functions
// ============================================

/**
 * Get the current authenticated user ID
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('User must be authenticated to access projects');
  }
  
  return user.id;
}

/**
 * Check if a URI is already in cloud storage (doesn't need upload)
 */
function isCloudStorageUrl(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return uri.startsWith('http://') || uri.startsWith('https://');
}

/**
 * Convert legacy columns to new slot_data format
 * This handles backward compatibility for existing drafts
 */
function convertLegacyToSlotData(row: ProjectRow): CapturedSlots {
  // If slot_data already exists and has content, use it
  if (row.slot_data && Object.keys(row.slot_data).length > 0) {
    return row.slot_data;
  }
  
  // Convert from legacy columns
  const slots: CapturedSlots = {};
  
  if (row.captured_image_urls) {
    for (const [slotId, uri] of Object.entries(row.captured_image_urls)) {
      if (uri) {
        const adjustments = row.captured_image_adjustments?.[slotId] || {
          scale: 1,
          translateX: 0,
          translateY: 0,
          rotation: 0,
        };
        
        const backgroundInfo = row.captured_image_background_info?.[slotId];
        
        slots[slotId] = {
          uri,
          width: 1080, // Default dimensions
          height: 1080,
          adjustments,
          ai: {
            originalUri: uri,
            enhancementsApplied: backgroundInfo ? ['background_replace'] : [],
            transparentPngUrl: backgroundInfo ? uri : undefined,
            backgroundInfo,
          },
        };
      }
    }
  }
  
  // Also check legacy before/after fields
  if (row.before_image_url && !slots['slot-before']) {
    slots['slot-before'] = {
      uri: row.before_image_url,
      width: 1080,
      height: 1080,
      adjustments: { scale: 1, translateX: 0, translateY: 0, rotation: 0 },
      ai: {
        originalUri: row.before_image_url,
        enhancementsApplied: [],
      },
    };
  }
  
  if (row.after_image_url && !slots['slot-after']) {
    slots['slot-after'] = {
      uri: row.after_image_url,
      width: 1080,
      height: 1080,
      adjustments: { scale: 1, translateX: 0, translateY: 0, rotation: 0 },
      ai: {
        originalUri: row.after_image_url,
        enhancementsApplied: [],
      },
    };
  }
  
  return slots;
}

/**
 * Convert database row to Project object
 */
function mapRowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    projectName: row.project_name,
    slotData: convertLegacyToSlotData(row),
    backgroundColor: row.background_overrides?.['background-fill'] || null,
    themeColor: row.theme_color,
    renderedPreviewUrl: row.rendered_preview_url,
    wasRenderedAsPremium: row.was_rendered_as_premium,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Upload local images to cloud storage
 * Returns a new slot data object with all local URIs replaced with cloud URLs
 */
async function uploadLocalImages(
  slots: CapturedSlots,
  draftId: string
): Promise<CapturedSlots> {
  const { uploadDraftImage } = await import('@/services/storageService');
  
  const uploadedSlots: CapturedSlots = {};
  
  for (const [slotId, slotData] of Object.entries(slots)) {
    if (!slotData) {
      uploadedSlots[slotId] = null;
      continue;
    }
    
    let uploadedUri = slotData.uri;
    let uploadedOriginalUri = slotData.ai.originalUri;
    let uploadedTransparentPngUrl = slotData.ai.transparentPngUrl;
    
    // Upload main URI if it's local
    if (!isCloudStorageUrl(slotData.uri)) {
      uploadedUri = await uploadDraftImage(draftId, slotData.uri, slotId);
    }
    
    // Upload original URI if it's local and different from main URI
    if (slotData.ai.originalUri && !isCloudStorageUrl(slotData.ai.originalUri) && slotData.ai.originalUri !== slotData.uri) {
      uploadedOriginalUri = await uploadDraftImage(draftId, slotData.ai.originalUri, `${slotId}-original`);
    } else if (isCloudStorageUrl(slotData.ai.originalUri)) {
      uploadedOriginalUri = slotData.ai.originalUri;
    } else {
      uploadedOriginalUri = uploadedUri;
    }
    
    // Upload transparent PNG if it's local
    if (slotData.ai.transparentPngUrl && !isCloudStorageUrl(slotData.ai.transparentPngUrl)) {
      uploadedTransparentPngUrl = await uploadDraftImage(draftId, slotData.ai.transparentPngUrl, `${slotId}-transparent`);
    }
    
    uploadedSlots[slotId] = {
      ...slotData,
      uri: uploadedUri,
      ai: {
        ...slotData.ai,
        originalUri: uploadedOriginalUri,
        transparentPngUrl: uploadedTransparentPngUrl,
      },
    };
  }
  
  return uploadedSlots;
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Fetch all projects for the current user
 */
export async function fetchProjects(): Promise<Project[]> {
  await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[ProjectService] Error fetching projects:', error);
    throw error;
  }

  const projects = (data as ProjectRow[]).map(mapRowToProject);
  
  // Enhance with local preview paths
  const enhancedProjects = await Promise.all(
    projects.map(async (project) => {
      try {
        const localPath = await getLocalPreviewPath(project.id);
        return { ...project, localPreviewPath: localPath };
      } catch {
        return project;
      }
    })
  );

  return enhancedProjects;
}

/**
 * Fetch a single project by ID
 */
export async function fetchProject(id: string): Promise<Project | null> {
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
    console.error('[ProjectService] Error fetching project:', error);
    throw error;
  }

  const project = mapRowToProject(data as ProjectRow);
  
  // Check for local preview path
  try {
    const localPath = await getLocalPreviewPath(id);
    return { ...project, localPreviewPath: localPath };
  } catch {
    return project;
  }
}

/**
 * Load a project with its overlays
 */
export async function loadProject(id: string): Promise<LoadProjectResult | null> {
  const project = await fetchProject(id);
  if (!project) return null;
  
  // Load overlays
  const overlays = await loadOverlays(id);
  
  return {
    project,
    overlays,
  };
}

/**
 * Save a project (create or update)
 * 
 * This is the main save function that:
 * 1. Creates a new draft if no projectId is provided
 * 2. Uploads any local images to cloud storage
 * 3. Saves to the new slot_data column
 */
export async function saveProject(options: SaveProjectOptions): Promise<Project> {
  const userId = await getCurrentUserId();
  const {
    projectId,
    templateId,
    projectName,
    slotData,
    backgroundColor,
    themeColor,
    renderedPreviewUrl,
    wasRenderedAsPremium,
  } = options;
  
  let draftId = projectId;
  
  // Create draft if it doesn't exist
  if (!draftId) {
    const { data: newDraft, error: createError } = await supabase
      .from('drafts')
      .insert({
        user_id: userId,
        template_id: templateId,
        project_name: projectName,
      })
      .select()
      .single();
    
    if (createError) {
      console.error('[ProjectService] Error creating project:', createError);
      throw createError;
    }
    
    draftId = newDraft.id;
  }
  
  // Upload local images
  const uploadedSlotData = await uploadLocalImages(slotData, draftId);
  
  // Update the draft with all data
  const updateData: Record<string, unknown> = {
    template_id: templateId,
    project_name: projectName,
    slot_data: uploadedSlotData,
    updated_at: new Date().toISOString(),
  };
  
  if (backgroundColor !== undefined) {
    updateData.background_overrides = backgroundColor 
      ? { 'background-fill': backgroundColor }
      : null;
  }
  
  if (themeColor !== undefined) {
    updateData.theme_color = themeColor;
  }
  
  if (renderedPreviewUrl !== undefined) {
    updateData.rendered_preview_url = renderedPreviewUrl;
  }
  
  if (wasRenderedAsPremium !== undefined) {
    updateData.was_rendered_as_premium = wasRenderedAsPremium;
  }
  
  const { data, error } = await supabase
    .from('drafts')
    .update(updateData)
    .eq('id', draftId)
    .select()
    .single();
  
  if (error) {
    console.error('[ProjectService] Error saving project:', error);
    throw error;
  }
  
  console.log('[ProjectService] Project saved:', draftId);
  return mapRowToProject(data as ProjectRow);
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
  await getCurrentUserId();
  
  const { error } = await supabase
    .from('drafts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[ProjectService] Error deleting project:', error);
    throw error;
  }
  
  console.log('[ProjectService] Project deleted:', id);
}

/**
 * Rename a project
 */
export async function renameProject(id: string, name: string | null): Promise<Project> {
  await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('drafts')
    .update({
      project_name: name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[ProjectService] Error renaming project:', error);
    throw error;
  }
  
  return mapRowToProject(data as ProjectRow);
}

/**
 * Duplicate a project
 */
export async function duplicateProject(sourceId: string): Promise<Project> {
  const userId = await getCurrentUserId();
  const source = await fetchProject(sourceId);
  
  if (!source) {
    throw new Error('Source project not found');
  }
  
  // Create a new draft with the same data
  const { data, error } = await supabase
    .from('drafts')
    .insert({
      user_id: userId,
      template_id: source.templateId,
      project_name: source.projectName ? `${source.projectName} (Copy)` : null,
      slot_data: source.slotData,
      theme_color: source.themeColor,
      background_overrides: source.backgroundColor 
        ? { 'background-fill': source.backgroundColor }
        : null,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[ProjectService] Error duplicating project:', error);
    throw error;
  }
  
  console.log('[ProjectService] Project duplicated:', sourceId, '->', data.id);
  return mapRowToProject(data as ProjectRow);
}

/**
 * Get project count for the current user
 */
export async function getProjectCount(): Promise<number> {
  await getCurrentUserId();
  
  const { count, error } = await supabase
    .from('drafts')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[ProjectService] Error getting project count:', error);
    return 0;
  }

  return count || 0;
}
