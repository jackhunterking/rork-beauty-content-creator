/**
 * Editor V2 Components
 * 
 * Professional canvas editor with direct manipulation,
 * inspired by Instagram, Canva, and Adobe Express mobile experiences.
 */

// Core toolbar components
export { EditorMainToolbar } from './EditorMainToolbar';
export { ElementContextBar } from './ElementContextBar';

// Panel components
export { TextStylePanel } from './TextStylePanel';
export { LogoPanel } from './LogoPanel';
export { TextEditToolbar } from './TextEditToolbar';
export { ColorPickerModal } from './ColorPickerModal';

// Existing components
export { ContextualToolbar } from './ContextualToolbar';
export { BackgroundPresetPicker } from './BackgroundPresetPicker';
export { CropToolbar } from './CropToolbar';

// AI Studio components
export { AIStudioPanel } from './AIStudioPanel';
export { AIStudioFeatureTab } from './AIStudioFeatureTab';
export { AIStudioPresetGrid } from './AIStudioPresetGrid';
export { AIFeatureMenu } from './AIFeatureMenu';

// Types - re-export everything from types
export * from './types';

// Type exports for components
export type { MainToolbarItem } from './EditorMainToolbar';
export type { TextStylePanelRef, TextStylePanelProps } from './TextStylePanel';
export type { LogoPanelRef, LogoPanelProps } from './LogoPanel';
export type { ContextBarElementType, TextFormatOptions } from './ElementContextBar';
