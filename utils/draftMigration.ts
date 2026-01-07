import { File, Paths } from 'expo-file-system';
import { Draft, Template, LocalDraft } from '@/types';
import { fetchDrafts, deleteDraft as deleteSupabaseDraft } from '@/services/draftService';
import { 
  createLocalDraft, 
  saveSlotImage, 
  loadLocalDraft,
  listLocalDrafts,
} from '@/services/localDraftService';
import { addToIndex, getDraftIndex, clearIndex } from '@/services/draftIndexService';
import { initializeLocalStorage } from '@/services/localStorageService';
import { extractSlots } from '@/utils/slotParser';

/**
 * Draft Migration Utility
 * 
 * Migrates existing Supabase-based drafts to local file system storage.
 * This is a one-time migration for users upgrading from the old system.
 * 
 * Migration flow:
 * 1. Fetch all drafts from Supabase
 * 2. For each draft:
 *    a. Download images from Supabase Storage URLs
 *    b. Create local draft structure
 *    c. Save images to local storage
 *    d. Update draft index
 * 3. Optionally delete Supabase drafts after successful migration
 */

export interface MigrationProgress {
  total: number;
  current: number;
  currentDraftId: string;
  stage: 'fetching' | 'downloading' | 'saving' | 'indexing' | 'complete' | 'error';
  message: string;
}

export type MigrationProgressCallback = (progress: MigrationProgress) => void;

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  failedCount: number;
  errors: { draftId: string; error: string }[];
}

// ============================================
// Migration Functions
// ============================================

/**
 * Check if migration is needed
 * Returns true if there are Supabase drafts but no local drafts
 */
