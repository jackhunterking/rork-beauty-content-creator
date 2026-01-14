import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalDraftIndex } from '@/types';

/**
 * Draft Index Service
 * 
 * Lightweight AsyncStorage index for quick draft listing.
 * Avoids reading full draft files from FileSystem for performance.
 * 
 * The index is synced with the actual file system on app start
 * and updated whenever drafts are created/modified/deleted.
 */

const DRAFT_INDEX_KEY = 'resulta_draft_index';
const DRAFT_COUNT_KEY = 'resulta_draft_count';

// ============================================
// Index Management
// ============================================

/**
 * Get the full draft index from AsyncStorage
 */
export async function getDraftIndex(): Promise<LocalDraftIndex[]> {
  try {
    const indexJson = await AsyncStorage.getItem(DRAFT_INDEX_KEY);
    if (!indexJson) {
      return [];
    }
    return JSON.parse(indexJson) as LocalDraftIndex[];
  } catch (error) {
    console.error('Error reading draft index:', error);
    return [];
  }
}

/**
 * Save the full draft index to AsyncStorage
 */
export async function saveDraftIndex(index: LocalDraftIndex[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(index));
    await AsyncStorage.setItem(DRAFT_COUNT_KEY, String(index.length));
  } catch (error) {
    console.error('Error saving draft index:', error);
    throw error;
  }
}

/**
 * Add a draft to the index
 */
export async function addToIndex(draftIndex: LocalDraftIndex): Promise<void> {
  const index = await getDraftIndex();
  
  // Check if already exists
  const existingIdx = index.findIndex(d => d.id === draftIndex.id);
  if (existingIdx !== -1) {
    // Update existing
    index[existingIdx] = draftIndex;
  } else {
    // Add new at beginning (most recent)
    index.unshift(draftIndex);
  }
  
  await saveDraftIndex(index);
}

/**
 * Update a draft in the index
 */
export async function updateInIndex(
  draftId: string,
  updates: Partial<LocalDraftIndex>
): Promise<void> {
  const index = await getDraftIndex();
  const idx = index.findIndex(d => d.id === draftId);
  
  if (idx !== -1) {
    index[idx] = { ...index[idx], ...updates };
    // Move to front (most recently updated)
    const [updated] = index.splice(idx, 1);
    index.unshift(updated);
    await saveDraftIndex(index);
  }
}

/**
 * Remove a draft from the index
 */
export async function removeFromIndex(draftId: string): Promise<void> {
  const index = await getDraftIndex();
  const filteredIndex = index.filter(d => d.id !== draftId);
  await saveDraftIndex(filteredIndex);
}

/**
 * Clear the entire index
 */
export async function clearIndex(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_INDEX_KEY);
  await AsyncStorage.setItem(DRAFT_COUNT_KEY, '0');
}

// ============================================
// Index Queries
// ============================================

/**
 * Get draft count (fast, from cached value)
 */
