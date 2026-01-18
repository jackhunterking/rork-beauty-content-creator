/**
 * Overlay Persistence Service
 * 
 * Manages local storage of overlay data for drafts.
 * Overlays are stored as JSON files in the draft directory.
 * 
 * This approach keeps overlay data local (Pro feature) while
 * the main draft metadata remains in Supabase.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Overlay } from '@/types/overlays';
import { getDraftDirectory, createDraftDirectories } from './localStorageService';

// Encoding type constants - use string literals for expo-file-system/legacy compatibility
const ENCODING_UTF8 = 'utf8' as const;
const ENCODING_BASE64 = 'base64' as const;

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
  console.log(`[OverlayPersistence] saveOverlays called:`, {
    draftId,
    overlayCount: overlays.length,
    overlayTypes: overlays.map(o => o.type),
    overlayIds: overlays.map(o => o.id),
  });
  
  try {
    // Ensure draft directories exist
    await createDraftDirectories(draftId);
    
    const filePath = getOverlaysFilePath(draftId);
    console.log(`[OverlayPersistence] Writing to:`, filePath);
    
    const data = JSON.stringify(overlays, null, 2);
    
    await FileSystem.writeAsStringAsync(filePath, data, {
      encoding: ENCODING_UTF8,
    });
    
    console.log(`[OverlayPersistence] Successfully saved ${overlays.length} overlays for draft:`, draftId);
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
  console.log(`[OverlayPersistence] loadOverlays called for draft:`, draftId);
  
  try {
    const filePath = getOverlaysFilePath(draftId);
    console.log(`[OverlayPersistence] Checking file:`, filePath);
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      console.log(`[OverlayPersistence] No overlays file found for draft:`, draftId);
      return [];
    }
    
    const data = await FileSystem.readAsStringAsync(filePath, {
      encoding: ENCODING_UTF8,
    });
    
    const overlays = JSON.parse(data) as Overlay[];
    
    console.log(`[OverlayPersistence] Successfully loaded ${overlays.length} overlays for draft:`, draftId, {
      overlayTypes: overlays.map(o => o.type),
      overlayIds: overlays.map(o => o.id),
    });
    
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
