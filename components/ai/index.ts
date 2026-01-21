/**
 * AI Components barrel export
 * 
 * All AI Studio related components for easy imports.
 */

// Main sheet component
export { default as AIStudioSheet } from './AIStudioSheet';
export type { AIStudioSheetProps, AIStudioView } from './AIStudioSheet';

// Feature views
export { default as AIStudioHomeView } from './AIStudioHomeView';
export { default as AutoQualityView } from './AutoQualityView';
export { default as RemoveBackgroundView } from './RemoveBackgroundView';
export { default as ReplaceBackgroundView } from './ReplaceBackgroundView';

// Processing states
export { default as AIProcessingOverlay } from './AIProcessingOverlay';
export { default as AISuccessOverlay } from './AISuccessOverlay';
export { default as AIErrorView } from './AIErrorView';

// Premium prompt
export { default as PremiumAIPrompt } from './PremiumAIPrompt';
