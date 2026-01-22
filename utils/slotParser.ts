import { TemplatedLayer, Template, Slot, CapturedImages } from '@/types';

/**
 * Check if a layer is a replaceable slot
 * 
 * STRICT PREFIX MATCHING: Layers must start with "slot-" prefix
 * Examples: "slot-before", "slot-after", "slot-hero", "slot-product"
 * 
 * This ensures only intentionally named photo placeholders are detected.
 */
export function isSlotLayer(layer: TemplatedLayer): boolean {
  return layer.layer.toLowerCase().startsWith('slot-');
}

/**
 * Derive human-readable label from slot layer ID
 * Examples:
 *   "slot-before" → "Before"
 *   "slot-after" → "After"
 *   "slot-hero" → "Hero"
 *   "slot-product" → "Product"
 *   "slot-1" → "Photo 1"
 */
export function deriveSlotLabel(layerId: string): string {
  // Remove "slot-" or "slot" prefix
  const name = layerId.toLowerCase().replace('slot-', '').replace('slot', '').trim();
  
  // Handle common naming patterns
  if (name.includes('before')) return 'Before';
  if (name.includes('after')) return 'After';
  if (name.includes('hero')) return 'Main Photo';
  if (name.includes('product')) return 'Product';
  if (name.includes('main')) return 'Main';
  if (name.includes('portrait')) return 'Portrait';
  if (name.includes('headshot')) return 'Headshot';
  
  // Handle numbered slots: slot-1, slot-2, etc.
  if (/^\d+$/.test(name)) return `Photo ${name}`;
  
  // Default: capitalize the name
  if (name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  
  return 'Photo';
}

/**
 * Safely parse layersJson which might be a string (double-encoded) or array
 * This handles edge cases from API responses or database quirks
 */
function parseLayersJson(layersJson: unknown): TemplatedLayer[] | null {
  // Already null/undefined
  if (!layersJson) {
    return null;
  }

  // If it's a string, try to parse it
  if (typeof layersJson === 'string') {
    try {
      const parsed = JSON.parse(layersJson);
      if (Array.isArray(parsed)) {
        return parsed as TemplatedLayer[];
      }
      console.warn('layersJson string parsed but not an array:', typeof parsed);
      return null;
    } catch (e) {
      console.warn('Failed to parse layersJson string:', e);
      return null;
    }
  }

  // If it's already an array, use it directly
  if (Array.isArray(layersJson)) {
    return layersJson as TemplatedLayer[];
  }

  console.warn('layersJson is neither string nor array:', typeof layersJson);
  return null;
}

/**
 * Extract all replaceable slots from a template
 * 
 * Slots are layers with strict "slot-" prefix (e.g., slot-before, slot-after)
 * 
 * @param template - The template to extract slots from
 * @returns Array of Slot objects sorted by their order in layersJson
 */
export function extractSlots(template: Template): Slot[] {
  // Safely parse layersJson - handles string, array, null/undefined
  const layers = parseLayersJson(template.layersJson);
  
  if (!layers || layers.length === 0) {
    return [];
  }

  // Map slots with their ORIGINAL index in layers array (indicates z-order)
  // In Templated.io API: layer order is BACK to FRONT
  // Index 0 = BACK (lowest z), Index N = FRONT (highest z)
  return layers
    .map((layer, index) => ({ layer, index }))
    .filter(({ layer }) => isSlotLayer(layer))
    .map(({ layer, index }) => ({
      layerId: layer.layer,
      label: deriveSlotLabel(layer.layer),
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      placeholderUrl: layer.image_url,
      captureOrder: index + 1,
      zIndex: index + 1, // Array position = z-order (1-indexed)
    }));
}

/**
 * Scale slots from canvas coordinates to display coordinates
 * Used to position slots correctly on the screen preview
 * 
 * @param slots - Array of slots in canvas pixel coordinates
 * @param canvasWidth - Original canvas width in pixels
 * @param canvasHeight - Original canvas height in pixels
 * @param displayWidth - Target display width in pixels
 * @param displayHeight - Target display height in pixels
 * @returns Array of slots with scaled coordinates
 */
export function scaleSlots(
  slots: Slot[],
  canvasWidth: number,
  canvasHeight: number,
  displayWidth: number,
  displayHeight: number
): Slot[] {
  const scaleX = displayWidth / canvasWidth;
  const scaleY = displayHeight / canvasHeight;

  return slots.map(slot => ({
    ...slot,
    x: slot.x * scaleX,
    y: slot.y * scaleY,
    width: slot.width * scaleX,
    height: slot.height * scaleY,
  }));
}

/**
 * Get a specific slot by its layer ID
 */
export function getSlotById(slots: Slot[], layerId: string): Slot | undefined {
  return slots.find(slot => slot.layerId === layerId);
}

/**
 * Check if all slots have been captured
 * 
 * @param slots - Array of slots that need to be captured
 * @param capturedImages - Map of captured images by layer ID
 * @returns true if all slots have a captured image
 */
export function allSlotsCaptured(
  slots: Slot[],
  capturedImages: CapturedImages
): boolean {
  if (slots.length === 0) return false;
  return slots.every(slot => hasValidCapturedImage(slot.layerId, capturedImages));
}

/**
 * Get the count of captured slots
 */
export function getCapturedSlotCount(
  slots: Slot[],
  capturedImages: CapturedImages
): number {
  return slots.filter(slot => hasValidCapturedImage(slot.layerId, capturedImages)).length;
}

/**
 * Get the next slot that needs to be captured (in order)
 */
export function getNextSlotToCapture(
  slots: Slot[],
  capturedImages: CapturedImages
): Slot | undefined {
  return slots.find(slot => !hasValidCapturedImage(slot.layerId, capturedImages));
}

/**
 * Check if a template has valid slots defined in layersJson
 */
export function hasValidSlots(template: Template): boolean {
  const slots = extractSlots(template);
  return slots.length > 0;
}

/**
 * Check if a slot has a valid captured image
 * Performs robust validation to ensure the URI is a valid non-empty string
 * 
 * @param slotId - The slot layer ID to check
 * @param capturedImages - Map of captured images by layer ID
 * @returns true if the slot has a valid captured image URI
 */
export function hasValidCapturedImage(
  slotId: string,
  capturedImages: CapturedImages
): boolean {
  const uri = capturedImages[slotId]?.uri;
  return typeof uri === 'string' && uri.trim().length > 0;
}

/**
 * Convert Slot to legacy ImageSlot format for backwards compatibility
 * Used by CaptureScreen which still expects ImageSlot format
 */
export function slotToImageSlot(slot: Slot): {
  width: number;
  height: number;
  xPercent: number;
  yPercent: number;
  placeholderUrl: string;
} {
  return {
    width: slot.width,
    height: slot.height,
    xPercent: 0, // Not used in new architecture
    yPercent: 0, // Not used in new architecture
    placeholderUrl: slot.placeholderUrl || '',
  };
}

