/**
 * EditorContext - The Heart of the App
 * 
 * This is THE single source of truth for all editing operations.
 * All slot changes, overlay changes, and canvas changes go through this context.
 * 
 * Key design principles:
 * 1. Single source of truth - slots contain ALL data about each slot
 * 2. Atomic updates - changes are bundled together, preventing sync issues
 * 3. Clean API - clear actions for each operation type
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import type { Template, Overlay } from '@/types';
import {
  EditorState,
  EditorActions,
  EditorContextType,
  SlotData,
  AIResult,
  ImageAdjustments,
  CapturedSlots,
  createInitialEditorState,
  createSlotData,
  DEFAULT_ADJUSTMENTS,
} from './types';

// ============================================
// Reducer Actions
// ============================================

type EditorAction =
  | { type: 'START_NEW_PROJECT'; template: Template }
  | { type: 'LOAD_PROJECT'; projectId: string; template: Template; slots: CapturedSlots; options?: { projectName?: string | null; backgroundColor?: string; themeColor?: string | null; overlays?: Overlay[] } }
  | { type: 'CAPTURE_IMAGE'; slotId: string; uri: string; width: number; height: number }
  | { type: 'UPDATE_SLOT'; slotId: string; updates: Partial<SlotData> }
  | { type: 'UPDATE_SLOT_ADJUSTMENTS'; slotId: string; adjustments: Partial<ImageAdjustments> }
  | { type: 'APPLY_AI_RESULT'; slotId: string; aiResult: AIResult }
  | { type: 'CLEAR_SLOT'; slotId: string }
  | { type: 'ADD_OVERLAY'; overlay: Overlay }
  | { type: 'UPDATE_OVERLAY'; overlayId: string; updates: Partial<Overlay> }
  | { type: 'DELETE_OVERLAY'; overlayId: string }
  | { type: 'SET_BACKGROUND_COLOR'; color: string }
  | { type: 'SET_THEME_COLOR'; color: string | null }
  | { type: 'SET_PROJECT_NAME'; name: string | null }
  | { type: 'SELECT_SLOT'; slotId: string | null }
  | { type: 'SELECT_OVERLAY'; overlayId: string | null }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_CLEAN'; savedAt?: Date }
  | { type: 'RESET' };

// ============================================
// Reducer
// ============================================

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'START_NEW_PROJECT':
      return {
        ...createInitialEditorState(),
        templateId: action.template.id,
        template: action.template,
        backgroundColor: action.template.defaultBackgroundColor || '#FFFFFF',
        themeColor: action.template.defaultThemeColor || null,
      };

    case 'LOAD_PROJECT':
      return {
        ...createInitialEditorState(),
        projectId: action.projectId,
        templateId: action.template.id,
        template: action.template,
        slots: action.slots,
        projectName: action.options?.projectName ?? null,
        backgroundColor: action.options?.backgroundColor || action.template.defaultBackgroundColor || '#FFFFFF',
        themeColor: action.options?.themeColor ?? action.template.defaultThemeColor ?? null,
        overlays: action.options?.overlays || [],
        isDirty: false,
        lastSavedAt: new Date(),
      };

    case 'CAPTURE_IMAGE': {
      const newSlotData = createSlotData(action.uri, action.width, action.height);
      return {
        ...state,
        slots: {
          ...state.slots,
          [action.slotId]: newSlotData,
        },
        selectedSlotId: action.slotId,
        isDirty: true,
      };
    }

    case 'UPDATE_SLOT': {
      const currentSlot = state.slots[action.slotId];
      if (!currentSlot) return state;

      return {
        ...state,
        slots: {
          ...state.slots,
          [action.slotId]: {
            ...currentSlot,
            ...action.updates,
            // Deep merge for nested objects
            adjustments: action.updates.adjustments 
              ? { ...currentSlot.adjustments, ...action.updates.adjustments }
              : currentSlot.adjustments,
            ai: action.updates.ai
              ? { ...currentSlot.ai, ...action.updates.ai }
              : currentSlot.ai,
          },
        },
        isDirty: true,
      };
    }

    case 'UPDATE_SLOT_ADJUSTMENTS': {
      const currentSlot = state.slots[action.slotId];
      if (!currentSlot) return state;

      return {
        ...state,
        slots: {
          ...state.slots,
          [action.slotId]: {
            ...currentSlot,
            adjustments: {
              ...currentSlot.adjustments,
              ...action.adjustments,
            },
          },
        },
        isDirty: true,
      };
    }

    case 'APPLY_AI_RESULT': {
      const currentSlot = state.slots[action.slotId];
      if (!currentSlot) return state;

      const { aiResult } = action;
      
      // Build the new AI state atomically
      const newAIState = {
        ...currentSlot.ai,
        enhancementsApplied: currentSlot.ai.enhancementsApplied.includes(aiResult.featureKey)
          ? currentSlot.ai.enhancementsApplied
          : [...currentSlot.ai.enhancementsApplied, aiResult.featureKey],
        transparentPngUrl: aiResult.transparentPngUrl ?? currentSlot.ai.transparentPngUrl,
        backgroundInfo: aiResult.backgroundInfo ?? currentSlot.ai.backgroundInfo,
      };

      return {
        ...state,
        slots: {
          ...state.slots,
          [action.slotId]: {
            ...currentSlot,
            uri: aiResult.uri,
            // Reset adjustments when AI enhancement is applied
            adjustments: { ...DEFAULT_ADJUSTMENTS },
            ai: newAIState,
          },
        },
        isDirty: true,
      };
    }

    case 'CLEAR_SLOT':
      return {
        ...state,
        slots: {
          ...state.slots,
          [action.slotId]: null,
        },
        selectedSlotId: state.selectedSlotId === action.slotId ? null : state.selectedSlotId,
        isDirty: true,
      };

    case 'ADD_OVERLAY':
      return {
        ...state,
        overlays: [...state.overlays, action.overlay],
        selectedOverlayId: action.overlay.id,
        selectedSlotId: null,
        isDirty: true,
      };

    case 'UPDATE_OVERLAY':
      return {
        ...state,
        overlays: state.overlays.map(o =>
          o.id === action.overlayId ? { ...o, ...action.updates } : o
        ),
        isDirty: true,
      };

    case 'DELETE_OVERLAY':
      return {
        ...state,
        overlays: state.overlays.filter(o => o.id !== action.overlayId),
        selectedOverlayId: state.selectedOverlayId === action.overlayId ? null : state.selectedOverlayId,
        isDirty: true,
      };

    case 'SET_BACKGROUND_COLOR':
      return {
        ...state,
        backgroundColor: action.color,
        isDirty: true,
      };

    case 'SET_THEME_COLOR':
      return {
        ...state,
        themeColor: action.color,
        isDirty: true,
      };

    case 'SET_PROJECT_NAME':
      return {
        ...state,
        projectName: action.name,
        isDirty: true,
      };

    case 'SELECT_SLOT':
      return {
        ...state,
        selectedSlotId: action.slotId,
        selectedOverlayId: action.slotId ? null : state.selectedOverlayId,
      };

    case 'SELECT_OVERLAY':
      return {
        ...state,
        selectedOverlayId: action.overlayId,
        selectedSlotId: action.overlayId ? null : state.selectedSlotId,
      };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedSlotId: null,
        selectedOverlayId: null,
      };

    case 'MARK_DIRTY':
      return {
        ...state,
        isDirty: true,
      };

    case 'MARK_CLEAN':
      return {
        ...state,
        isDirty: false,
        lastSavedAt: action.savedAt || new Date(),
      };

    case 'RESET':
      return createInitialEditorState();

    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

const EditorContext = createContext<EditorContextType | null>(null);

// ============================================
// Provider
// ============================================

interface EditorProviderProps {
  children: React.ReactNode;
}

export function EditorProvider({ children }: EditorProviderProps) {
  const [state, dispatch] = useReducer(editorReducer, createInitialEditorState());

  // Actions
  const startNewProject = useCallback((template: Template) => {
    dispatch({ type: 'START_NEW_PROJECT', template });
  }, []);

  const loadProject = useCallback((
    projectId: string,
    template: Template,
    slots: CapturedSlots,
    options?: {
      projectName?: string | null;
      backgroundColor?: string;
      themeColor?: string | null;
      overlays?: Overlay[];
    }
  ) => {
    dispatch({ type: 'LOAD_PROJECT', projectId, template, slots, options });
  }, []);

  const captureImage = useCallback((slotId: string, uri: string, width: number, height: number) => {
    dispatch({ type: 'CAPTURE_IMAGE', slotId, uri, width, height });
  }, []);

  const updateSlot = useCallback((slotId: string, updates: Partial<SlotData>) => {
    dispatch({ type: 'UPDATE_SLOT', slotId, updates });
  }, []);

  const updateSlotAdjustments = useCallback((slotId: string, adjustments: Partial<ImageAdjustments>) => {
    dispatch({ type: 'UPDATE_SLOT_ADJUSTMENTS', slotId, adjustments });
  }, []);

  const applyAIResult = useCallback((slotId: string, aiResult: AIResult) => {
    dispatch({ type: 'APPLY_AI_RESULT', slotId, aiResult });
  }, []);

  const clearSlot = useCallback((slotId: string) => {
    dispatch({ type: 'CLEAR_SLOT', slotId });
  }, []);

  const addOverlay = useCallback((overlay: Overlay) => {
    dispatch({ type: 'ADD_OVERLAY', overlay });
  }, []);

  const updateOverlay = useCallback((overlayId: string, updates: Partial<Overlay>) => {
    dispatch({ type: 'UPDATE_OVERLAY', overlayId, updates });
  }, []);

  const deleteOverlay = useCallback((overlayId: string) => {
    dispatch({ type: 'DELETE_OVERLAY', overlayId });
  }, []);

  const setBackgroundColor = useCallback((color: string) => {
    dispatch({ type: 'SET_BACKGROUND_COLOR', color });
  }, []);

  const setThemeColor = useCallback((color: string | null) => {
    dispatch({ type: 'SET_THEME_COLOR', color });
  }, []);

  const setProjectName = useCallback((name: string | null) => {
    dispatch({ type: 'SET_PROJECT_NAME', name });
  }, []);

  const selectSlot = useCallback((slotId: string | null) => {
    dispatch({ type: 'SELECT_SLOT', slotId });
  }, []);

  const selectOverlay = useCallback((overlayId: string | null) => {
    dispatch({ type: 'SELECT_OVERLAY', overlayId });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const markDirty = useCallback(() => {
    dispatch({ type: 'MARK_DIRTY' });
  }, []);

  const markClean = useCallback((savedAt?: Date) => {
    dispatch({ type: 'MARK_CLEAN', savedAt });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Memoized context value
  const contextValue = useMemo<EditorContextType>(() => ({
    // State
    ...state,
    // Actions
    startNewProject,
    loadProject,
    captureImage,
    updateSlot,
    updateSlotAdjustments,
    applyAIResult,
    clearSlot,
    addOverlay,
    updateOverlay,
    deleteOverlay,
    setBackgroundColor,
    setThemeColor,
    setProjectName,
    selectSlot,
    selectOverlay,
    clearSelection,
    markDirty,
    markClean,
    reset,
  }), [
    state,
    startNewProject,
    loadProject,
    captureImage,
    updateSlot,
    updateSlotAdjustments,
    applyAIResult,
    clearSlot,
    addOverlay,
    updateOverlay,
    deleteOverlay,
    setBackgroundColor,
    setThemeColor,
    setProjectName,
    selectSlot,
    selectOverlay,
    clearSelection,
    markDirty,
    markClean,
    reset,
  ]);

  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useEditor(): EditorContextType {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
}

// ============================================
// Selectors (for derived state)
// ============================================

/**
 * Get the count of filled slots
 */
export function getFilledSlotCount(slots: CapturedSlots): number {
  return Object.values(slots).filter(Boolean).length;
}

/**
 * Get the selected slot data
 */
export function getSelectedSlot(state: EditorState): SlotData | null {
  if (!state.selectedSlotId) return null;
  return state.slots[state.selectedSlotId] ?? null;
}

/**
 * Check if a slot has a specific AI enhancement applied
 */
export function hasAIEnhancement(slot: SlotData | null, featureKey: string): boolean {
  if (!slot) return false;
  return slot.ai.enhancementsApplied.includes(featureKey as any);
}

/**
 * Get all slot URIs as a record (for compatibility)
 */
export function getSlotUris(slots: CapturedSlots): Record<string, string> {
  const uris: Record<string, string> = {};
  for (const [slotId, slotData] of Object.entries(slots)) {
    if (slotData) {
      uris[slotId] = slotData.uri;
    }
  }
  return uris;
}
