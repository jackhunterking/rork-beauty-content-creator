import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const DOCUMENTS_DIR = FileSystem.documentDirectory || '';
const DRAFTS_DIR = `${DOCUMENTS_DIR}drafts/`;
const RENDER_CACHE_DIR = `${DOCUMENTS_DIR}render-cache/`;

export async function initializeLocalStorage(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await ensureDirectoryExists(DRAFTS_DIR);
  await ensureDirectoryExists(RENDER_CACHE_DIR);
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    const info = await FileSystem.getInfoAsync(dirPath);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
  } catch (error) {
    console.error('Error ensuring directory exists:', error);
  }
}

export function getDraftDirectory(draftId: string): string {
  return `${DRAFTS_DIR}${draftId}/`;
}

export function getDraftSlotsDirectory(draftId: string): string {
  return `${getDraftDirectory(draftId)}slots/`;
}

export function getDraftRendersDirectory(draftId: string): string {
  return `${getDraftDirectory(draftId)}renders/`;
}

export async function createDraftDirectories(draftId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await ensureDirectoryExists(getDraftDirectory(draftId));
  await ensureDirectoryExists(getDraftSlotsDirectory(draftId));
  await ensureDirectoryExists(getDraftRendersDirectory(draftId));
}

export async function copyFile(sourceUri: string, destPath: string): Promise<string> {
  if (Platform.OS === 'web') {
    return sourceUri;
  }
  const destDir = destPath.substring(0, destPath.lastIndexOf('/') + 1);
  await ensureDirectoryExists(destDir);
  await FileSystem.copyAsync({ from: sourceUri, to: destPath });
  return destPath;
}

export async function moveFile(sourceUri: string, destPath: string): Promise<string> {
  if (Platform.OS === 'web') {
    return sourceUri;
  }
  const destDir = destPath.substring(0, destPath.lastIndexOf('/') + 1);
  await ensureDirectoryExists(destDir);
  await FileSystem.moveAsync({ from: sourceUri, to: destPath });
  return destPath;
}

export async function deleteFile(filePath: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
}

export async function deleteDirectory(dirPath: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    const info = await FileSystem.getInfoAsync(dirPath);
    if (info.exists) {
      await FileSystem.deleteAsync(dirPath, { idempotent: true });
    }
  } catch (error) {
    console.error('Error deleting directory:', error);
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    return info.exists;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) {
      return null;
    }
    const content = await FileSystem.readAsStringAsync(filePath);
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('Error reading JSON file:', error);
    return null;
  }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
  await ensureDirectoryExists(dirPath);
  await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data, null, 2));
}

export async function listDirectory(dirPath: string): Promise<string[]> {
  if (Platform.OS === 'web') {
    return [];
  }
  try {
    const info = await FileSystem.getInfoAsync(dirPath);
    if (!info.exists) {
      return [];
    }
    return await FileSystem.readDirectoryAsync(dirPath);
  } catch {
    return [];
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function generateHash(input: string): Promise<string> {
  return simpleHash(input).substring(0, 12);
}

export async function generateRenderCacheKey(
  templateId: string,
  slotImageUris: Record<string, string>,
  themeId: string = 'default'
): Promise<string> {
  const sortedSlots = Object.entries(slotImageUris)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slotId, uri]) => `${slotId}:${uri}`)
    .join('|');
  
  const hashInput = `${templateId}_${sortedSlots}_${themeId}`;
  const hash = await generateHash(hashInput);
  
  return `${templateId}_${hash}_${themeId}`;
}

export async function saveDraftSlotImage(
  draftId: string,
  slotId: string,
  sourceUri: string
): Promise<string> {
  if (Platform.OS === 'web') {
    return sourceUri;
  }
  const slotsDir = getDraftSlotsDirectory(draftId);
  await ensureDirectoryExists(slotsDir);
  
  const destPath = `${slotsDir}${slotId}.jpg`;
  await copyFile(sourceUri, destPath);
  
  return destPath;
}

export function getDraftSlotImagePath(draftId: string, slotId: string): string {
  return `${getDraftSlotsDirectory(draftId)}${slotId}.jpg`;
}

export async function draftSlotImageExists(
  draftId: string,
  slotId: string
): Promise<boolean> {
  const path = getDraftSlotImagePath(draftId, slotId);
  return fileExists(path);
}

export function getCachedRenderPath(draftId: string, themeId: string = 'default'): string {
  return `${getDraftRendersDirectory(draftId)}${themeId}.jpg`;
}

export function getGlobalCachePath(cacheKey: string): string {
  return `${RENDER_CACHE_DIR}${cacheKey}.jpg`;
}

