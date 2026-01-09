import * as ImageManipulator from 'expo-image-manipulator';
import { ImageSlot, FramePositionInfo } from '@/types';

/**
 * Calculate the visible region of the camera sensor that's shown in the preview.
 * 
 * The camera preview uses "cover" mode to fill the screen, which means:
 * - If sensor is wider than screen aspect ratio: sides are cropped
 * - If sensor is taller than screen aspect ratio: top/bottom are cropped
 * 
 * This function returns the region of the sensor that's visible in the preview.
 */
function calculateVisibleSensorRegion(
  sensorWidth: number,
  sensorHeight: number,
  screenWidth: number,
  screenHeight: number
): { left: number; top: number; width: number; height: number } {
  const sensorAspectRatio = sensorWidth / sensorHeight;
  const screenAspectRatio = screenWidth / screenHeight;
  
  let visibleLeft: number;
  let visibleTop: number;
  let visibleWidth: number;
  let visibleHeight: number;
  
  if (sensorAspectRatio > screenAspectRatio) {
    // Sensor is wider than screen - sides are cropped in preview
    // Scale factor to fit sensor height to screen height
    const scale = screenHeight / sensorHeight;
    
    // Visible width in sensor coordinates
    visibleWidth = screenWidth / scale;
    visibleHeight = sensorHeight;
    
    // Center crop - equal amounts cropped from each side
    visibleLeft = (sensorWidth - visibleWidth) / 2;
    visibleTop = 0;
  } else {
    // Sensor is taller than screen - top/bottom are cropped in preview
    // Scale factor to fit sensor width to screen width
    const scale = screenWidth / sensorWidth;
    
    // Visible height in sensor coordinates
    visibleWidth = sensorWidth;
    visibleHeight = screenHeight / scale;
    
    // Center crop - equal amounts cropped from top/bottom
    visibleLeft = 0;
    visibleTop = (sensorHeight - visibleHeight) / 2;
  }
  
  return {
    left: visibleLeft,
    top: visibleTop,
    width: visibleWidth,
    height: visibleHeight,
  };
}

/**
 * Map a frame overlay position from screen coordinates to sensor coordinates.
 * 
 * The frame overlay is positioned on the screen, but we need to find the
 * corresponding region in the captured sensor image.
 */
function mapFrameToSensorCoordinates(
  framePosition: FramePositionInfo,
  sensorWidth: number,
  sensorHeight: number
): { originX: number; originY: number; width: number; height: number } {
  // Calculate which part of the sensor is visible in the preview
  const visibleRegion = calculateVisibleSensorRegion(
    sensorWidth,
    sensorHeight,
    framePosition.screenWidth,
    framePosition.screenHeight
  );
  
  // Map frame position from screen coordinates to sensor coordinates
  // Frame position as ratio of screen (0-1)
  const frameLeftRatio = framePosition.frameLeft / framePosition.screenWidth;
  const frameTopRatio = framePosition.frameTop / framePosition.screenHeight;
  const frameWidthRatio = framePosition.frameWidth / framePosition.screenWidth;
  const frameHeightRatio = framePosition.frameHeight / framePosition.screenHeight;
  
  // Convert to sensor coordinates within the visible region
  const sensorFrameLeft = visibleRegion.left + (frameLeftRatio * visibleRegion.width);
  const sensorFrameTop = visibleRegion.top + (frameTopRatio * visibleRegion.height);
  const sensorFrameWidth = frameWidthRatio * visibleRegion.width;
  const sensorFrameHeight = frameHeightRatio * visibleRegion.height;
  
  // Clamp to valid bounds (ensure we don't exceed sensor dimensions)
  const clampedLeft = Math.max(0, Math.min(sensorWidth - sensorFrameWidth, sensorFrameLeft));
  const clampedTop = Math.max(0, Math.min(sensorHeight - sensorFrameHeight, sensorFrameTop));
  const clampedWidth = Math.min(sensorFrameWidth, sensorWidth - clampedLeft);
  const clampedHeight = Math.min(sensorFrameHeight, sensorHeight - clampedTop);
  
  return {
    originX: Math.floor(clampedLeft),
    originY: Math.floor(clampedTop),
    width: Math.floor(clampedWidth),
    height: Math.floor(clampedHeight),
  };
}

/**
 * Calculate crop region to extract portion matching target aspect ratio.
 * 
 * When framePosition is provided, first maps the frame to sensor coordinates
 * (accounting for camera preview zoom), then extracts that exact region.
 * Otherwise falls back to center crop.
 * 
 * @param sourceWidth - Width of source image (sensor) in pixels
 * @param sourceHeight - Height of source image (sensor) in pixels
 * @param targetAspectRatio - Target aspect ratio (width / height)
 * @param framePosition - Optional frame position info for camera-aware cropping
 */
