import * as ImageManipulator from 'expo-image-manipulator';
import { ImageSlot } from '@/types';

/**
 * Calculate crop region to extract center portion matching target aspect ratio
 */
function calculateCropRegion(
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: number
): { originX: number; originY: number; width: number; height: number } {
  const sourceAspectRatio = sourceWidth / sourceHeight;
  
  let cropWidth: number;
  let cropHeight: number;
  let originX: number;
  let originY: number;
  
  if (sourceAspectRatio > targetAspectRatio) {
    // Source is wider - crop sides
    cropHeight = sourceHeight;
    cropWidth = cropHeight * targetAspectRatio;
    originX = (sourceWidth - cropWidth) / 2;
    originY = 0;
  } else {
    // Source is taller - crop top/bottom
    cropWidth = sourceWidth;
    cropHeight = cropWidth / targetAspectRatio;
    originX = 0;
    originY = (sourceHeight - cropHeight) / 2;
  }
  
  return {
    originX: Math.floor(originX),
    originY: Math.floor(originY),
    width: Math.floor(cropWidth),
    height: Math.floor(cropHeight),
  };
}

/**
 * Crop an image to match a target aspect ratio (center crop)
 * 
 * @param uri - Source image URI
 * @param sourceWidth - Width of source image in pixels
 * @param sourceHeight - Height of source image in pixels
 * @param targetAspectRatio - Target aspect ratio (width / height)
 * @returns New image URI after cropping
 */
export async function cropToAspectRatio(
  uri: string,
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: number
): Promise<{ uri: string; width: number; height: number }> {
  const cropRegion = calculateCropRegion(sourceWidth, sourceHeight, targetAspectRatio);
  
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
 * 1. Crop to match the target aspect ratio (center crop)
 * 2. Resize to exact target pixel dimensions
 * 
 * @param uri - Source image URI
 * @param sourceWidth - Width of source image in pixels  
 * @param sourceHeight - Height of source image in pixels
 * @param targetWidth - Target width in pixels
 * @param targetHeight - Target height in pixels
 * @returns Processed image URI with exact target dimensions
 */
export async function processImageForDimensions(
  uri: string,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): Promise<{ uri: string; width: number; height: number }> {
  const targetAspectRatio = targetWidth / targetHeight;
  
  // Step 1: Crop to target aspect ratio
  const cropped = await cropToAspectRatio(
    uri,
    sourceWidth,
    sourceHeight,
    targetAspectRatio
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

