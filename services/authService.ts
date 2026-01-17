import { supabase } from '@/lib/supabase';
import { AuthResult, UserProfile, ProfileRow } from '@/types';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { trackRegistrationComplete, setUserId, clearUserId } from '@/services/metaAnalyticsService';

/**
 * Auth Service
 * 
 * Handles all authentication operations with Supabase Auth.
 * Supports Apple Sign In, Google Sign In, and Email/Password.
 */

// Ensure web browser auth sessions complete properly
WebBrowser.maybeCompleteAuthSession();

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
  };
}

/**
 * Get the current user's profile from the database
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      console.error('[Auth] Error fetching profile:', error);
      return null;
    }

    return transformProfile(data as ProfileRow);
  } catch (error) {
    console.error('[Auth] Error getting current profile:', error);
    return null;
  }
}

/**
 * Sign in with Apple
 * Uses native Apple authentication on iOS
 */
export async function signInWithApple(): Promise<AuthResult> {
  try {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'Apple Sign In is only available on iOS' };
    }

    // Get Apple credential
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { success: false, error: 'No identity token received from Apple' };
    }

    // Sign in with Supabase using the Apple token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) {
      console.error('[Auth] Apple sign in error:', error);
      return { success: false, error: error.message };
    }

    // Update profile with Apple-provided name if available
    if (credential.fullName && data.user) {
      const fullName = [credential.fullName.givenName, credential.fullName.familyName]
        .filter(Boolean)
        .join(' ');
      
      if (fullName) {
        await supabase
          .from('profiles')
          .update({ display_name: fullName })
          .eq('id', data.user.id);
      }
    }

    // Track registration completion for Meta Ads attribution
    if (Platform.OS === 'ios' && data.user) {
      trackRegistrationComplete('apple');
      setUserId(data.user.id);
    }

    const profile = await getCurrentProfile();
    return { success: true, user: profile ?? undefined };
  } catch (error: any) {
    // User cancelled
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return { success: false, error: 'Sign in cancelled' };
    }
    console.error('[Auth] Apple sign in error:', error);
    return { success: false, error: error.message || 'Apple sign in failed' };
  }
}

/**
 * Sign in with Google
 * Uses OAuth flow with web browser
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: Platform.OS !== 'web',
        redirectTo: Platform.OS === 'web' ? undefined : 'resulta://auth/callback',
      },
    });

    if (error) {
      console.error('[Auth] Google sign in error:', error);
      return { success: false, error: error.message };
    }

    // On native, we need to open the browser
    if (Platform.OS !== 'web' && data.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'resulta://auth/callback'
      );

      if (result.type !== 'success') {
        return { success: false, error: 'Sign in cancelled' };
      }
    }

    // Wait a moment for session to be established
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Track registration completion for Meta Ads attribution
    const { data: { user } } = await supabase.auth.getUser();
    if (Platform.OS === 'ios' && user) {
      trackRegistrationComplete('google');
      setUserId(user.id);
    }
    
    const profile = await getCurrentProfile();
    return { success: true, user: profile ?? undefined };
  } catch (error: any) {
    console.error('[Auth] Google sign in error:', error);
    return { success: false, error: error.message || 'Google sign in failed' };
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[Auth] Email sign in error:', error);
      return { success: false, error: error.message };
    }

    const profile = await getCurrentProfile();
    return { success: true, user: profile ?? undefined };
  } catch (error: any) {
    console.error('[Auth] Email sign in error:', error);
    return { success: false, error: error.message || 'Sign in failed' };
  }
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(
  email: string, 
  password: string,
  displayName?: string
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) {
      console.error('[Auth] Email sign up error:', error);
      return { success: false, error: error.message };
    }

    // If email confirmation is required
    if (data.user && !data.session) {
      return { 
        success: true, 
        error: 'Please check your email to confirm your account' 
      };
    }

    // Update profile with display name if provided
    if (displayName && data.user) {
      await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', data.user.id);
    }

    // Track registration completion for Meta Ads attribution (only if session created)
    if (Platform.OS === 'ios' && data.user && data.session) {
      trackRegistrationComplete('email');
      setUserId(data.user.id);
    }

    const profile = await getCurrentProfile();
    return { success: true, user: profile ?? undefined };
  } catch (error: any) {
    console.error('[Auth] Email sign up error:', error);
    return { success: false, error: error.message || 'Sign up failed' };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('[Auth] Sign out error:', error);
      return { success: false, error: error.message };
    }

    // Clear Meta Analytics user ID on sign out
    if (Platform.OS === 'ios') {
      clearUserId();
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Auth] Sign out error:', error);
    return { success: false, error: error.message || 'Sign out failed' };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'resulta://auth/reset-password',
    });

    if (error) {
      console.error('[Auth] Password reset error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Auth] Password reset error:', error);
    return { success: false, error: error.message || 'Failed to send reset email' };
  }
}

/**
 * Delete the current user's account
 * This is required by App Store guidelines
 * 
 * Note: This calls a Supabase Edge Function that handles:
 * - Deleting user data from all tables
 * - Removing files from storage
 * - Deleting the auth user
 */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    // Call the delete-user edge function
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { userId: user.id },
    });

    if (error) {
      console.error('[Auth] Delete account error:', error);
      return { success: false, error: error.message };
    }

    // Sign out locally after deletion
    await supabase.auth.signOut();

    return { success: true };
  } catch (error: any) {
    console.error('[Auth] Delete account error:', error);
    return { success: false, error: error.message || 'Failed to delete account' };
  }
}

/**
 * Check if Apple Sign In is available on this device
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Get the current auth session
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current user from Supabase Auth
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