export async function getDraftCountFast(): Promise<number> {
  try {
    const count = await AsyncStorage.getItem(DRAFT_COUNT_KEY);
    return count ? parseInt(count, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Check if a draft exists in the index
 */
export async function isDraftInIndex(draftId: string): Promise<boolean> {
  const index = await getDraftIndex();
  return index.some(d => d.id === draftId);
}

/**
 * Get a single draft's index entry
 */
export async function getDraftIndexEntry(
  draftId: string
): Promise<LocalDraftIndex | null> {
  const index = await getDraftIndex();
  return index.find(d => d.id === draftId) || null;
}

/**
 * Get drafts for a specific template
 */
export async function getDraftsByTemplate(
  templateId: string
): Promise<LocalDraftIndex[]> {
  const index = await getDraftIndex();
  return index.filter(d => d.templateId === templateId);
}

/**
 * Get completed drafts (all slots filled)
 */
export async function getCompletedDrafts(): Promise<LocalDraftIndex[]> {
  const index = await getDraftIndex();
  return index.filter(d => d.filledSlotCount >= d.slotCount && d.slotCount > 0);
}

/**
 * Get incomplete drafts
 */
export async function getIncompleteDrafts(): Promise<LocalDraftIndex[]> {
  const index = await getDraftIndex();
  return index.filter(d => d.filledSlotCount < d.slotCount);
}

/**
 * Get drafts with cached renders
 */
export async function getDraftsWithRenders(): Promise<LocalDraftIndex[]> {
  const index = await getDraftIndex();
  return index.filter(d => d.hasRender);
}

// ============================================
// Index Sync
// ============================================

/**
 * Rebuild the index from file system
 * Call this on app start to ensure index is in sync
 */
export async function rebuildIndex(
  loadDraftsFn: () => Promise<{ id: string; templateId: string; templateName: string; updatedAt: string; createdAt: string; slots: Record<string, unknown>; cachedRenders: Record<string, unknown> }[]>,
  templates: { id: string; name: string }[]
): Promise<LocalDraftIndex[]> {
  try {
    const drafts = await loadDraftsFn();
    const templateMap = new Map(templates.map(t => [t.id, t.name]));
    
    const index: LocalDraftIndex[] = drafts.map(draft => ({
      id: draft.id,
      templateId: draft.templateId,
      templateName: templateMap.get(draft.templateId) || 'Unknown Template',
      thumbnailPath: Object.values(draft.slots)[0] 
        ? (Object.values(draft.slots)[0] as { localPath?: string }).localPath 
        : undefined,
      slotCount: 0, // Will be updated when template is known
      filledSlotCount: Object.keys(draft.slots).length,
      hasRender: Object.keys(draft.cachedRenders).length > 0,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    }));
    
    // Sort by updatedAt, most recent first
    index.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    await saveDraftIndex(index);
    return index;
  } catch (error) {
    console.error('Error rebuilding draft index:', error);
    return [];
  }
}

// ============================================
// Index Statistics
// ============================================

export interface DraftIndexStats {
  totalDrafts: number;
  completedDrafts: number;
  incompleteDrafts: number;
  draftsWithRenders: number;
  templateCounts: Record<string, number>;
}

/**
 * Get statistics about drafts
 */
export async function getDraftStats(): Promise<DraftIndexStats> {
  const index = await getDraftIndex();
  
  const stats: DraftIndexStats = {
    totalDrafts: index.length,
    completedDrafts: 0,
    incompleteDrafts: 0,
    draftsWithRenders: 0,
    templateCounts: {},
  };
  
  for (const draft of index) {
    // Count completed vs incomplete
    if (draft.filledSlotCount >= draft.slotCount && draft.slotCount > 0) {
      stats.completedDrafts++;
    } else {
      stats.incompleteDrafts++;
    }
    
    // Count renders
    if (draft.hasRender) {
      stats.draftsWithRenders++;
    }
    
    // Count by template
    stats.templateCounts[draft.templateId] = 
      (stats.templateCounts[draft.templateId] || 0) + 1;
  }
  
  return stats;
}

// ============================================
// Batch Operations
// ============================================

/**
 * Update slot count for drafts (after loading templates)
 */
export async function updateSlotCounts(
  slotCountsMap: Record<string, number>
): Promise<void> {
  const index = await getDraftIndex();
  let updated = false;
  
  for (const draft of index) {
    const slotCount = slotCountsMap[draft.templateId];
    if (slotCount !== undefined && draft.slotCount !== slotCount) {
      draft.slotCount = slotCount;
      updated = true;
    }
  }
  
  if (updated) {
    await saveDraftIndex(index);
  }
}

/**
 * Bulk update hasRender flag
 */
export async function updateRenderFlags(
  renderMap: Record<string, boolean>
): Promise<void> {
  const index = await getDraftIndex();
  let updated = false;
  
  for (const draft of index) {
    const hasRender = renderMap[draft.id];
    if (hasRender !== undefined && draft.hasRender !== hasRender) {
      draft.hasRender = hasRender;
      updated = true;
    }
  }
  
  if (updated) {
    await saveDraftIndex(index);
  }
}

