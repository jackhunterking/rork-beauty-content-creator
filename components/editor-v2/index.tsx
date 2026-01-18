/**
 * Editor V2 Components
 * 
 * Professional canvas editor with direct manipulation,
 * inspired by Instagram, Canva, and Adobe Express mobile experiences.
 */

// Core toolbar components
export { ToolDock } from './ToolDock';
export { EditorMainToolbar } from './EditorMainToolbar';
export { ElementContextBar } from './ElementContextBar';
export { FloatingElementToolbar } from './FloatingElementToolbar';

// Panel components
export { EditorSubPanel, CategoryTab, CategoryTabs } from './EditorSubPanel';
export { TextStylePanel } from './TextStylePanel';
export { LogoPanel } from './LogoPanel';
export { TextEditToolbar } from './TextEditToolbar';
export { ColorPickerModal } from './ColorPickerModal';

// Existing components
export { SelectionHandles } from './SelectionHandles';
export { ContextualToolbar } from './ContextualToolbar';
export { AIEnhancePanel } from './AIEnhancePanel';
export { CameraSheet } from './CameraSheet';
export { EditableSlot } from './EditableSlot';
export { CropToolbar } from './CropToolbar';

// Types - re-export everything from types
export * from './types';

// Type exports for new components
export type { EditorSubPanelRef, EditorSubPanelProps } from './EditorSubPanel';
export type { MainToolbarItem } from './EditorMainToolbar';
export type { TextStylePanelRef, TextStylePanelProps } from './TextStylePanel';
export type { LogoPanelRef, LogoPanelProps } from './LogoPanel';
export type { FloatingToolbarElementType, ElementPosition } from './FloatingElementToolbar';
export type { ContextBarElementType, TextFormatOptions } from './ElementContextBar';
