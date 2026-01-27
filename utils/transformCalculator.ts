/**
 * Transform Calculator Utility
 * 
 * Handles the math for applying image transforms (scale, translate, rotate)
 * in AI preview views, matching the exact behavior of TemplateCanvas.
 * 
 * Key concepts:
 * - baseImageSize: Size of image when it exactly covers the container at scale 1.0 (cover fit)
 * - Normalized translation: Values stored as fractions of maxU/maxV (range roughly -1 to 1)
 * - Denormalization: Converting normalized values back to pixels for rendering
 */

export interface ImageAdjustments {
  scale: number;
  translateX: number; // Normalized (stored as u/maxU in rotated coords)
  translateY: number; // Normalized (stored as v/maxV in rotated coords)
  rotation?: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Calculate base image size for "cover" fit.
 * At scale 1.0, the image exactly covers the container (no gaps).
 * 
 * @param imageSize - Original image dimensions
 * @param containerSize - Container dimensions to fill
 * @returns Base image size for cover fit
 */
export function calculateBaseImageSize(imageSize: Size, containerSize: Size): Size {
  const imageAspect = imageSize.width / imageSize.height;
  const containerAspect = containerSize.width / containerSize.height;

  if (imageAspect > containerAspect) {
    // Image is wider - height fits, width overflows
    return {
      width: containerSize.height * imageAspect,
      height: containerSize.height,
    };
  } else {
    // Image is taller - width fits, height overflows
    return {
      width: containerSize.width,
      height: containerSize.width / imageAspect,
    };
  }
}

/**
 * Calculate max translation values in rotated coordinate system.
 * These are used for normalizing/denormalizing translation values.
 * 
 * @param baseImageSize - Base image size at scale 1.0
 * @param containerSize - Container dimensions
 * @param scale - Current scale factor
 * @param rotationDeg - Rotation in degrees
 * @returns maxU and maxV values
 */
export function getMaxUV(
  baseImageSize: Size,
  containerSize: Size,
  scale: number,
  rotationDeg: number
): { maxU: number; maxV: number } {
  const scaledWidth = baseImageSize.width * scale;
  const scaledHeight = baseImageSize.height * scale;
  const halfW = scaledWidth / 2;
  const halfH = scaledHeight / 2;
  const halfContainerW = containerSize.width / 2;
  const halfContainerH = containerSize.height / 2;

  const angleRad = (rotationDeg * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(angleRad));
  const absSin = Math.abs(Math.sin(angleRad));

  return {
    maxU: Math.max(0, halfW - (halfContainerW * absCos + halfContainerH * absSin)),
    maxV: Math.max(0, halfH - (halfContainerW * absSin + halfContainerH * absCos)),
  };
}

/**
 * Denormalize translation values from storage format to pixel values.
 * 
 * Storage format uses rotated coordinates normalized by maxU/maxV.
 * This function converts back to screen pixels.
 * 
 * @param adjustments - Stored adjustments with normalized translation
 * @param baseImageSize - Base image size at scale 1.0
 * @param containerSize - Container dimensions
 * @returns Pixel values for translateX and translateY
 */
export function denormalizeTranslation(
  adjustments: ImageAdjustments,
  baseImageSize: Size,
  containerSize: Size
): { pixelX: number; pixelY: number } {
  const { scale, translateX: normalizedX, translateY: normalizedY, rotation = 0 } = adjustments;

  // Get max values in rotated coordinates
  const { maxU, maxV } = getMaxUV(baseImageSize, containerSize, scale, rotation);

  // Denormalize: convert normalized rotated coords to actual rotated coords (u, v)
  const u = normalizedX * maxU;
  const v = normalizedY * maxV;

  // Convert rotated coords (u, v) back to screen coords (tx, ty)
  // Inverse of: u = tx*cos + ty*sin, v = -tx*sin + ty*cos
  // So: tx = u*cos - v*sin, ty = u*sin + v*cos
  const angleRad = (rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const pixelX = u * cos - v * sin;
  const pixelY = u * sin + v * cos;

  return { pixelX, pixelY };
}

/**
 * Calculate complete render parameters for a transformed image.
 * 
 * This provides all values needed to render the image with transforms
 * in a container, matching TemplateCanvas behavior.
 * 
 * @param imageSize - Original image dimensions
 * @param containerSize - Container dimensions
 * @param adjustments - Image adjustments (scale, translate, rotate)
 * @returns All render parameters
 */
export function calculateRenderParams(
  imageSize: Size,
  containerSize: Size,
  adjustments?: ImageAdjustments | null
): {
  baseImageSize: Size;
  scaledSize: Size;
  offset: { x: number; y: number };
  rotation: number;
} {
  const baseImageSize = calculateBaseImageSize(imageSize, containerSize);

  // Default adjustments if none provided
  const safeAdjustments: ImageAdjustments = adjustments || {
    scale: 1,
    translateX: 0,
    translateY: 0,
    rotation: 0,
  };

  const scale = Math.max(1, safeAdjustments.scale); // Ensure minimum scale of 1
  const rotation = safeAdjustments.rotation || 0;

  // Calculate scaled size
  const scaledSize = {
    width: baseImageSize.width * scale,
    height: baseImageSize.height * scale,
  };

  // Denormalize translation to pixels
  const { pixelX, pixelY } = denormalizeTranslation(
    safeAdjustments,
    baseImageSize,
    containerSize
  );

  // Calculate offset to center the image, then apply translation
  // Center offset = (container - scaled) / 2
  // Final offset = center offset + translation
  const offset = {
    x: (containerSize.width - scaledSize.width) / 2 + pixelX,
    y: (containerSize.height - scaledSize.height) / 2 + pixelY,
  };

  return {
    baseImageSize,
    scaledSize,
    offset,
    rotation,
  };
}
