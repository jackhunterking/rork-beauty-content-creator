import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageSlot, FramePositionInfo, MediaAsset } from '@/types';
import { trackTempFile } from '@/services/tempCleanupService';

// ============================================
// Constants for Image Adjustment Feature
// ============================================

/**
 * Multiplier for oversized images to allow zoom headroom
 * A value of 2 means we keep images at 2x the slot dimensions
 */
export const OVERSIZED_MULTIPLIER = 2;

/**
 * Minimum scale allowed when adjusting (1.0 = fill frame exactly)
 */
export const MIN_ADJUSTMENT_SCALE = 1.0;

/**
 * Maximum scale allowed when adjusting
 */
export const MAX_ADJUSTMENT_SCALE = 3.0;

/**
 * Default adjustments for a newly captured image
 */
export const DEFAULT_ADJUSTMENTS = {
  translateX: 0,
  translateY: 0,
  scale: 1.0,
  rotation: 0,
};

/**
 * Calculate the minimum scale required to cover a slot when image is rotated.
 * 
 * When an image is rotated, its effective coverage area changes because the
 * rotated rectangle's bounding box is larger but the actual image content
 * that covers the slot is smaller. This ensures no empty corners appear.
 * 
 * @param imageAspectRatio - Aspect ratio of the base image (width/height)
 * @param slotAspectRatio - Aspect ratio of the slot (width/height)
 * @param rotationDegrees - Rotation angle in degrees
 * @returns Minimum scale factor required
 */
export function calculateMinScaleForRotation(
  imageAspectRatio: number,
  slotAspectRatio: number,
  rotationDegrees: number
): number {
  // Normalize rotation to 0-90 range (symmetrical for our purposes)
  const normalizedRotation = Math.abs(rotationDegrees) % 180;
  const effectiveRotation = normalizedRotation > 90 ? 180 - normalizedRotation : normalizedRotation;
  
  // No rotation means base scale is fine
  if (effectiveRotation === 0) {
    return MIN_ADJUSTMENT_SCALE;
  }
  
  const radians = effectiveRotation * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  
  // When an image is rotated and we need to crop an axis-aligned rectangle from it,
  // the minimum scale depends on ensuring the rotated content covers the slot.
  //
  // For a rectangle rotated by θ, the largest inscribed axis-aligned rectangle
  // that fits entirely within the original bounds (not the expanded bounding box)
  // has a coverage factor of approximately: cos(θ) + sin(θ) for the diagonal case.
  //
  // Simplified formula: at 45°, minScale ≈ √2 ≈ 1.414
  // At 0°: minScale = 1.0
  // Linear interpolation gives reasonable results for most cases.
  
  // The minimum scale is approximately 1 / cos(θ) for small angles,
  // approaching √2 at 45° for square-ish images
  const diagonalFactor = cos + sin; // Ranges from 1 (at 0°) to √2 (at 45°)
  
  // For the inscribed rectangle, the effective coverage is:
  // coverage = 1 / (cos(θ) + sin(θ) * |tan(θ)|) simplified
  // But a simpler approximation that works well:
  const minScale = 1 / (cos * cos + sin * sin / Math.max(imageAspectRatio, 1/imageAspectRatio));
  
  // At 45° with square image: 1 / (0.5 + 0.5/1) = 1 / 1 = 1.0 (too low)
  // Let's use a better formula: the scale needed to ensure rotated image covers slot
  
  // Actually, the correct minimum scale at angle θ is:
  // minScale = 1 / (cos(θ) - sin(θ) * tan(θ)) for θ < 45°
  // Which simplifies to: minScale = 1 / cos(θ) when considering the slot must be covered
  
  // Simple and effective formula:
  // At θ degrees, the inscribed rectangle shrinks by factor cos(θ) in one direction
  // minScale = 1 / cos(θ) ensures coverage
  let finalMinScale = 1 / cos;
  
  // Cap at reasonable bounds (√2 at 45° is the theoretical max for square images)
  finalMinScale = Math.max(MIN_ADJUSTMENT_SCALE, Math.min(1.5, finalMinScale));
  
  return finalMinScale;
}

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
  
  // Track temp file for cleanup
  trackTempFile(result.uri);
  
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
  
  // Track temp file for cleanup
  trackTempFile(result.uri);
  
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

// ============================================
// Image Adjustment Functions
// ============================================

