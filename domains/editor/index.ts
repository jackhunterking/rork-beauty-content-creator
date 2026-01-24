/**
 * Editor Domain
 * 
 * Exports all editor-related types, context, and utilities.
 */

// Types
export * from './types';

// Context
export { EditorProvider, useEditor, getFilledSlotCount, getSelectedSlot, hasAIEnhancement, getSlotUris } from './EditorContext';
