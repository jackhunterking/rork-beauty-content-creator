import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { 
  uploadMultipleTempImages, 
  cleanupSession, 
  generateSessionId,
} from './tempUploadService';
import { Overlay } from '@/types/overlays';

/**
 * Render Service - Templated.io Integration
 * 
 * SIMPLIFIED ARCHITECTURE (Jan 2026):
 * The preview URL returned by renderPreview() IS the final rendered image.
 * Download/Share operations now use this URL directly - no re-rendering needed.
 * 
 * OVERLAY SUPPORT (Jan 2026):
 * Overlays are rendered client-side on top of the Templated.io image.
 * The compositeWithOverlays() function handles the final composition.
 * 
 * Active Functions:
 * - renderPreview() - Renders template when photos are added/changed
 * - renderPreviewWithNewPhoto() - Convenience wrapper for renderPreview
 * - compositeWithOverlays() - Client-side overlay composition
 * 
 * Flow:
 * 1. User adds photo → renderPreview() → Returns Templated.io URL
 * 2. User adds overlays → Overlays rendered as RN components
 * 3. User taps Generate → compositeWithOverlays() → Final image with overlays
 * 4. User taps Download → Download final image → Save to gallery
 */

// Templated.io API configuration
// Note: v1 API uses /v1/render (singular), v2 uses /v2/renders (plural) but requires different auth
const TEMPLATED_API_URL = 'https://api.templated.io/v1/render';

// Get API key from environment
const getTemplatedApiKey = (): string => {
  const apiKey = Constants.expoConfig?.extra?.templatedApiKey || 
                 process.env.EXPO_PUBLIC_TEMPLATED_API_KEY ||
                 '';
  
  if (!apiKey) {
    console.warn('Templated.io API key not configured');
  }
  
  return apiKey;
};

// ============================================
// Types
// ============================================

export interface PreviewRenderResult {
  success: boolean;
  renderUrl?: string;      // Templated.io URL for preview display
  error?: string;
}

export interface PreviewRenderOptions {
  templateId: string;       // Templated.io template ID
  /** Map of slotId -> local URI for photos to include */
  slotImages: Record<string, string>;
  /** Overlays to render (handled client-side) */
  overlays?: Overlay[];
  /** Background layer color overrides (layerId -> fill color) */
  backgroundOverrides?: Record<string, string>;
}

export interface RenderProgress {
  stage: 'checking_cache' | 'uploading' | 'rendering' | 'downloading' | 'caching' | 'complete' | 'error';
  progress?: number;  // 0-100
  message?: string;
}

export type RenderProgressCallback = (progress: RenderProgress) => void;

// ============================================
// Preview Render Function
// ============================================

/**
 * Render a quick preview for the editor
 * 
 * This is called after each photo is added to show the user
 * an accurate preview with correct layer ordering.
 * 
 * Does NOT cache - returns URL directly for display
 * Optimized for speed over quality
 * 
 * @param options - Preview configuration
 * @returns PreviewRenderResult with Templated.io URL
 */
export async function renderPreview(
  options: PreviewRenderOptions
): Promise<PreviewRenderResult> {
  const { templateId, slotImages, backgroundOverrides } = options;
  
  try {
    // Validate API key
    const apiKey = getTemplatedApiKey();
    if (!apiKey) {
      throw new Error('Templated.io API key not configured');
    }
    
    // Check if we have any images to render
    if (Object.keys(slotImages).length === 0) {
      throw new Error('No slot images provided for preview');
    }
    
    // Upload images to temp storage
    const sessionId = generateSessionId();
    const publicUrls = await uploadMultipleTempImages(slotImages, sessionId);
    
    // Build layer payload
    const layerPayload: Record<string, Record<string, unknown>> = {};
    
    // Add slot images
    for (const [slotId, publicUrl] of Object.entries(publicUrls)) {
      layerPayload[slotId] = { image_url: publicUrl };
    }
    
    // Add background layer color overrides
    if (backgroundOverrides) {
      for (const [layerId, fillColor] of Object.entries(backgroundOverrides)) {
        // Merge with existing layer payload or create new
        layerPayload[layerId] = {
          ...(layerPayload[layerId] || {}),
          fill: fillColor,
        };
      }
    }
    
    // Call Templated.io API
    const response = await fetch(TEMPLATED_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: templateId,
        format: 'jpeg',
        layers: layerPayload,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Templated.io API error:', errorText);
      throw new Error(`Preview render failed: ${response.status}`);
    }
    
    const result = await response.json();
    const renderUrl = result.render_url;
    
    if (!renderUrl) {
      throw new Error('No render URL returned');
    }
    
    // Cleanup temp files (fire and forget)
    cleanupSession(sessionId).catch(console.warn);
    
    return {
      success: true,
      renderUrl,
    };
    
  } catch (error) {
    console.error('Preview render failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Preview render failed',
    };
  }
}

