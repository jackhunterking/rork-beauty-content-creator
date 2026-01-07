import { supabase } from '@/lib/supabase';
import { File, Directory, Paths } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

const BUCKET_NAME = 'draft-images';

/**
 * Upload an image to Supabase Storage
 * @param draftId - The draft ID to organize the image
 * @param localUri - The local file URI to upload
 * @param slotId - Slot identifier (e.g., 'before', 'after', 'slot-before', 'slot-hero')
 * @returns The public URL of the uploaded image
 */
export async function uploadDraftImage(
  draftId: string,
  localUri: string,
  slotId: string
): Promise<string> {
  try {
    // Read the file as base64
    const file = new File(localUri);
    const base64 = await file.base64();

    // Determine file extension from URI or default to jpg
    const extension = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
    
    // Clean the slot ID for use in filename (replace special chars)
    const cleanSlotId = slotId.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    // Create the file path: {draftId}/{slotId}.{extension}
    const filePath = `${draftId}/${cleanSlotId}.${extension}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, decode(base64), {
        contentType: mimeType,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Failed to upload draft image:', error);
    throw error;
  }
}

/**
 * Delete all images for a draft from Supabase Storage
 * @param draftId - The draft ID whose images should be deleted
 */
export async function deleteDraftImages(draftId: string): Promise<void> {
  try {
    // List all files in the draft folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(draftId);

    if (listError) {
      console.error('List error:', listError);
      throw listError;
    }

    if (files && files.length > 0) {
      // Delete all files in the folder
      const filePaths = files.map(file => `${draftId}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filePaths);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }
    }
  } catch (error) {
    console.error('Failed to delete draft images:', error);
    throw error;
  }
}

/**
 * Delete a specific draft image
 * @param draftId - The draft ID
 * @param slotId - Slot identifier (e.g., 'before', 'after', 'slot-before', 'slot-hero')
 */
export async function deleteDraftImage(
  draftId: string,
  slotId: string
): Promise<void> {
  try {
    // Clean the slot ID for matching
    const cleanSlotId = slotId.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    // List files to find the exact filename (extension may vary)
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(draftId);

    if (listError) {
      throw listError;
    }

    const targetFile = files?.find(file => file.name.startsWith(cleanSlotId));
    if (targetFile) {
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([`${draftId}/${targetFile.name}`]);

      if (deleteError) {
        throw deleteError;
      }
    }
  } catch (error) {
    console.error('Failed to delete draft image:', error);
    throw error;
  }
}

/**
 * Download an image from Supabase Storage to local cache
 * @param url - The Supabase Storage public URL
 * @returns Local file URI
 */
export async function downloadDraftImage(url: string): Promise<string> {
  try {
    // Create a unique filename based on the URL
    const filename = url.split('/').pop() || 'image.jpg';
    const localFilename = `draft_${Date.now()}_${filename}`;
    const destination = new Directory(Paths.cache);

    // Download the file
    const downloadedFile = await File.downloadFileAsync(url, destination);

    // Rename to our desired filename
    const finalFile = new File(Paths.cache, localFilename);
    downloadedFile.move(finalFile);

    return finalFile.uri;
  } catch (error) {
    console.error('Failed to download draft image:', error);
    throw error;
  }
}

/**
 * Check if a URL is a Supabase Storage URL
 */
export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('supabase') && url.includes('storage');
}