/**
 * Process an image for adjustment - keeps image oversized for zoom headroom
 * 
 * This function crops to the target aspect ratio but keeps the image larger
 * than the final slot dimensions (2x by default) to allow for zoom and pan.
 * 
 * @param uri - Source image URI
 * @param sourceWidth - Width of source image in pixels
 * @param sourceHeight - Height of source image in pixels
 * @param targetWidth - Target slot width in pixels
 * @param targetHeight - Target slot height in pixels
 * @param framePosition - Optional frame position info for camera-aware cropping
 * @returns Processed image URI with oversized dimensions
 */
export async function processImageForAdjustment(
  uri: string,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  framePosition?: FramePositionInfo
): Promise<{ uri: string; width: number; height: number }> {
  const targetAspectRatio = targetWidth / targetHeight;
  const sourceAspectRatio = sourceWidth / sourceHeight;
  
  // For camera captures with frame position, use position-aware cropping
  // For library imports (no framePosition), preserve original aspect ratio to allow panning
  if (framePosition) {
    // Camera capture: crop to what was visible in the frame
    const cropped = await cropToAspectRatio(
      uri,
      sourceWidth,
      sourceHeight,
      targetAspectRatio,
      framePosition
    );
    
    return cropped;
  }
  
  // Library import: preserve original aspect ratio for full panning capability
  // Scale so the image COVERS the target frame (smaller dimension fills frame)
  // This allows panning in the dimension that exceeds the frame
  
  // Calculate the size needed to cover the target frame while maintaining aspect ratio
  let scaledWidth: number;
  let scaledHeight: number;
  
  if (sourceAspectRatio > targetAspectRatio) {
    // Source is wider than target - height should fill, width will exceed (allows horizontal pan)
    scaledHeight = Math.floor(targetHeight * OVERSIZED_MULTIPLIER);
    scaledWidth = Math.floor(scaledHeight * sourceAspectRatio);
  } else {
    // Source is taller than target - width should fill, height will exceed (allows vertical pan)
    scaledWidth = Math.floor(targetWidth * OVERSIZED_MULTIPLIER);
    scaledHeight = Math.floor(scaledWidth / sourceAspectRatio);
  }
  
  // Don't upscale beyond original dimensions
  if (scaledWidth > sourceWidth || scaledHeight > sourceHeight) {
    // Use original size if it's smaller than our calculated size
    scaledWidth = sourceWidth;
    scaledHeight = sourceHeight;
  }
  
  // If no resize needed (already at or below target size), return original
  if (scaledWidth >= sourceWidth && scaledHeight >= sourceHeight) {
    return { uri, width: sourceWidth, height: sourceHeight };
  }
  
  // Resize while maintaining original aspect ratio
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: scaledWidth, height: scaledHeight } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );
  
  // Track temp file for cleanup
  trackTempFile(resized.uri);
  
  return {
    uri: resized.uri,
    width: resized.width,
    height: resized.height,
  };
}

/**
 * Apply image adjustments and crop to final slot dimensions
 * 
 * This function takes an oversized image with adjustments (translateX, translateY, scale, rotation)
 * and produces the final slot-sized image by applying rotation and cropping the visible region.
 * 
 * @param uri - Source image URI (oversized)
 * @param imageWidth - Width of source image in pixels
 * @param imageHeight - Height of source image in pixels
 * @param targetWidth - Target slot width in pixels
 * @param targetHeight - Target slot height in pixels
 * @param adjustments - The adjustments to apply (translateX, translateY, scale, rotation)
 * @returns Final image URI with exact slot dimensions
 */