export async function isMigrationNeeded(): Promise<boolean> {
  try {
    const localDrafts = await listLocalDrafts();
    if (localDrafts.length > 0) {
      // Already have local drafts, no migration needed
      return false;
    }
    
    const supabaseDrafts = await fetchDrafts();
    return supabaseDrafts.length > 0;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}

/**
 * Migrate a single draft from Supabase to local storage
 */
export async function migrateSingleDraft(
  supabaseDraft: Draft,
  template: Template,
  onProgress?: MigrationProgressCallback
): Promise<LocalDraft> {
  // Create local draft
  const localDraft = await createLocalDraft(template);
  
  const slots = extractSlots(template);
  
  // Download and save images
  // Handle legacy before/after format
  if (supabaseDraft.beforeImageUrl) {
    const beforeSlot = slots.find(s => s.layerId.includes('before'));
    if (beforeSlot) {
      onProgress?.({
        total: 1,
        current: 0,
        currentDraftId: supabaseDraft.id,
        stage: 'downloading',
        message: `Downloading before image...`,
      });
      
      await downloadAndSaveImage(
        supabaseDraft.beforeImageUrl,
        localDraft.id,
        beforeSlot.layerId,
        beforeSlot.width,
        beforeSlot.height
      );
    }
  }
  
  if (supabaseDraft.afterImageUrl) {
    const afterSlot = slots.find(s => s.layerId.includes('after'));
    if (afterSlot) {
      onProgress?.({
        total: 1,
        current: 0,
        currentDraftId: supabaseDraft.id,
        stage: 'downloading',
        message: `Downloading after image...`,
      });
      
      await downloadAndSaveImage(
        supabaseDraft.afterImageUrl,
        localDraft.id,
        afterSlot.layerId,
        afterSlot.width,
        afterSlot.height
      );
    }
  }
  
  // Handle new capturedImageUrls format
  if (supabaseDraft.capturedImageUrls) {
    for (const [slotId, url] of Object.entries(supabaseDraft.capturedImageUrls)) {
      if (url) {
        const slot = slots.find(s => s.layerId === slotId);
        if (slot) {
          onProgress?.({
            total: 1,
            current: 0,
            currentDraftId: supabaseDraft.id,
            stage: 'downloading',
            message: `Downloading ${slot.label} image...`,
          });
          
          await downloadAndSaveImage(
            url,
            localDraft.id,
            slotId,
            slot.width,
            slot.height
          );
        }
      }
    }
  }
  
  // Reload draft to get updated slot data
  const updatedDraft = await loadLocalDraft(localDraft.id);
  if (!updatedDraft) {
    throw new Error('Failed to reload migrated draft');
  }
  
  return updatedDraft;
}

/**
 * Download an image from URL and save to local draft
 */
async function downloadAndSaveImage(
  url: string,
  draftId: string,
  slotId: string,
  width: number,
  height: number
): Promise<void> {
  // Create temp file path
  const tempPath = `${Paths.cache}/temp_migration_${Date.now()}.jpg`;
  
  try {
    // Download the image
    const downloadedFile = await File.downloadFileAsync(url, new File(tempPath));
    
    if (!downloadedFile.exists) {
      throw new Error('Download failed');
    }
    
    // Save to draft slot
    await saveSlotImage(draftId, slotId, tempPath, width, height);
    
  } finally {
    // Clean up temp file
    try {
      const tempFile = new File(tempPath);
      if (tempFile.exists) {
        tempFile.delete();
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Migrate all drafts from Supabase to local storage
 */
export async function migrateAllDrafts(
  templates: Template[],
  onProgress?: MigrationProgressCallback,
  deleteAfterMigration: boolean = false
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migratedCount: 0,
    failedCount: 0,
    errors: [],
  };
  
  try {
    // Initialize local storage
    await initializeLocalStorage();
    
    // Fetch all Supabase drafts
    onProgress?.({
      total: 0,
      current: 0,
      currentDraftId: '',
      stage: 'fetching',
      message: 'Fetching drafts from server...',
    });
    
    const supabaseDrafts = await fetchDrafts();
    
    if (supabaseDrafts.length === 0) {
      onProgress?.({
        total: 0,
        current: 0,
        currentDraftId: '',
        stage: 'complete',
        message: 'No drafts to migrate',
      });
      return result;
    }
    
    // Create template lookup
    const templateMap = new Map(templates.map(t => [t.id, t]));
    
    // Migrate each draft
    for (let i = 0; i < supabaseDrafts.length; i++) {
      const draft = supabaseDrafts[i];
      
      onProgress?.({
        total: supabaseDrafts.length,
        current: i + 1,
        currentDraftId: draft.id,
        stage: 'downloading',
        message: `Migrating draft ${i + 1} of ${supabaseDrafts.length}...`,
      });
      
      try {
        const template = templateMap.get(draft.templateId);
        if (!template) {
          throw new Error(`Template not found: ${draft.templateId}`);
        }
        
        // Migrate the draft
        const localDraft = await migrateSingleDraft(draft, template, onProgress);
        
        // Update index
        onProgress?.({
          total: supabaseDrafts.length,
          current: i + 1,
          currentDraftId: draft.id,
          stage: 'indexing',
          message: `Indexing draft ${i + 1}...`,
        });
        
        await addToIndex({
          id: localDraft.id,
          templateId: localDraft.templateId,
          templateName: template.name,
          thumbnailPath: Object.values(localDraft.slots)[0]?.localPath,
          slotCount: extractSlots(template).length,
          filledSlotCount: Object.keys(localDraft.slots).length,
          hasRender: false,
          createdAt: localDraft.createdAt,
          updatedAt: localDraft.updatedAt,
        });
        
        // Optionally delete from Supabase
        if (deleteAfterMigration) {
          try {
            await deleteSupabaseDraft(draft.id);
          } catch (deleteError) {
            console.warn(`Failed to delete Supabase draft ${draft.id}:`, deleteError);
            // Don't fail the migration for cleanup errors
          }
        }
        
        result.migratedCount++;
        
      } catch (error) {
        console.error(`Failed to migrate draft ${draft.id}:`, error);
        result.failedCount++;
        result.errors.push({
          draftId: draft.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    onProgress?.({
      total: supabaseDrafts.length,
      current: supabaseDrafts.length,
      currentDraftId: '',
      stage: 'complete',
      message: `Migration complete: ${result.migratedCount} migrated, ${result.failedCount} failed`,
    });
    
    result.success = result.failedCount === 0;
    
  } catch (error) {
    console.error('Migration failed:', error);
    result.success = false;
    result.errors.push({
      draftId: '',
      error: error instanceof Error ? error.message : 'Migration failed',
    });
    
    onProgress?.({
      total: 0,
      current: 0,
      currentDraftId: '',
      stage: 'error',
      message: error instanceof Error ? error.message : 'Migration failed',
    });
  }
  
  return result;
}

// ============================================
// Rollback Functions
// ============================================

/**
 * Clear all local drafts (for rollback or reset)
 */
export async function clearLocalDrafts(): Promise<void> {
  const localDrafts = await listLocalDrafts();
  
  for (const draft of localDrafts) {
    try {
      const { deleteLocalDraft } = await import('@/services/localDraftService');
      await deleteLocalDraft(draft.id);
    } catch (error) {
      console.warn(`Failed to delete local draft ${draft.id}:`, error);
    }
  }
  
  // Clear the index
  await clearIndex();
}

/**
 * Check migration status
 */
export async function getMigrationStatus(): Promise<{
  hasSupabaseDrafts: boolean;
  hasLocalDrafts: boolean;
  supabaseDraftCount: number;
  localDraftCount: number;
  needsMigration: boolean;
}> {
  const [supabaseDrafts, localDrafts, localIndex] = await Promise.all([
    fetchDrafts().catch(() => []),
    listLocalDrafts(),
    getDraftIndex(),
  ]);
  
  return {
    hasSupabaseDrafts: supabaseDrafts.length > 0,
    hasLocalDrafts: localDrafts.length > 0 || localIndex.length > 0,
    supabaseDraftCount: supabaseDrafts.length,
    localDraftCount: Math.max(localDrafts.length, localIndex.length),
    needsMigration: supabaseDrafts.length > 0 && localDrafts.length === 0,
  };
}

