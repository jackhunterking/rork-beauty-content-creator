/**
 * Editor Domain Types
 * 
 * Core types for the editor - the single source of truth for all editing operations.
 * SlotData is the unified data model that bundles all slot information together,
 * eliminating the fragmented state that caused sync issues.
 */

import type { Template, Overlay, TemplateFormat } from '@/types';

// ============================================
// AI Feature Types
// ============================================

/**
 * Available AI feature keys
 */
export type AIFeatureKey = 'auto_quality' | 'background_remove' | 'background_replace';

/**
 * Gradient direction for background replacement
 */
export type GradientDirection = 'vertical' | 'horizontal' | 'diagonal-tl' | 'diagonal-tr';

/**
 * Gradient configuration for background replacement
 */
export interface GradientConfig {
  type: 'linear';
  colors: [string, string];
  direction: GradientDirection;
}

/**
 * Background info for transparent PNGs
 * Used to display solid color, gradient, or transparent background behind the image.
 */
export interface BackgroundInfo {
  type: 'solid' | 'gradient' | 'transparent';
  solidColor?: string;
  gradient?: GradientConfig;
}

// ============================================
// Slot Data Types (Unified Data Model)
// ============================================

/**
 * Image adjustments (pan/zoom/rotate)
 */
export interface ImageAdjustments {
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
}

/**
 * Default adjustments for a new image
 */
export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  rotation: 0,
};

/**
 * AI enhancement state for a slot
 * All AI-related data is bundled together to prevent sync issues
 */
export interface SlotAIState {
  /** Original URI before any AI processing */
  originalUri: string;
  /** List of enhancements applied to this image */
  enhancementsApplied: AIFeatureKey[];
  /** Cached transparent PNG URL for color changes (avoids re-running birefnet) */
  transparentPngUrl?: string;
  /** Background replacement info (solid color, gradient, or transparent) */
  backgroundInfo?: BackgroundInfo;
}

/**
 * SlotData - The unified data model for a single slot
 * 
 * This is THE single source of truth for a slot's state.
 * All slot changes go through this structure atomically.
 */
export interface SlotData {
  // Core image data
  uri: string;
  width: number;
  height: number;
  
  // User adjustments (pan/zoom/rotate)
  adjustments: ImageAdjustments;
  
  // AI enhancement state - ALL bundled together
  ai: SlotAIState;
}

/**
 * Factory function to create default SlotData
 */
export function createSlotData(uri: string, width: number, height: number): SlotData {
  return {
    uri,
    width,
    height,
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    ai: {
      originalUri: uri,
      enhancementsApplied: [],
    },
  };
}

/**
 * Map of slot IDs to their data
 */
export type CapturedSlots = Record<string, SlotData | null>;

// ============================================
// AI Result Types
// ============================================

/**
 * AIResult - Complete result from AI processing
 * 
 * AI views return this complete object, eliminating the need for
 * intermediate state that could get out of sync.
 */
export interface AIResult {
  /** The enhanced image URI */
  uri: string;
  /** Which AI feature was applied */
  featureKey: AIFeatureKey;
  /** Transparent PNG URL (for background_replace/remove) */
  transparentPngUrl?: string;
  /** Background info (for background_replace) */
  backgroundInfo?: BackgroundInfo;
}

// ============================================
// Editor State Types
// ============================================

/**
 * EditorState - The complete state of the editor
 * 
 * This is the single source of truth for all editing operations.
 */
export interface EditorState {
  // Project identity
  projectId: string | null;
  templateId: string;
  template: Template | null;
  projectName: string | null;
  
  // Slots - THE single source of truth
  slots: CapturedSlots;
  
  // Canvas appearance
  backgroundColor: string;
  themeColor: string | null;
  
  // Overlays (managed separately but stored here)
  overlays: Overlay[];
  
  // Selection state
  selectedSlotId: string | null;
  selectedOverlayId: string | null;
  
  // Dirty tracking
  isDirty: boolean;
  lastSavedAt: Date | null;
}

/**
 * Default editor state factory
 */
export function createInitialEditorState(): EditorState {
  return {
    projectId: null,
    templateId: '',
    template: null,
    projectName: null,
    slots: {},
    backgroundColor: '#FFFFFF',
    themeColor: null,
    overlays: [],
    selectedSlotId: null,
    selectedOverlayId: null,
    isDirty: false,
    lastSavedAt: null,
  };
}

// ============================================
// Editor Actions Types
// ============================================

/**
 * EditorActions - All operations that can be performed on the editor
 */
export interface EditorActions {
  // Initialization
  startNewProject(template: Template): void;
  loadProject(projectId: string, template: Template, slots: CapturedSlots, options?: {
    projectName?: string | null;
    backgroundColor?: string;
    themeColor?: string | null;
    overlays?: Overlay[];
  }): void;
  
  // Slot operations - ALL slot changes go through these
  captureImage(slotId: string, uri: string, width: number, height: number): void;
  updateSlot(slotId: string, updates: Partial<SlotData>): void;
  updateSlotAdjustments(slotId: string, adjustments: Partial<ImageAdjustments>): void;
  applyAIResult(slotId: string, aiResult: AIResult): void;
  clearSlot(slotId: string): void;
  
  // Overlay operations
  addOverlay(overlay: Overlay): void;
  updateOverlay(overlayId: string, updates: Partial<Overlay>): void;
  deleteOverlay(overlayId: string): void;
  
  // Canvas operations
  setBackgroundColor(color: string): void;
  setThemeColor(color: string | null): void;
  setProjectName(name: string | null): void;
  
  // Selection
  selectSlot(slotId: string | null): void;
  selectOverlay(overlayId: string | null): void;
  clearSelection(): void;
  
  // Dirty tracking
  markDirty(): void;
  markClean(savedAt?: Date): void;
  
  // Reset
  reset(): void;
}

/**
 * Combined Editor context type
 */
export interface EditorContextType extends EditorState, EditorActions {}

// ============================================
// Slot State Types (for UI loading indicators)
// ============================================

export type SlotState = 
  | 'empty'
  | 'capturing'
  | 'processing'
  | 'uploading'
  | 'ready'
  | 'error';

export interface SlotStateInfo {
  state: SlotState;
  errorMessage?: string;
  progress?: number;
}

export type SlotStates = Record<string, SlotStateInfo>;
