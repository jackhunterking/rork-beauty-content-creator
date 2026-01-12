import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { OnboardingSurveyData } from '@/types';

/**
 * Onboarding Service
 * 
 * Handles onboarding state management and survey data storage.
 * Survey data is collected via Superwall and stored temporarily in AsyncStorage
 * until the user completes authentication, at which point it's saved to Supabase.
 */

const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: '@resulta_onboarding_complete',
  PENDING_SURVEY_DATA: '@resulta_pending_survey_data',
};

/**
 * Check if user has completed onboarding
 * 
 * IMPORTANT: Only trusts Supabase, not local storage alone.
 * This ensures survey data is always collected before sign-up completes.
 * If user closes app before signing up, they'll see onboarding again.
 */
export async function hasCompletedOnboarding(userId?: string): Promise<boolean> {
  try {
    // ONLY check Supabase if user is authenticated
    // We don't trust local storage alone - must be saved to backend
    if (userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', userId)
        .single();

      if (!error && data?.onboarding_completed_at) {
        // User has completed onboarding - sync local storage
        await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
        console.log('[Onboarding] User has completed onboarding (verified from Supabase)');
        return true;
      }
    }

    // Not authenticated or no completion in Supabase = not complete
    // Clear any stale local state to ensure fresh onboarding
    await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
    console.log('[Onboarding] User has not completed onboarding');
    return false;
  } catch (error) {
    console.error('[Onboarding] Error checking completion status:', error);
    return false;
  }
}

/**
 * Check if pending survey data exists in local storage
 * Used to determine if we need to re-trigger onboarding
 */
export async function hasPendingSurveyData(): Promise<boolean> {
  const data = await getPendingSurveyData();
  return data !== null && (!!data.industry || !!data.goal);
}

/**
 * Store survey data temporarily in AsyncStorage
 * This is called after Superwall surveys complete, before auth
 */
export async function storePendingSurveyData(data: OnboardingSurveyData): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.PENDING_SURVEY_DATA,
      JSON.stringify(data)
    );
    console.log('[Onboarding] Stored pending survey data:', data);
  } catch (error) {
    console.error('[Onboarding] Error storing survey data:', error);
    throw error;
  }
}

/**
 * Get pending survey data from AsyncStorage
 */
export async function getPendingSurveyData(): Promise<OnboardingSurveyData | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SURVEY_DATA);
    if (stored) {
      return JSON.parse(stored) as OnboardingSurveyData;
    }
    return null;
  } catch (error) {
    console.error('[Onboarding] Error getting pending survey data:', error);
    return null;
  }
}

/**
 * Clear pending survey data after it's been saved to Supabase
 */
export async function clearPendingSurveyData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_SURVEY_DATA);
  } catch (error) {
    console.error('[Onboarding] Error clearing pending survey data:', error);
  }
}

/**
 * Save onboarding data to Supabase after authentication
 * This transfers the pending survey data to the user's profile
 */
export async function saveOnboardingDataToProfile(
  userId: string,
  surveyData?: OnboardingSurveyData
): Promise<{ success: boolean; error?: string }> {
  try {
    // If no survey data provided, try to get pending data
    const dataToSave = surveyData || await getPendingSurveyData();
    
    const updateData: {
      industry?: string;
      goal?: string;
      onboarding_completed_at: string;
      updated_at: string;
    } = {
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add survey data if available
    if (dataToSave) {
      updateData.industry = dataToSave.industry;
      updateData.goal = dataToSave.goal;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('[Onboarding] Error saving to profile:', error);
      return { success: false, error: error.message };
    }

    // Mark onboarding as complete locally
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
    
    // Clear pending data
    await clearPendingSurveyData();

    console.log('[Onboarding] Successfully saved onboarding data for user:', userId);
    return { success: true };
  } catch (error: any) {
    console.error('[Onboarding] Error saving onboarding data:', error);
    return { success: false, error: error.message || 'Failed to save onboarding data' };
  }
}

/**
 * Mark onboarding as complete without survey data
 * Used when user skips surveys or data is unavailable
 */
export async function markOnboardingComplete(userId?: string): Promise<void> {
  try {
    // Mark locally
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
    
    // Update Supabase if user is authenticated
    if (userId) {
      await supabase
        .from('profiles')
        .update({
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }
    
    console.log('[Onboarding] Marked onboarding as complete');
  } catch (error) {
    console.error('[Onboarding] Error marking complete:', error);
  }
}

/**
 * Reset onboarding state (for testing/debugging)
 */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ONBOARDING_COMPLETE,
      STORAGE_KEYS.PENDING_SURVEY_DATA,
    ]);
    console.log('[Onboarding] Reset onboarding state');
  } catch (error) {
    console.error('[Onboarding] Error resetting:', error);
  }
}

/**
 * Parse survey responses from Superwall event/user attributes
 * Superwall sets user attributes when options are tapped
 */
export function parseSuperWallSurveyData(
  surveyResponses: Record<string, any>
): OnboardingSurveyData {
  // Extract industry - Superwall sets this as user attribute when option is tapped
  const industry = surveyResponses.industry || 
                   surveyResponses.survey_industry || 
                   surveyResponses['survey-1'] ||
                   '';
  
  // Extract goal (single selection) - Superwall sets this as user attribute
  const goal = surveyResponses.goal || 
               surveyResponses.survey_goal || 
               surveyResponses['survey-2'] ||
               '';

  return {
    industry,
    goal,
  };
}

export default {
  hasCompletedOnboarding,
  hasPendingSurveyData,
  storePendingSurveyData,
  getPendingSurveyData,
  clearPendingSurveyData,
  saveOnboardingDataToProfile,
  markOnboardingComplete,
  resetOnboarding,
  parseSuperWallSurveyData,
};
