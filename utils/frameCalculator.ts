import { Dimensions } from 'react-native';
import { ImageSlot } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Configuration for frame dimension constraints
 */
interface FrameConstraints {
  maxWidthPercent: number;   // Maximum frame width as percentage of screen (0-1)
  maxHeightPercent: number;  // Maximum frame height as percentage of screen (0-1)
  minDimensionPercent: number; // Minimum dimension as percentage of screen (0-1)
}

/**
 * Result of frame dimension calculation
 */
export interface FrameCalculation {
  width: number;
  height: number;
  isConstrained: boolean;  // true if minimum dimensions were enforced
  constraintType: 'none' | 'width' | 'height'; // which dimension was constrained
}

/**
 * Default constraints for the camera frame overlay
 */
export const DEFAULT_FRAME_CONSTRAINTS: FrameConstraints = {
  maxWidthPercent: 0.85,    // 85% of screen width
  maxHeightPercent: 0.65,   // 65% of screen height
  minDimensionPercent: 0.50, // Minimum 50% of screen in any dimension
};

/**
 * Calculate frame dimensions that:
 * 1. Maintain the target aspect ratio from the slot
 * 2. Fit within maximum constraints
 * 3. Enforce minimum dimensions for usability with extreme aspect ratios
 * 
 * @param slot - The image slot with target dimensions
 * @param constraints - Optional custom constraints (defaults to DEFAULT_FRAME_CONSTRAINTS)
 * @param screenWidth - Optional screen width (defaults to device screen width)
 * @param screenHeight - Optional screen height (defaults to device screen height)
 * @returns Calculated frame dimensions and constraint information
 */
export function calculateFrameDimensions(
  slot: ImageSlot,
  constraints: FrameConstraints = DEFAULT_FRAME_CONSTRAINTS,
  screenWidth: number = SCREEN_WIDTH,
  screenHeight: number = SCREEN_HEIGHT
): FrameCalculation {
  const aspectRatio = slot.width / slot.height;
  
  const maxWidth = screenWidth * constraints.maxWidthPercent;
  const maxHeight = screenHeight * constraints.maxHeightPercent;
  const minWidth = screenWidth * constraints.minDimensionPercent;
  const minHeight = screenHeight * constraints.minDimensionPercent;
  
  let frameWidth: number;
  let frameHeight: number;
  let isConstrained = false;
  let constraintType: 'none' | 'width' | 'height' = 'none';
  
  // First, calculate dimensions that fit within max constraints
  if (maxWidth / maxHeight > aspectRatio) {
    // Height is the limiting factor
    frameHeight = maxHeight;
    frameWidth = frameHeight * aspectRatio;
  } else {
    // Width is the limiting factor
    frameWidth = maxWidth;
    frameHeight = frameWidth / aspectRatio;
  }
  
  // Check if minimum constraints need to be enforced
  if (frameWidth < minWidth) {
    // Width is too small (very tall aspect ratio)
    frameWidth = minWidth;
    frameHeight = frameWidth / aspectRatio;
    isConstrained = true;
    constraintType = 'width';
  } else if (frameHeight < minHeight) {
    // Height is too small (very wide aspect ratio)
    frameHeight = minHeight;
    frameWidth = frameHeight * aspectRatio;
    isConstrained = true;
    constraintType = 'height';
  }
  
  // Final safety clamp to screen bounds (shouldn't normally trigger)
  frameWidth = Math.min(frameWidth, screenWidth * 0.95);
  frameHeight = Math.min(frameHeight, screenHeight * 0.85);
  
  return {
    width: Math.round(frameWidth),
    height: Math.round(frameHeight),
    isConstrained,
    constraintType,
  };
}

/**
 * Get the aspect ratio from slot dimensions
 */
export function getAspectRatio(slot: ImageSlot): number {
  return slot.width / slot.height;
}

/**
 * Determine if an aspect ratio is considered "extreme"
 * Extreme ratios are those that would result in constrained frames
 */
export function isExtremeAspectRatio(
  slot: ImageSlot,
  constraints: FrameConstraints = DEFAULT_FRAME_CONSTRAINTS
): boolean {
  const result = calculateFrameDimensions(slot, constraints);
  return result.isConstrained;
}

/**
 * Get a human-readable description of the aspect ratio
 */
export function getAspectRatioDescription(slot: ImageSlot): string {
  const ratio = slot.width / slot.height;
  
  if (Math.abs(ratio - 1) < 0.01) return 'Square (1:1)';
  if (Math.abs(ratio - 0.75) < 0.05) return 'Portrait (3:4)';
  if (Math.abs(ratio - 0.5625) < 0.05) return 'Portrait (9:16)';
  if (Math.abs(ratio - 1.333) < 0.05) return 'Landscape (4:3)';
  if (Math.abs(ratio - 1.778) < 0.05) return 'Landscape (16:9)';
  if (ratio > 2) return 'Ultra-wide';
  if (ratio < 0.5) return 'Ultra-tall';
  if (ratio > 1) return 'Landscape';
  return 'Portrait';
}

