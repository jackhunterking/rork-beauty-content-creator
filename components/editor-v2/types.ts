/**
 * Editor V2 Types
 * 
 * Type definitions for the new canvas-based editor experience.
 */

import { Overlay } from '@/types/overlays';
import { Slot, MediaAsset } from '@/types';

/**
 * Tools available in the bottom dock
 */
export type ToolType = 'photo' | 'text' | 'date' | 'logo' | 'enhance';

/**
 * Types of elements that can be selected on the canvas
 */
export type SelectableType = 'slot' | 'text' | 'date' | 'logo';

/**
 * Current selection state on the canvas
 */
export interface SelectionState {
  /** Type of selected element */
  type: SelectableType | null;
  /** ID of selected element (slotId or overlayId) */
  id: string | null;
  /** Whether the element is being actively transformed */
  isTransforming: boolean;
}

/**
 * Transform state for an element
 */
export interface TransformState {
  /** Scale factor (1.0 = original size) */
  scale: number;
  /** Rotation in degrees */
  rotation: number;
  /** X translation (pan) within the slot */
  translateX: number;
  /** Y translation (pan) within the slot */
  translateY: number;
}

/**
 * Photo slot with transform state
 */
export interface SlotWithTransform extends Slot {
  /** The captured media for this slot */
  media: MediaAsset | null;
  /** Current transform state */
  transform: TransformState;
  /** Whether AI enhancement has been applied */
  aiEnhanced: boolean;
}

/**
 * Complete editor state for V2
 */
export interface EditorV2State {
  /** Current active tool in the dock */
  activeTool: ToolType;
  /** Current selection on the canvas */
  selection: SelectionState;
  /** Slots with their media and transforms */
  slots: Record<string, SlotWithTransform>;
  /** Overlays (text, date, logo) */
  overlays: Overlay[];
  /** Whether camera sheet is visible */
  isCameraSheetVisible: boolean;
  /** Slot ID being captured (when camera is open) */
  capturingSlotId: string | null;
  /** Whether AI panel is visible */
  isAIPanelVisible: boolean;
}

/**
 * Actions available in the contextual toolbar based on selection type
 */
export interface ContextualAction {
  id: string;
  icon: string;
  label: string;
  onPress: () => void;
  isPro?: boolean;
}

/**
 * AI Enhancement types available
 * Re-exported from main types for compatibility
 */
export type { AIEnhancementType, AIFeatureKey, AIModelConfig } from '@/types';

/**
 * AI Enhancement option (legacy interface, use AIModelConfig for new code)
 */
export interface AIEnhancementOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  isPro: boolean;
  costCredits?: number;
}

/**
 * Default transform state
 */
export const DEFAULT_TRANSFORM: TransformState = {
  scale: 1.0,
  rotation: 0,
  translateX: 0,
  translateY: 0,
};

/**
 * Default selection state (nothing selected)
 */
export const DEFAULT_SELECTION: SelectionState = {
  type: null,
  id: null,
  isTransforming: false,
};

/**
 * Default editor state
 */
export const DEFAULT_EDITOR_STATE: EditorV2State = {
  activeTool: 'photo',
  selection: DEFAULT_SELECTION,
  slots: {},
  overlays: [],
  isCameraSheetVisible: false,
  capturingSlotId: null,
  isAIPanelVisible: false,
};
