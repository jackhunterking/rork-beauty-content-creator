import { CapturedImages } from '@/types';
import { uploadMultipleToStorage } from './imageUploadService';
import Constants from 'expo-constants';

// Templated.io API configuration
// API key should be stored in environment variables or Supabase secrets
const TEMPLATED_API_URL = 'https://api.templated.io/v2/renders';

// Get API key from environment - will need to be set up in app.json or .env
const getTemplatedApiKey = (): string => {
  const apiKey = Constants.expoConfig?.extra?.templatedApiKey || 
                 process.env.EXPO_PUBLIC_TEMPLATED_API_KEY ||
                 '';
  
  if (!apiKey) {
    console.warn('Templated.io API key not configured');
  }
  
  return apiKey;
};

/**
 * Render result from Templated.io
 */
export interface RenderResult {
  renderUrl: string;
  renderJobId: string;
  status: 'success' | 'pending' | 'error';
  error?: string;
}

/**
 * Render a template with captured images using Templated.io API
 * 
 * Flow:
 * 1. Upload all captured images to Supabase Storage
 * 2. Call Templated.io API with template ID and image URLs
 * 3. Return the rendered image URL
 * 
 * @param templatedId - The Templated.io template ID
 * @param capturedImages - Map of slot layer IDs to MediaAsset objects
 * @returns RenderResult with the final image URL
 */
export async function renderTemplate(
  templatedId: string,
  capturedImages: CapturedImages
): Promise<RenderResult> {
  const apiKey = getTemplatedApiKey();
  
  if (!apiKey) {
    throw new Error('Templated.io API key not configured. Please add EXPO_PUBLIC_TEMPLATED_API_KEY to your environment.');
  }

  // Step 1: Extract local URIs and upload to Supabase Storage
  const imagesToUpload: Record<string, string> = {};
  
  for (const [layerId, media] of Object.entries(capturedImages)) {
    if (media?.uri) {
      imagesToUpload[layerId] = media.uri;
    }
  }

  if (Object.keys(imagesToUpload).length === 0) {
    throw new Error('No images to render');
  }

  // Upload all images and get public URLs
  const uploadedUrls = await uploadMultipleToStorage(imagesToUpload);

  // Step 2: Build Templated.io layers payload
  const layerPayload: Record<string, { image_url: string }> = {};
  
  for (const [layerId, publicUrl] of Object.entries(uploadedUrls)) {
    layerPayload[layerId] = { image_url: publicUrl };
  }

  // Step 3: Call Templated.io API
  const response = await fetch(TEMPLATED_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template: templatedId,
      format: 'jpeg',
      layers: layerPayload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Templated.io API error:', errorText);
    throw new Error(`Templated.io render failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  return {
    renderUrl: result.render_url,
    renderJobId: result.job_id || result.id || 'unknown',
    status: 'success',
  };
}

/**
 * Check render status (for async renders)
 * Some renders may be async and require polling
 */
export async function checkRenderStatus(jobId: string): Promise<RenderResult> {
  const apiKey = getTemplatedApiKey();
  
  if (!apiKey) {
    throw new Error('Templated.io API key not configured');
  }

  const response = await fetch(`${TEMPLATED_API_URL}/${jobId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check render status: ${response.status}`);
  }

  const result = await response.json();

  return {
    renderUrl: result.render_url || '',
    renderJobId: jobId,
    status: result.status === 'completed' ? 'success' : 
            result.status === 'failed' ? 'error' : 'pending',
    error: result.error,
  };
}

/**
 * Download rendered image to local storage
 * Useful for saving to device or sharing
 */
export async function downloadRenderToLocal(
  renderUrl: string,
  filename: string
): Promise<string> {
  const FileSystem = require('expo-file-system');
  
  const localPath = `${FileSystem.documentDirectory}${filename}.jpg`;
  
  const downloadResult = await FileSystem.downloadAsync(
    renderUrl,
    localPath
  );

  if (downloadResult.status !== 200) {
    throw new Error(`Failed to download render: ${downloadResult.status}`);
  }

  return downloadResult.uri;
}

/**
 * Generate a preview render URL (without actually rendering)
 * This can be used to show what the final render would look like
 * using the template's preview functionality
 */
export function generatePreviewUrl(
  templatedId: string,
  capturedImageUrls: Record<string, string>
): string {
  // Build query params for preview
  const params = new URLSearchParams();
  params.set('template', templatedId);
  
  for (const [layerId, url] of Object.entries(capturedImageUrls)) {
    params.set(`layer_${layerId}`, url);
  }

  return `https://api.templated.io/v2/preview?${params.toString()}`;
}