function calculateCropRegion(
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: number,
  framePosition?: FramePositionInfo
): { originX: number; originY: number; width: number; height: number } {
  
  // When frame position is provided, map directly to sensor coordinates
  if (framePosition) {
    return mapFrameToSensorCoordinates(framePosition, sourceWidth, sourceHeight);
  }
  
  // Fallback: Simple center crop for target aspect ratio (library imports, etc.)
  const sourceAspectRatio = sourceWidth / sourceHeight;
  
  let cropWidth: number;
  let cropHeight: number;
  let originX: number;
  let originY: number;
  
  if (sourceAspectRatio > targetAspectRatio) {
    // Source is wider than target - crop sides
    cropHeight = sourceHeight;
    cropWidth = cropHeight * targetAspectRatio;
    originX = (sourceWidth - cropWidth) / 2;
    originY = 0;
  } else {
    // Source is taller than target - crop top/bottom
    cropWidth = sourceWidth;
    cropHeight = cropWidth / targetAspectRatio;
    originX = 0;
    originY = (sourceHeight - cropHeight) / 2;
  }
  
  // Handle edge cases where crop exceeds source
  if (cropWidth > sourceWidth) {
    cropWidth = sourceWidth;
    cropHeight = cropWidth / targetAspectRatio;
    originX = 0;
  }
  if (cropHeight > sourceHeight) {
    cropHeight = sourceHeight;
    cropWidth = cropHeight * targetAspectRatio;
    originY = 0;
  }
  
  return {
    originX: Math.floor(originX),
    originY: Math.floor(originY),
    width: Math.floor(cropWidth),
    height: Math.floor(cropHeight),
  };
}

/**
 * Crop an image to match a target aspect ratio
 * 
 * When framePosition is provided, uses position-aware cropping to match
 * what the user saw in the camera preview. Otherwise uses center crop.
 * 
 * @param uri - Source image URI
 * @param sourceWidth - Width of source image in pixels
 * @param sourceHeight - Height of source image in pixels
 * @param targetAspectRatio - Target aspect ratio (width / height)
 * @param framePosition - Optional frame position info for position-aware cropping
 * @returns New image URI after cropping
 */
export async function cropToAspectRatio(
  uri: string,
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: number,
  framePosition?: FramePositionInfo
): Promise<{ uri: string; width: number; height: number }> {
  const cropRegion = calculateCropRegion(sourceWidth, sourceHeight, targetAspectRatio, framePosition);
  
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: cropRegion }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );
  
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

/**
 * Resize an image to exact pixel dimensions
 * 
 * @param uri - Source image URI
 * @param width - Target width in pixels
 * @param height - Target height in pixels
 * @returns New image URI after resizing
 */
export async function resizeToSlot(
  uri: string,
  width: number,
  height: number
): Promise<{ uri: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width, height } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );
  
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

/**
 * Process an image for specific target dimensions:
 * 1. Crop to match the target aspect ratio (position-aware when framePosition provided)
 * 2. Resize to exact target pixel dimensions
 * 
 * @param uri - Source image URI
 * @param sourceWidth - Width of source image in pixels  
 * @param sourceHeight - Height of source image in pixels
 * @param targetWidth - Target width in pixels
 * @param targetHeight - Target height in pixels
 * @param framePosition - Optional frame position info for position-aware cropping
 * @returns Processed image URI with exact target dimensions
 */
export async function processImageForDimensions(
  uri: string,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  framePosition?: FramePositionInfo
): Promise<{ uri: string; width: number; height: number }> {
  const targetAspectRatio = targetWidth / targetHeight;
  
  // Step 1: Crop to target aspect ratio (position-aware when framePosition provided)
  const cropped = await cropToAspectRatio(
    uri,
    sourceWidth,
    sourceHeight,
    targetAspectRatio,
    framePosition
  );
  
  // Step 2: Resize to exact dimensions
  const resized = await resizeToSlot(
    cropped.uri,
    targetWidth,
    targetHeight
  );
  
  return resized;
}

/**
 * Process an image for a template slot:
 * 1. Crop to match the slot's aspect ratio (center crop)
 * 2. Resize to exact slot pixel dimensions
 * 
 * @param uri - Source image URI
 * @param sourceWidth - Width of source image in pixels  
 * @param sourceHeight - Height of source image in pixels
 * @param slot - Target slot dimensions
 * @returns Processed image URI with exact slot dimensions
 */
export async function processImageForSlot(
  uri: string,
  sourceWidth: number,
  sourceHeight: number,
  slot: ImageSlot
): Promise<{ uri: string; width: number; height: number }> {
  return processImageForDimensions(uri, sourceWidth, sourceHeight, slot.width, slot.height);
}

/**
 * Get aspect ratio from slot dimensions
 */
export function getSlotAspectRatio(slot: ImageSlot): number {
  return slot.width / slot.height;
}

/**
 * Calculate frame dimensions that fit within a container
 * while maintaining the target aspect ratio
 */
export function calculateFrameDimensions(
  slot: ImageSlot,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const aspectRatio = slot.width / slot.height;
  
  let frameWidth: number;
  let frameHeight: number;
  
  if (maxWidth / maxHeight > aspectRatio) {
    // Height is the limiting factor
    frameHeight = maxHeight;
    frameWidth = frameHeight * aspectRatio;
  } else {
    // Width is the limiting factor
    frameWidth = maxWidth;
    frameHeight = frameWidth / aspectRatio;
  }
  
  return { width: frameWidth, height: frameHeight };
}

