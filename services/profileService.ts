import { supabase } from '@/lib/supabase';
import { UserProfile, ProfileRow, OnboardingSurveyData } from '@/types';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

/**
 * Profile Service
 * 
 * Handles user profile CRUD operations and avatar uploads.
 */

/**
 * Transform Supabase profile row to app UserProfile
 */
function transformProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? undefined,
    businessName: row.business_name ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Onboarding fields
    industry: row.industry ?? undefined,
    goal: row.goal ?? undefined,
    onboardingCompletedAt: row.onboarding_completed_at ?? undefined,
  };
}

/**
 * Get the current user's profile
 */
export async function getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Profile] Error fetching profile:', error);
      return null;
    }

    return transformProfile(data as ProfileRow);
  } catch (error) {
    console.error('[Profile] Error getting profile:', error);
    return null;
  }
}

/**
 * Update the user's profile
 */
export async function updateProfile(
  userId: string,
  updates: {
    displayName?: string;
    businessName?: string;
  }
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: updates.displayName,
        business_name: updates.businessName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Profile] Error updating profile:', error);
      return { success: false, error: error.message };
    }

    return { success: true, profile: transformProfile(data as ProfileRow) };
  } catch (error: any) {
    console.error('[Profile] Error updating profile:', error);
    return { success: false, error: error.message || 'Failed to update profile' };
  }
}

/**
 * Upload and update user's avatar
 */
export async function uploadAvatar(
  userId: string,
  imageUri: string
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  try {
    // Read the file as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Determine file extension
    const extension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = `${userId}/avatar.${extension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, decode(base64), {
        contentType,
        upsert: true, // Replace existing avatar
      });

    if (uploadError) {
      console.error('[Profile] Error uploading avatar:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Add cache-busting parameter
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[Profile] Error updating avatar URL:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true, avatarUrl };
  } catch (error: any) {
    console.error('[Profile] Error uploading avatar:', error);
    return { success: false, error: error.message || 'Failed to upload avatar' };
  }
}

/**
 * Delete user's avatar
 */
export async function deleteAvatar(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // List and delete all files in user's avatar folder
    const { data: files } = await supabase.storage
      .from('avatars')
      .list(userId);

    if (files && files.length > 0) {
      const filePaths = files.map(f => `${userId}/${f.name}`);
      await supabase.storage.from('avatars').remove(filePaths);
    }

    // Clear avatar URL in profile
    const { error } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Profile] Error deleting avatar:', error);
    return { success: false, error: error.message || 'Failed to delete avatar' };
  }
}

/**
 * Export all user data (GDPR compliance)
 * Returns a JSON object with all user data
 */
export async function exportUserData(userId: string): Promise<{ 
  success: boolean; 
  data?: object; 
  error?: string 
}> {
  try {
    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Fetch portfolio items
    const { data: portfolio } = await supabase
      .from('portfolio')
      .select('*');

    // Fetch drafts
    const { data: drafts } = await supabase
      .from('drafts')
      .select('*');

    // Compile all data
    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: profile || null,
      portfolio: portfolio || [],
      drafts: drafts || [],
    };

    return { success: true, data: exportData };
  } catch (error: any) {
    console.error('[Profile] Error exporting data:', error);
    return { success: false, error: error.message || 'Failed to export data' };
  }
}

/**
 * Delete all user data (used during account deletion)
 * Note: This is also handled server-side in the delete-user edge function
 */
export async function deleteAllUserData(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete portfolio items
    await supabase
      .from('portfolio')
      .delete()
      .eq('id', userId); // Assuming RLS handles user scoping

    // Delete drafts
    await supabase
      .from('drafts')
      .delete()
      .eq('id', userId);

    // Delete avatar from storage
    await deleteAvatar(userId);

    // Delete profile (this might cascade delete due to foreign key)
    await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    return { success: true };
  } catch (error: any) {
    console.error('[Profile] Error deleting user data:', error);
    return { success: false, error: error.message || 'Failed to delete user data' };
  }
}

/**
 * Save onboarding survey data to user profile
 * Called after user completes onboarding flow and authenticates
 */
export async function saveOnboardingData(
  userId: string,
  surveyData: OnboardingSurveyData
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        industry: surveyData.industry,
        goal: surveyData.goal,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Profile] Error saving onboarding data:', error);
      return { success: false, error: error.message };
    }

    console.log('[Profile] Saved onboarding data for user:', userId);
    return { success: true, profile: transformProfile(data as ProfileRow) };
  } catch (error: any) {
    console.error('[Profile] Error saving onboarding data:', error);
    return { success: false, error: error.message || 'Failed to save onboarding data' };
  }
}

/**
 * Check if user has completed onboarding
 */
export async function hasUserCompletedOnboarding(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return !!data.onboarding_completed_at;
  } catch (error) {
    console.error('[Profile] Error checking onboarding status:', error);
    return false;
  }
}
