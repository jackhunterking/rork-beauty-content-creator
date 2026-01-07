import { LocalDraft, LocalSlotImage, LocalDraftIndex, Template } from '@/types';
import {
  createDraftDirectories,
  getDraftDirectory,
  saveDraftSlotImage,
  getDraftSlotImagePath,
  getCachedRenderPath,
  deleteDirectory,
  readJsonFile,
  writeJsonFile,
  fileExists,
  listDirectory,
  invalidateDraftRenderCache,
  STORAGE_PATHS,
} from './localStorageService';
import { extractSlots } from '@/utils/slotParser';

/**
 * Local Draft Service
 * 
 * Manages drafts stored entirely on device file system.
 * Replaces Supabase-based drafts for privacy and offline support.
 * 
 * Directory structure:
 * /drafts/{draftId}/
 *   ├── metadata.json     # Draft info, template ref, timestamps
 *   ├── slots/
 *   │   ├── image-before.jpg
 *   │   └── image-after.jpg
 *   └── renders/
 *       ├── default.jpg   # Cached render with default theme
 *       └── dark.jpg      # Cached render with dark theme
 */

const METADATA_FILENAME = 'metadata.json';

// ============================================
// UUID Generation
// ============================================

/**
 * Generate a simple UUID for draft IDs
 */
function generateUUID(): string {
  return 'draft_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

// ============================================
// Draft CRUD Operations
// ============================================

/**
 * Create a new local draft
 */
export async function createLocalDraft(
  template: Template
): Promise<LocalDraft> {
  const id = generateUUID();
  const now = new Date().toISOString();
  
  const draft: LocalDraft = {
    id,
    templateId: template.id,
    templatedId: template.templatedId,
    createdAt: now,
    updatedAt: now,
    slots: {},
    cachedRenders: {},
    selectedTheme: 'default',
  };
  
  // Create directory structure
  await createDraftDirectories(id);
  
  // Save metadata
  await saveDraftMetadata(draft);
  
  return draft;
}

/**
 * Load a draft by ID
 */
export async function loadLocalDraft(draftId: string): Promise<LocalDraft | null> {
  const metadataPath = `${getDraftDirectory(draftId)}${METADATA_FILENAME}`;
  return readJsonFile<LocalDraft>(metadataPath);
}

/**
 * Save draft metadata
 */
export async function saveDraftMetadata(draft: LocalDraft): Promise<void> {
  const metadataPath = `${getDraftDirectory(draft.id)}${METADATA_FILENAME}`;
  await writeJsonFile(metadataPath, draft);
}

/**
 * Update draft and save
 */
export async function updateLocalDraft(
  draftId: string,
  updates: Partial<Omit<LocalDraft, 'id' | 'createdAt'>>
): Promise<LocalDraft> {
  const draft = await loadLocalDraft(draftId);
  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }
  
  const updatedDraft: LocalDraft = {
    ...draft,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await saveDraftMetadata(updatedDraft);
  return updatedDraft;
}

/**
 * Delete a draft and all its files
 */
export async function deleteLocalDraft(draftId: string): Promise<void> {
  const draftDir = getDraftDirectory(draftId);
  await deleteDirectory(draftDir);
}

// ============================================
// Slot Image Operations
// ============================================

/**
 * Save a captured image to a slot
 * Invalidates render cache since content changed
 */
export async function saveSlotImage(
  draftId: string,
  slotId: string,
  sourceUri: string,
  width: number,
  height: number
): Promise<LocalSlotImage> {
  // Save the image file
  const localPath = await saveDraftSlotImage(draftId, slotId, sourceUri);
  
  const slotImage: LocalSlotImage = {
    localPath,
    originalWidth: width,
    originalHeight: height,
    capturedAt: new Date().toISOString(),
  };
  
  // Update draft metadata
  const draft = await loadLocalDraft(draftId);
  if (draft) {
    draft.slots[slotId] = slotImage;
    draft.updatedAt = new Date().toISOString();
    
    // Invalidate cached renders since slot content changed
    draft.cachedRenders = {};
    await invalidateDraftRenderCache(draftId);
    
    await saveDraftMetadata(draft);
  }
  
  return slotImage;
}

/**
 * Remove a slot image
 */
export async function removeSlotImage(
  draftId: string,
  slotId: string
): Promise<void> {
  const draft = await loadLocalDraft(draftId);
  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }
  
  // Remove from metadata
  delete draft.slots[slotId];
  draft.updatedAt = new Date().toISOString();
  
  // Invalidate cached renders
  draft.cachedRenders = {};
  await invalidateDraftRenderCache(draftId);
  
  await saveDraftMetadata(draft);
  
  // Note: We don't delete the actual file here to allow for undo
  // Files will be cleaned up when draft is deleted
}

/**
 * Get all slot images for a draft
 */
export async function getSlotImages(
  draftId: string
): Promise<Record<string, LocalSlotImage>> {
  const draft = await loadLocalDraft(draftId);
  return draft?.slots || {};
}

/**
 * Check if a slot has an image
 */
export async function hasSlotImage(
  draftId: string,
  slotId: string
): Promise<boolean> {
  const draft = await loadLocalDraft(draftId);
  if (!draft?.slots[slotId]) {
    return false;
  }
  return fileExists(draft.slots[slotId].localPath);
}

/**
 * Get slot image URI for display
 */
export function getSlotImageUri(draftId: string, slotId: string): string {
  return getDraftSlotImagePath(draftId, slotId);
}

// ============================================
// Render Cache Operations
// ============================================

/**
 * Mark a theme's render as cached
 */
