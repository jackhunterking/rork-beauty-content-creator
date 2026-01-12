/**
 * Overlay Persistence Service
 * 
 * Manages local storage of overlay data for drafts.
 * Overlays are stored as JSON files in the draft directory.
 * 
 * This approach keeps overlay data local (Pro feature) while
 * the main draft metadata remains in Supabase.
 */

import * as FileSystem from 'expo-file-system';
import { Overlay } from '@/types/overlays';
import { getDraftDirectory, createDraftDirectories } from './localStorageService';

const OVERLAYS_FILENAME = 'overlays.json';

/**
 * Get the overlays file path for a draft
 */
function getOverlaysFilePath(draftId: string): string {
  return `${getDraftDirectory(draftId)}${OVERLAYS_FILENAME}`;
}

/**
 * Save overlays for a draft
 * 
 * @param draftId - The draft ID
 * @param overlays - Array of overlays to save
 */
export async function saveOverlays(
  draftId: string,
  overlays: Overlay[]
): Promise<void> {
  try {
    // Ensure draft directories exist
    await createDraftDirectories(draftId);
    
    const filePath = getOverlaysFilePath(draftId);
    const data = JSON.stringify(overlays, null, 2);
    
    await FileSystem.writeAsStringAsync(filePath, data, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    console.log(`[OverlayPersistence] Saved ${overlays.length} overlays for draft:`, draftId);
  } catch (error) {
    console.error('[OverlayPersistence] Failed to save overlays:', error);
    throw error;
  }
}

/**
 * Load overlays for a draft
 * 
 * @param draftId - The draft ID
 * @returns Array of overlays, or empty array if not found
 */
export async function loadOverlays(draftId: string): Promise<Overlay[]> {
  try {
    const filePath = getOverlaysFilePath(draftId);
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      return [];
    }
    
    const data = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    const overlays = JSON.parse(data) as Overlay[];
    console.log(`[OverlayPersistence] Loaded ${overlays.length} overlays for draft:`, draftId);
    
    return overlays;
  } catch (error) {
    console.error('[OverlayPersistence] Failed to load overlays:', error);
    return [];
  }
}

/**
 * Delete overlays for a draft
 * 
 * @param draftId - The draft ID
 */
export async function deleteOverlays(draftId: string): Promise<void> {
  try {
    const filePath = getOverlaysFilePath(draftId);
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.log('[OverlayPersistence] Deleted overlays for draft:', draftId);
    }
  } catch (error) {
    console.error('[OverlayPersistence] Failed to delete overlays:', error);
    // Non-critical - don't throw
  }
}

/**
 * Check if a draft has overlays
 * 
 * @param draftId - The draft ID
 * @returns True if overlays exist
 */
export async function hasOverlays(draftId: string): Promise<boolean> {
  try {
    const filePath = getOverlaysFilePath(draftId);
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    
    if (!fileInfo.exists) {
      return false;
    }
    
    const overlays = await loadOverlays(draftId);
    return overlays.length > 0;
  } catch {
    return false;
  }
}

/**
 * Copy overlays from one draft to another
 * Useful for duplicating drafts
 * 
 * @param sourceDraftId - Source draft ID
 * @param targetDraftId - Target draft ID
 */
export async function copyOverlays(
  sourceDraftId: string,
  targetDraftId: string
): Promise<void> {
  try {
    const overlays = await loadOverlays(sourceDraftId);
    if (overlays.length > 0) {
      await saveOverlays(targetDraftId, overlays);
      console.log(`[OverlayPersistence] Copied overlays from ${sourceDraftId} to ${targetDraftId}`);
    }
  } catch (error) {
    console.error('[OverlayPersistence] Failed to copy overlays:', error);
    // Non-critical - don't throw
  }
}

/**
 * Migrate overlay logo URIs if needed
 * This handles cases where logo URIs might change (e.g., Brand Kit update)
 * 
 * @param draftId - The draft ID
 * @param oldUri - Old URI to find
 * @param newUri - New URI to replace with
 */
export async function migrateLogoUri(
  draftId: string,
  oldUri: string,
  newUri: string
): Promise<void> {
  try {
    const overlays = await loadOverlays(draftId);
    let modified = false;
    
    const updatedOverlays = overlays.map(overlay => {
      if (overlay.type === 'logo' && overlay.imageUri === oldUri) {
        modified = true;
        return { ...overlay, imageUri: newUri, updatedAt: new Date().toISOString() };
      }
      return overlay;
    });
    
    if (modified) {
      await saveOverlays(draftId, updatedOverlays);
      console.log('[OverlayPersistence] Migrated logo URIs for draft:', draftId);
    }
  } catch (error) {
    console.error('[OverlayPersistence] Failed to migrate logo URIs:', error);
  }
}