/**
 * Render preview with a single new photo added
 * 
 * Convenience function for when user just captured one photo.
 * Uploads just the new photo and renders.
 * 
 * @param templateId - Templated.io template ID
 * @param slotId - The slot ID for the new photo
 * @param photoUri - Local URI of the captured photo
 * @param existingPhotos - Map of other slots that already have photos
 */
export async function renderPreviewWithNewPhoto(
  templateId: string,
  slotId: string,
  photoUri: string,
  existingPhotos: Record<string, string> = {}
): Promise<PreviewRenderResult> {
  // Combine new photo with existing
  const allPhotos = {
    ...existingPhotos,
    [slotId]: photoUri,
  };
  
  return renderPreview({
    templateId,
    slotImages: allPhotos,
  });
}

// ============================================
// Overlay Compositing (Client-Side)
// ============================================

/**
 * Options for compositing overlays onto an image
 */
export interface CompositeOptions {
  /** Base image URI (from Templated.io) */
  baseImageUri: string;
  /** Overlays to composite */
  overlays: Overlay[];
  /** Canvas dimensions */
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Result of overlay compositing
 */
export interface CompositeResult {
  success: boolean;
  /** Local file URI of composited image */
  localUri?: string;
  error?: string;
}

/**
 * Check if there are any overlays to composite
 */
export function hasOverlays(overlays?: Overlay[]): boolean {
  return overlays !== undefined && overlays.length > 0;
}

/**
 * Download an image to local storage
 * 
 * @param imageUrl - Remote URL to download
 * @param filename - Local filename (optional)
 * @returns Local file URI
 */
export async function downloadImageToLocal(
  imageUrl: string,
  filename?: string
): Promise<string> {
  const localFilename = filename || `render_${Date.now()}.jpg`;
  const localUri = `${FileSystem.cacheDirectory}${localFilename}`;
  
  // If already local, return as-is
  if (imageUrl.startsWith('file://')) {
    return imageUrl;
  }
  
  // Download the file
  const downloadResult = await FileSystem.downloadAsync(imageUrl, localUri);
  
  if (downloadResult.status !== 200) {
    throw new Error(`Failed to download image: ${downloadResult.status}`);
  }
  
  return downloadResult.uri;
}

/**
 * Note: Client-side overlay compositing is handled by react-native-view-shot
 * in the Editor component. This captures the entire canvas view including
 * all overlay components rendered on top.
 * 
 * The captured image is then used for download/share operations.
 * 
 * For server-side compositing (if Templated.io supports dynamic layers),
 * we would convert overlays to layer payloads here.
 */

/**
 * Convert overlays to Templated.io layer format (for future use)
 * 
 * This would be used if Templated.io templates support dynamic text/image layers.
 * Currently, overlays are rendered client-side.
 */
export function overlaysToLayerPayload(
  overlays: Overlay[],
  canvasWidth: number,
  canvasHeight: number
): Record<string, Record<string, unknown>> {
  const payload: Record<string, Record<string, unknown>> = {};
  
  for (const overlay of overlays) {
    const layerId = `overlay-${overlay.type}-${overlay.id}`;
    
    // Calculate absolute position from relative transform
    const x = overlay.transform.x * canvasWidth;
    const y = overlay.transform.y * canvasHeight;
    
    if (overlay.type === 'text' || overlay.type === 'date') {
      // Text overlay
      const content = overlay.type === 'date' 
        ? formatDateForOverlay(overlay.date, overlay.format)
        : overlay.content;
        
      payload[layerId] = {
        text: content,
        color: overlay.color,
        font_family: overlay.fontFamily,
        font_size: overlay.fontSize * overlay.transform.scale,
        x,
        y,
        rotation: overlay.transform.rotation,
      };
    } else if (overlay.type === 'logo') {
      // Logo overlay - would need to upload image first
      payload[layerId] = {
        image_url: overlay.imageUri,
        x,
        y,
        width: overlay.originalWidth * overlay.transform.scale,
        height: overlay.originalHeight * overlay.transform.scale,
        rotation: overlay.transform.rotation,
      };
    }
  }
  
  return payload;
}

/**
 * Format date for overlay display
 */
function formatDateForOverlay(dateStr: string, format: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const shortYear = year.toString().slice(-2);
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const shortMonthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  switch (format) {
    case 'short':
      return `${month + 1}/${day}/${shortYear}`;
    case 'medium':
      return `${shortMonthNames[month]} ${day}, ${year}`;
    case 'long':
      return `${monthNames[month]} ${day}, ${year}`;
    case 'iso':
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'european':
      return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
    default:
      return `${monthNames[month]} ${day}, ${year}`;
  }
}