export async function markRenderCached(
  draftId: string,
  themeId: string,
  renderPath: string
): Promise<void> {
  const draft = await loadLocalDraft(draftId);
  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }
  
  draft.cachedRenders[themeId] = renderPath;
  draft.updatedAt = new Date().toISOString();
  await saveDraftMetadata(draft);
}

/**
 * Get cached render path for a theme
 */
export async function getCachedRender(
  draftId: string,
  themeId: string = 'default'
): Promise<string | null> {
  const draft = await loadLocalDraft(draftId);
  if (!draft?.cachedRenders[themeId]) {
    return null;
  }
  
  const renderPath = getCachedRenderPath(draftId, themeId);
  const exists = await fileExists(renderPath);
  
  return exists ? renderPath : null;
}

/**
 * Get all cached theme renders for a draft
 */
export async function getCachedThemes(draftId: string): Promise<string[]> {
  const draft = await loadLocalDraft(draftId);
  if (!draft) {
    return [];
  }
  
  const cachedThemes: string[] = [];
  for (const themeId of Object.keys(draft.cachedRenders)) {
    const renderPath = getCachedRenderPath(draftId, themeId);
    if (await fileExists(renderPath)) {
      cachedThemes.push(themeId);
    }
  }
  
  return cachedThemes;
}

/**
 * Invalidate all cached renders for a draft
 */
export async function invalidateRenderCache(draftId: string): Promise<void> {
  const draft = await loadLocalDraft(draftId);
  if (draft) {
    draft.cachedRenders = {};
    await saveDraftMetadata(draft);
  }
  await invalidateDraftRenderCache(draftId);
}

// ============================================
// Theme Operations
// ============================================

/**
 * Set the selected theme for a draft
 */
export async function setSelectedTheme(
  draftId: string,
  themeId: string
): Promise<void> {
  await updateLocalDraft(draftId, { selectedTheme: themeId });
}

/**
 * Get the selected theme for a draft
 */
export async function getSelectedTheme(draftId: string): Promise<string> {
  const draft = await loadLocalDraft(draftId);
  return draft?.selectedTheme || 'default';
}

// ============================================
// Draft Listing
// ============================================

/**
 * List all local drafts
 */
export async function listLocalDrafts(): Promise<LocalDraft[]> {
  const drafts: LocalDraft[] = [];
  
  try {
    const draftDirs = await listDirectory(STORAGE_PATHS.DRAFTS);
    
    for (const dirName of draftDirs) {
      const draft = await loadLocalDraft(dirName);
      if (draft) {
        drafts.push(draft);
      }
    }
    
    // Sort by updatedAt, most recent first
    drafts.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    console.error('Error listing drafts:', error);
  }
  
  return drafts;
}

/**
 * Get draft index (lightweight metadata for listing)
 */
export async function getDraftIndex(
  draft: LocalDraft,
  templates: Template[]
): Promise<LocalDraftIndex> {
  const template = templates.find(t => t.id === draft.templateId);
  const slots = template ? extractSlots(template) : [];
  
  // Get thumbnail from first filled slot
  const filledSlots = Object.keys(draft.slots);
  const thumbnailPath = filledSlots.length > 0 
    ? draft.slots[filledSlots[0]].localPath 
    : undefined;
  
  // Check if any render is cached
  const hasRender = Object.keys(draft.cachedRenders).length > 0;
  
  return {
    id: draft.id,
    templateId: draft.templateId,
    templateName: template?.name || 'Unknown Template',
    thumbnailPath,
    slotCount: slots.length,
    filledSlotCount: filledSlots.length,
    hasRender,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

/**
 * Get all draft indices for listing
 */
export async function getAllDraftIndices(
  templates: Template[]
): Promise<LocalDraftIndex[]> {
  const drafts = await listLocalDrafts();
  const indices: LocalDraftIndex[] = [];
  
  for (const draft of drafts) {
    const index = await getDraftIndex(draft, templates);
    indices.push(index);
  }
  
  return indices;
}

// ============================================
// Draft State Helpers
// ============================================

/**
 * Check if all slots in a draft are filled
 */
export async function isDraftComplete(
  draftId: string,
  template: Template
): Promise<boolean> {
  const draft = await loadLocalDraft(draftId);
  if (!draft) {
    return false;
  }
  
  const slots = extractSlots(template);
  return slots.every(slot => {
    const slotImage = draft.slots[slot.layerId];
    return slotImage && slotImage.localPath;
  });
}

/**
 * Get the number of filled slots in a draft
 */
export async function getFilledSlotCount(draftId: string): Promise<number> {
  const draft = await loadLocalDraft(draftId);
  if (!draft) {
    return 0;
  }
  return Object.keys(draft.slots).length;
}

/**
 * Get slot URIs map for rendering
 */
export async function getSlotUrisForRender(
  draftId: string
): Promise<Record<string, string>> {
  const draft = await loadLocalDraft(draftId);
  if (!draft) {
    return {};
  }
  
  const uris: Record<string, string> = {};
  for (const [slotId, slotImage] of Object.entries(draft.slots)) {
    if (slotImage.localPath) {
      uris[slotId] = slotImage.localPath;
    }
  }
  
  return uris;
}

// ============================================
// Draft Cleanup
// ============================================

/**
 * Delete drafts older than specified days
 */
export async function cleanupOldDrafts(maxAgeDays: number = 30): Promise<number> {
  const drafts = await listLocalDrafts();
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  let deletedCount = 0;
  
  for (const draft of drafts) {
    const age = now - new Date(draft.updatedAt).getTime();
    if (age > maxAgeMs) {
      await deleteLocalDraft(draft.id);
      deletedCount++;
    }
  }
  
  return deletedCount;
}

/**
 * Get total draft count
 */
export async function getDraftCount(): Promise<number> {
  const drafts = await listLocalDrafts();
  return drafts.length;
}

