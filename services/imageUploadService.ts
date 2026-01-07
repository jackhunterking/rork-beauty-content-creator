import { supabase } from '@/lib/supabase';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

const BUCKET_NAME = 'render-images';

/**
 * Upload a local image to Supabase Storage
 * Returns the public URL of the uploaded image
 * 
 * @param localUri - Local file URI (file:// or content://)
 * @param filename - Desired filename (without extension, will append timestamp)
 * @returns Public URL of the uploaded image
 */
export async function uploadToStorage(
  localUri: string,
  filename: string
): Promise<string> {
  // Read file as base64
  const file = new File(localUri);
  const base64Data = await file.base64();

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const uniqueFilename = `${filename}-${timestamp}.jpg`;
  
  // Convert base64 to ArrayBuffer
  const arrayBuffer = decode(base64Data);

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(uniqueFilename, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Upload multiple images to Supabase Storage
 * Returns a map of layer IDs to public URLs
 * 
 * @param images - Map of layer ID to local URI
 * @returns Map of layer ID to public URL
 */
export async function uploadMultipleToStorage(
  images: Record<string, string>
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Upload all images in parallel
  const uploadPromises = Object.entries(images).map(async ([layerId, localUri]) => {
    const publicUrl = await uploadToStorage(localUri, layerId);
    return { layerId, publicUrl };
  });

  const uploadResults = await Promise.all(uploadPromises);

  for (const { layerId, publicUrl } of uploadResults) {
    results[layerId] = publicUrl;
  }

  return results;
}

/**
 * Delete an image from Supabase Storage
 * 
 * @param publicUrl - The public URL of the image to delete
 */
export async function deleteFromStorage(publicUrl: string): Promise<void> {
  // Extract filename from public URL
  const url = new URL(publicUrl);
  const pathParts = url.pathname.split('/');
  const filename = pathParts[pathParts.length - 1];

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filename]);

  if (error) {
    console.error('Delete error:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

/**
 * Clean up old render images (older than 24 hours)
 * Call this periodically to prevent storage bloat
 */
export async function cleanupOldImages(): Promise<number> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list();

  if (error) {
    console.error('List error:', error);
    throw new Error(`Failed to list images: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return 0;
  }

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oldFiles = data.filter(file => {
    // Parse timestamp from filename (e.g., "slot-before-1234567890.jpg")
    const match = file.name.match(/-(\d+)\.jpg$/);
    if (match) {
      const timestamp = parseInt(match[1], 10);
      return now - timestamp > oneDayMs;
    }
    return false;
  });

  if (oldFiles.length === 0) {
    return 0;
  }

  const filenames = oldFiles.map(f => f.name);
  const { error: deleteError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(filenames);

  if (deleteError) {
    console.error('Cleanup error:', deleteError);
    throw new Error(`Failed to cleanup images: ${deleteError.message}`);
  }

  return filenames.length;
}
