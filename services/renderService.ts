import Constants from 'expo-constants';
import { 
  uploadMultipleTempImages, 
  cleanupSession, 
  generateSessionId,
} from './tempUploadService';

/**
 * Render Service - Templated.io Integration
 * 
 * SIMPLIFIED ARCHITECTURE (Jan 2026):
 * The preview URL returned by renderPreview() IS the final rendered image.
 * Download/Share operations now use this URL directly - no re-rendering needed.
 * 
 * Active Functions:
 * - renderPreview() - Renders template when photos are added/changed
 * - renderPreviewWithNewPhoto() - Convenience wrapper for renderPreview
 * 
 * Flow:
 * 1. User adds photo → renderPreview() → Returns Templated.io URL
 * 2. User taps Download → Download from preview URL → Save to gallery
 * 3. User taps Share → Download from preview URL → Share sheet
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
  /** Whether to hide watermark (premium users only) */
  hideWatermark?: boolean;
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
  const { templateId, slotImages, hideWatermark = false } = options;
  
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
    
    // Handle watermark visibility
    // Watermark layer should be named 'watermark' or contain 'watermark' in template
    if (hideWatermark) {
      layerPayload['watermark'] = { hide: true };
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
 * @param hideWatermark - Whether to hide watermark (premium)
 */
export async function renderPreviewWithNewPhoto(
  templateId: string,
  slotId: string,
  photoUri: string,
  existingPhotos: Record<string, string> = {},
  hideWatermark: boolean = false
): Promise<PreviewRenderResult> {
  // Combine new photo with existing
  const allPhotos = {
    ...existingPhotos,
    [slotId]: photoUri,
  };
  
  return renderPreview({
    templateId,
    slotImages: allPhotos,
    hideWatermark,
  });
}