export async function saveDraftRender(
  draftId: string,
  sourceUri: string,
  themeId: string = 'default'
): Promise<string> {
  if (Platform.OS === 'web') {
    return sourceUri;
  }
  const rendersDir = getDraftRendersDirectory(draftId);
  await ensureDirectoryExists(rendersDir);
  
  const destPath = getCachedRenderPath(draftId, themeId);
  await copyFile(sourceUri, destPath);
  
  return destPath;
}

/**
 * Download and save a rendered preview from a remote URL to local storage
 * Used to cache Templated.io previews locally for instant access
 * 
 * @param draftId - The draft ID to associate the preview with
 * @param remoteUrl - The remote URL of the rendered preview (e.g., from Templated.io)
 * @param themeId - Optional theme ID for the render (defaults to 'default')
 * @returns The local file path where the preview was saved, or null if failed
 */
export async function saveRenderedPreview(
  draftId: string,
  remoteUrl: string,
  themeId: string = 'default'
): Promise<string | null> {
  if (Platform.OS === 'web') {
    // On web, just return the remote URL as we can't save locally
    return remoteUrl;
  }
  
  try {
    // Ensure the draft renders directory exists
    const rendersDir = getDraftRendersDirectory(draftId);
    await ensureDirectoryExists(rendersDir);
    
    // Generate local path for the preview
    const localPath = getCachedRenderPath(draftId, themeId);
    
    // Download the image from remote URL
    console.log(`[LocalStorage] Downloading preview for draft ${draftId} from ${remoteUrl}`);
    
    const downloadResult = await FileSystem.downloadAsync(remoteUrl, localPath);
    
    if (downloadResult.status !== 200) {
      console.error(`[LocalStorage] Failed to download preview: HTTP ${downloadResult.status}`);
      return null;
    }
    
    // Verify the file was saved
    const exists = await fileExists(localPath);
    if (!exists) {
      console.error('[LocalStorage] Preview file was not saved');
      return null;
    }
    
    console.log(`[LocalStorage] Preview saved to ${localPath}`);
    return localPath;
  } catch (error) {
    console.error('[LocalStorage] Error saving rendered preview:', error);
    return null;
  }
}

/**
 * Get the local preview path for a draft if it exists
 * Returns null if no local preview is cached
 */
export async function getLocalPreviewPath(
  draftId: string,
  themeId: string = 'default'
): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  
  const localPath = getCachedRenderPath(draftId, themeId);
  const exists = await fileExists(localPath);
  
  return exists ? localPath : null;
}

export async function draftRenderExists(
  draftId: string,
  themeId: string = 'default'
): Promise<boolean> {
  const path = getCachedRenderPath(draftId, themeId);
  return fileExists(path);
}

export async function invalidateDraftRenderCache(draftId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  const rendersDir = getDraftRendersDirectory(draftId);
  await deleteDirectory(rendersDir);
  await ensureDirectoryExists(rendersDir);
}

export async function getDraftsStorageSize(): Promise<number> {
  return getDirectorySize(DRAFTS_DIR);
}

export async function getRenderCacheSize(): Promise<number> {
  return getDirectorySize(RENDER_CACHE_DIR);
}

async function getDirectorySize(dirPath: string): Promise<number> {
  if (Platform.OS === 'web') {
    return 0;
  }
  let totalSize = 0;
  
  try {
    const info = await FileSystem.getInfoAsync(dirPath);
    if (!info.exists) {
      return 0;
    }
    
    const items = await FileSystem.readDirectoryAsync(dirPath);
    
    for (const item of items) {
      const itemPath = `${dirPath}${item}`;
      const itemInfo = await FileSystem.getInfoAsync(itemPath);
      
      if (itemInfo.exists) {
        if (itemInfo.isDirectory) {
          totalSize += await getDirectorySize(`${itemPath}/`);
        } else {
          totalSize += itemInfo.size ?? 0;
        }
      }
    }
  } catch (error) {
    console.error('Error calculating directory size:', error);
  }
  
  return totalSize;
}

export async function clearRenderCache(): Promise<void> {
  await deleteDirectory(RENDER_CACHE_DIR);
  await ensureDirectoryExists(RENDER_CACHE_DIR);
}

export async function clearAllLocalStorage(): Promise<void> {
  await deleteDirectory(DRAFTS_DIR);
  await deleteDirectory(RENDER_CACHE_DIR);
  await initializeLocalStorage();
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const STORAGE_PATHS = {
  DOCUMENTS: DOCUMENTS_DIR,
  DRAFTS: DRAFTS_DIR,
  RENDER_CACHE: RENDER_CACHE_DIR,
};
