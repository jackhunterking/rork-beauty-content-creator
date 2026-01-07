import { TemplatedLayer, Template, ImageSlot } from '@/types';

/**
 * Interactive region extracted from layers_json or slot data
 */
export interface InteractiveRegion {
  type: 'before' | 'after';
  x: number;      // pixels from left on canvas
  y: number;      // pixels from top on canvas
  width: number;  // pixels
  height: number; // pixels
}

/**
 * Layer names in Templated.io that represent image placeholders
 */
const BEFORE_LAYER_NAMES = ['image-before', 'before-image', 'before_image', 'image_before'];
const AFTER_LAYER_NAMES = ['image-after', 'after-image', 'after_image', 'image_after'];

/**
 * Find a layer by checking against multiple possible names
 */
function findLayerByNames(layers: TemplatedLayer[], names: string[]): TemplatedLayer | undefined {
  return layers.find(layer => 
    names.some(name => layer.layer.toLowerCase() === name.toLowerCase())
  );
}

/**
 * Convert a TemplatedLayer to an InteractiveRegion
 */
function layerToRegion(layer: TemplatedLayer, type: 'before' | 'after'): InteractiveRegion {
  return {
    type,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
  };
}

/**
 * Convert slot data (percentage-based) to an InteractiveRegion (pixel-based)
 */
function slotToRegion(
  slot: ImageSlot, 
  canvasWidth: number, 
  canvasHeight: number, 
  type: 'before' | 'after'
): InteractiveRegion {
  return {
    type,
    x: (slot.xPercent / 100) * canvasWidth,
    y: (slot.yPercent / 100) * canvasHeight,
    width: slot.width,
    height: slot.height,
  };
}

/**
 * Extract interactive regions from layers_json
 * Falls back to slot data if layers are not found
 */
export function extractInteractiveRegions(
  template: Template
): InteractiveRegion[] {
  const regions: InteractiveRegion[] = [];
  const { layersJson, canvasWidth, canvasHeight, beforeSlot, afterSlot } = template;

  // Try to extract from layers_json first
  if (layersJson && layersJson.length > 0) {
    const beforeLayer = findLayerByNames(layersJson, BEFORE_LAYER_NAMES);
    const afterLayer = findLayerByNames(layersJson, AFTER_LAYER_NAMES);

    if (beforeLayer) {
      regions.push(layerToRegion(beforeLayer, 'before'));
    }

    if (afterLayer) {
      regions.push(layerToRegion(afterLayer, 'after'));
    }

    // If we found both layers, return them
    if (regions.length === 2) {
      return regions;
    }
  }

  // Fallback: Use slot data if layers_json is missing or incomplete
  // Clear any partial results and use slot data entirely for consistency
  regions.length = 0;

  if (beforeSlot) {
    regions.push(slotToRegion(beforeSlot, canvasWidth, canvasHeight, 'before'));
  }

  if (afterSlot) {
    regions.push(slotToRegion(afterSlot, canvasWidth, canvasHeight, 'after'));
  }

  return regions;
}

/**
 * Scale interactive regions to display size
 * 
 * @param regions - Original regions in canvas pixel coordinates
 * @param canvasWidth - Original canvas width
 * @param canvasHeight - Original canvas height
 * @param displayWidth - Target display width
 * @param displayHeight - Target display height
 */
export function scaleRegionsToDisplay(
  regions: InteractiveRegion[],
  canvasWidth: number,
  canvasHeight: number,
  displayWidth: number,
  displayHeight: number
): InteractiveRegion[] {
  const scaleX = displayWidth / canvasWidth;
  const scaleY = displayHeight / canvasHeight;

  return regions.map(region => ({
    type: region.type,
    x: region.x * scaleX,
    y: region.y * scaleY,
    width: region.width * scaleX,
    height: region.height * scaleY,
  }));
}

/**
 * Get a specific region by type
 */
export function getRegionByType(
  regions: InteractiveRegion[],
  type: 'before' | 'after'
): InteractiveRegion | undefined {
  return regions.find(region => region.type === type);
}

/**
 * Check if template has valid layers_json data
 */
export function hasValidLayersJson(template: Template): boolean {
  if (!template.layersJson || template.layersJson.length === 0) {
    return false;
  }

  const beforeLayer = findLayerByNames(template.layersJson, BEFORE_LAYER_NAMES);
  const afterLayer = findLayerByNames(template.layersJson, AFTER_LAYER_NAMES);

  return !!(beforeLayer && afterLayer);
}