export async function applyAdjustmentsAndCrop(
  uri: string,
  imageWidth: number,
  imageHeight: number,
  targetWidth: number,
  targetHeight: number,
  adjustments: { translateX: number; translateY: number; scale: number; rotation?: number }
): Promise<{ uri: string; width: number; height: number }> {
  const { translateX, translateY, scale, rotation = 0 } = adjustments;
  
  // CRITICAL: Verify the actual image dimensions match the metadata
  // The metadata might be stale if the image was processed differently
  const imageInfo = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG });
  const actualWidth = imageInfo.width;
  const actualHeight = imageInfo.height;
  
  // If the image is ALREADY at slot dimensions and matches metadata,
  // it means the image was already cropped - DON'T apply adjustments again
  const isImageAlreadyAtSlotSize = (
    Math.abs(actualWidth - targetWidth) < 5 && 
    Math.abs(actualHeight - targetHeight) < 5
  );
  
  if (isImageAlreadyAtSlotSize) {
    // The image was already processed to slot dimensions with adjustments baked in
    // Just return the resized version to ensure exact dimensions
    const resized = await resizeToSlot(uri, targetWidth, targetHeight);
    return resized;
  }
  
  // Use actual dimensions for calculations, not metadata (which might be wrong)
  const correctedImageWidth = actualWidth;
  const correctedImageHeight = actualHeight;
  
  // Track intermediate files for cleanup
  let rotatedUri: string | null = null;
  let croppedUri: string | null = null;
  
  // IMPORTANT: translateX and translateY are NORMALIZED values in ROTATED coordinates
  // They were normalized using the ORIGINAL image's baseImageSize in the UI
  // We must use the SAME base calculations here
  
  // Calculate baseImageSize the SAME way as the UI does (using CORRECTED image dimensions)
  // This is the "cover fit" size for the unrotated image
  const originalAspect = correctedImageWidth / correctedImageHeight;
  const slotAspect = targetWidth / targetHeight;
  
  let baseW: number, baseH: number;
  if (originalAspect > slotAspect) {
    // Image is wider - height fits slot, width overflows
    baseH = targetHeight;
    baseW = baseH * originalAspect;
  } else {
    // Image is taller - width fits slot, height overflows
    baseW = targetWidth;
    baseH = baseW / originalAspect;
  }
  
  // The scaled base size (what the UI displays at the given scale)
  const scaledBaseW = baseW * scale;
  const scaledBaseH = baseH * scale;
  
  // Calculate maxU/maxV the SAME way as the UI
  const halfW = scaledBaseW / 2;
  const halfH = scaledBaseH / 2;
  const halfSlotW = targetWidth / 2;
  const halfSlotH = targetHeight / 2;
  
  const angleRad = (rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  
  const maxU = Math.max(0.001, halfW - (halfSlotW * absCos + halfSlotH * absSin));
  const maxV = Math.max(0.001, halfH - (halfSlotW * absSin + halfSlotH * absCos));
  
  // Denormalize: get actual translation in rotated coordinates (u, v)
  const u = translateX * maxU;
  const v = translateY * maxV;
  
  // Convert rotated coords (u, v) to screen coords (tx, ty)
  const tx = u * cos - v * sin;
  const ty = u * sin + v * cos;
  
  // Now apply rotation to the source image
  let currentUri = uri;
  let currentWidth = correctedImageWidth;
  let currentHeight = correctedImageHeight;
  
  if (rotation !== 0) {
    const rotated = await ImageManipulator.manipulateAsync(
      currentUri,
      [{ rotate: rotation }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    rotatedUri = rotated.uri;
    currentUri = rotated.uri;
    currentWidth = rotated.width;
    currentHeight = rotated.height;
  }
  
  // The displayed image is ROTATED, so its bounding box is larger than scaledBase
  // Calculate the displayed rotated image size in slot pixel coordinates
  const displayedRotatedW = scaledBaseW * absCos + scaledBaseH * absSin;
  const displayedRotatedH = scaledBaseW * absSin + scaledBaseH * absCos;
  
  // Ratio from slot pixels to rotated source pixels (should be ~equal for W and H)
  const displayToSourceRatio = currentWidth / displayedRotatedW;
  // Note: currentHeight / displayedRotatedH should give the same ratio
  
  // Convert tx/ty to rotated source image pixel offsets
  const pixelOffsetX = tx * displayToSourceRatio;
  const pixelOffsetY = ty * displayToSourceRatio;
  
  // Crop dimensions: the slot (targetWidth × targetHeight) converted to source pixels
  const cropWidth = targetWidth * displayToSourceRatio;
  const cropHeight = targetHeight * displayToSourceRatio;
  
  // Calculate origin (top-left corner of crop region)
  // Positive tx means image moved right → visible region is to the LEFT of center → subtract offset
  let originX = (currentWidth - cropWidth) / 2 - pixelOffsetX;
  let originY = (currentHeight - cropHeight) / 2 - pixelOffsetY;
  
  // Clamp to valid bounds
  const finalCropWidth = Math.min(Math.max(1, cropWidth), currentWidth);
  const finalCropHeight = Math.min(Math.max(1, cropHeight), currentHeight);
  originX = Math.max(0, Math.min(currentWidth - finalCropWidth, originX));
  originY = Math.max(0, Math.min(currentHeight - finalCropHeight, originY));
  
  // Apply crop
  const cropped = await ImageManipulator.manipulateAsync(
    currentUri,
    [{
      crop: {
        originX: Math.floor(originX),
        originY: Math.floor(originY),
        width: Math.floor(finalCropWidth),
        height: Math.floor(finalCropHeight),
      }
    }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );
  croppedUri = cropped.uri;
  
  // Resize to exact slot dimensions
  const resized = await resizeToSlot(cropped.uri, targetWidth, targetHeight);
  
  // Clean up intermediate files to prevent memory accumulation
  // These are no longer needed after the final resized image is created
  try {
    if (rotatedUri && rotatedUri !== uri) {
      await FileSystem.deleteAsync(rotatedUri, { idempotent: true });
    }
    if (croppedUri && croppedUri !== rotatedUri) {
      await FileSystem.deleteAsync(croppedUri, { idempotent: true });
    }
  } catch (cleanupError) {
    // Silently ignore cleanup errors - files may already be deleted
    if (__DEV__) {
      console.log('[ImageProcessing] Intermediate cleanup warning:', cleanupError);
    }
  }
  
  return resized;
}

/**
 * Calculate the pan limits for image adjustment
 * 
 * Given the image dimensions, slot dimensions, and current scale,
 * returns the maximum translateX and translateY values allowed.
 * 
 * @param imageWidth - Width of the image in pixels
 * @param imageHeight - Height of the image in pixels
 * @param slotWidth - Width of the slot in pixels
 * @param slotHeight - Height of the slot in pixels
 * @param scale - Current scale factor
 * @returns Maximum absolute translateX and translateY values (0 to 0.5)
 */
export function calculatePanLimits(
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number,
  scale: number
): { maxTranslateX: number; maxTranslateY: number } {
  // The scaled image dimensions
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;
  
  // How much the image extends beyond the frame on each side
  // Normalized to 0-0.5 range (0 = no movement, 0.5 = can move half the frame width)
  const excessWidth = Math.max(0, scaledWidth - slotWidth);
  const excessHeight = Math.max(0, scaledHeight - slotHeight);
  
  // Maximum translate as ratio of slot dimensions
  const maxTranslateX = excessWidth > 0 ? (excessWidth / scaledWidth) * 0.5 : 0;
  const maxTranslateY = excessHeight > 0 ? (excessHeight / scaledHeight) * 0.5 : 0;
  
  return { maxTranslateX, maxTranslateY };
}

/**
 * Clamp adjustments to valid bounds
 * 
 * Ensures that:
 * 1. Scale is within MIN_ADJUSTMENT_SCALE and MAX_ADJUSTMENT_SCALE
 * 2. TranslateX/Y don't exceed pan limits for current scale
 * 
 * @param adjustments - Current adjustments
 * @param imageWidth - Width of the image in pixels
 * @param imageHeight - Height of the image in pixels
 * @param slotWidth - Width of the slot in pixels
 * @param slotHeight - Height of the slot in pixels
 * @returns Clamped adjustments
 */
export function clampAdjustments(
  adjustments: { translateX: number; translateY: number; scale: number },
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number
): { translateX: number; translateY: number; scale: number } {
  // Clamp scale
  const scale = Math.max(MIN_ADJUSTMENT_SCALE, Math.min(MAX_ADJUSTMENT_SCALE, adjustments.scale));
  
  // Calculate pan limits for this scale
  const { maxTranslateX, maxTranslateY } = calculatePanLimits(
    imageWidth,
    imageHeight,
    slotWidth,
    slotHeight,
    scale
  );
  
  // Clamp translate values
  const translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, adjustments.translateX));
  const translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, adjustments.translateY));
  
  return { translateX, translateY, scale };
}

/**
 * Check if a MediaAsset has adjustments applied
 */
export function hasAdjustments(asset: MediaAsset): boolean {
  if (!asset.adjustments) return false;
  
  const { translateX, translateY, scale, rotation } = asset.adjustments;
  
  // Check if any adjustment differs from default
  return (
    translateX !== 0 ||
    translateY !== 0 ||
    scale !== 1.0 ||
    (rotation !== undefined && rotation !== 0)
  );
}
