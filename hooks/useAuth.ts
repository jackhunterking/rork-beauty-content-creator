import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, AuthState } from '@/types';
import { 
  getCurrentProfile, 
  signInWithApple, 
  signInWithGoogle, 
  signInWithEmail, 
  signUpWithEmail,
  signOut as authSignOut,
  sendPasswordResetEmail,
  deleteAccount as authDeleteAccount,
  isAppleSignInAvailable,
} from '@/services/authService';
import { updateProfile, uploadAvatar, exportUserData } from '@/services/profileService';
import { Session } from '@supabase/supabase-js';
import { 
  identifyUser, 
  resetUser, 
  setUserProperties, 
  captureEvent,
  POSTHOG_EVENTS,
  USER_PROPERTIES,
  reloadFeatureFlags,
} from '@/services/posthogService';

/**
 * useAuth Hook
 * 
 * Provides authentication state and actions throughout the app.
 * Wraps Supabase Auth with a clean interface.
 */
export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);

  // Check if user is authenticated - only true when session is fully ready
  const isAuthenticated = !!session && !!user && isSessionReady;

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // Get initial session - this may have an expired token
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (initialSession?.user) {
          // Verify the session is valid by checking the user
          // This will trigger a token refresh if needed
          const { data: { user: validUser }, error: userError } = await supabase.auth.getUser();
          
          if (!mounted) return;
          
          if (userError || !validUser) {
            // Session is invalid - clear it
            console.log('[useAuth] Session invalid, clearing');
            setSession(null);
            setUser(null);
            setIsSessionReady(false);
          } else {
            // Get the FRESH session after validation (token may have been refreshed)
            const { data: { session: freshSession } } = await supabase.auth.getSession();
            
            if (!mounted) return;
            
            // Use the fresh session which has the updated access token
            setSession(freshSession);
            const profile = await getCurrentProfile();
            if (mounted) {
              setUser(profile);
              setIsSessionReady(true); // Now safe for API calls
            }
          }
        } else {
          // No session
          setSession(null);
          setUser(null);
          setIsSessionReady(false);
        }
      } catch (error) {
        console.error('[useAuth] Error initializing auth:', error);
        setIsSessionReady(false);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    // Check Apple Sign In availability
    isAppleSignInAvailable().then(available => {
      if (mounted) setAppleSignInAvailable(available);
    });

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[useAuth] Auth state changed:', event);
        
        if (!mounted) return;

        // INITIAL_SESSION may have expired token - don't mark as ready yet
        // Wait for initAuth to complete or SIGNED_IN/TOKEN_REFRESHED events
        if (event === 'INITIAL_SESSION') {
          // Don't set session ready here - let initAuth handle it after validation
          setSession(newSession);
          return;
        }

        setSession(newSession);

        if (event === 'SIGNED_IN' && newSession?.user) {
          const profile = await getCurrentProfile();
          if (mounted) {
            setUser(profile);
            setIsSessionReady(true); // Session is now ready for API calls
            
            // Identify user in PostHog for analytics tracking
            if (profile) {
              identifyUser(profile.id, {
                [USER_PROPERTIES.INDUSTRY]: profile.industry || '',
                [USER_PROPERTIES.GOAL]: profile.goal || '',
                email: profile.email || '',
                display_name: profile.displayName || '',
                created_at: profile.createdAt,
              });
              // Reload feature flags after user identification
              reloadFeatureFlags();
              // Track sign in event
              captureEvent(POSTHOG_EVENTS.USER_SIGNED_IN, {
                method: 'session_restore',
                user_id: profile.id,
              });
            }
          }
        } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
          // Token was refreshed - session is now valid
          if (mounted) {
            setIsSessionReady(true);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsSessionReady(false); // Reset session ready state
          // Reset PostHog user on sign out
          resetUser();
          // Track sign out event
          captureEvent(POSTHOG_EVENTS.USER_SIGNED_OUT);
        } else if (event === 'USER_UPDATED' && newSession?.user) {
          const profile = await getCurrentProfile();
          if (mounted) {
            setUser(profile);
            // Update PostHog user properties when profile is updated
            if (profile) {
              setUserProperties({
                [USER_PROPERTIES.INDUSTRY]: profile.industry || '',
                [USER_PROPERTIES.GOAL]: profile.goal || '',
                display_name: profile.displayName || '',
              });
            }
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with Apple
  const handleSignInWithApple = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await signInWithApple();
      if (result.success && result.user) {
        setUser(result.user);
        // Identify user in PostHog
        identifyUser(result.user.id, {
          [USER_PROPERTIES.SIGN_UP_METHOD]: 'apple',
          [USER_PROPERTIES.INDUSTRY]: result.user.industry || '',
          [USER_PROPERTIES.GOAL]: result.user.goal || '',
          email: result.user.email || '',
          display_name: result.user.displayName || '',
        });
        reloadFeatureFlags();
        captureEvent(POSTHOG_EVENTS.USER_SIGNED_IN, {
          method: 'apple',
          user_id: result.user.id,
        });
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign in with Google
  const handleSignInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.success && result.user) {
        setUser(result.user);
        // Identify user in PostHog
        identifyUser(result.user.id, {
          [USER_PROPERTIES.SIGN_UP_METHOD]: 'google',
          [USER_PROPERTIES.INDUSTRY]: result.user.industry || '',
          [USER_PROPERTIES.GOAL]: result.user.goal || '',
          email: result.user.email || '',
          display_name: result.user.displayName || '',
        });
        reloadFeatureFlags();
        captureEvent(POSTHOG_EVENTS.USER_SIGNED_IN, {
          method: 'google',
          user_id: result.user.id,
        });
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign in with email
  const handleSignInWithEmail = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await signInWithEmail(email, password);
      if (result.success && result.user) {
        setUser(result.user);
        // Identify user in PostHog
        identifyUser(result.user.id, {
          [USER_PROPERTIES.SIGN_UP_METHOD]: 'email',
          [USER_PROPERTIES.INDUSTRY]: result.user.industry || '',
          [USER_PROPERTIES.GOAL]: result.user.goal || '',
          email: result.user.email || '',
          display_name: result.user.displayName || '',
        });
        reloadFeatureFlags();
        captureEvent(POSTHOG_EVENTS.USER_SIGNED_IN, {
          method: 'email',
          user_id: result.user.id,
        });
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign up with email
  const handleSignUpWithEmail = useCallback(async (
    email: string, 
    password: string, 
    displayName?: string
  ) => {
    setIsLoading(true);
    try {
      const result = await signUpWithEmail(email, password, displayName);
      if (result.success && result.user) {
        setUser(result.user);
        // Identify user in PostHog (new sign up)
        identifyUser(result.user.id, {
          [USER_PROPERTIES.SIGN_UP_METHOD]: 'email',
          [USER_PROPERTIES.INDUSTRY]: result.user.industry || '',
          [USER_PROPERTIES.GOAL]: result.user.goal || '',
          email: result.user.email || '',
          display_name: result.user.displayName || displayName || '',
        });
        reloadFeatureFlags();
        // Track sign up event (different from sign in)
        captureEvent(POSTHOG_EVENTS.USER_SIGNED_UP, {
          method: 'email',
          user_id: result.user.id,
        });
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign out
  const handleSignOut = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await authSignOut();
      if (result.success) {
        setUser(null);
        setSession(null);
        // Reset PostHog user on sign out
        resetUser();
        captureEvent(POSTHOG_EVENTS.USER_SIGNED_OUT);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send password reset
  const handlePasswordReset = useCallback(async (email: string) => {
    return sendPasswordResetEmail(email);
  }, []);

  // Update profile
  const handleUpdateProfile = useCallback(async (updates: {
    displayName?: string;
    businessName?: string;
  }) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    const result = await updateProfile(user.id, updates);
    if (result.success && result.profile) {
      setUser(result.profile);
      // Sync profile updates to PostHog
      setUserProperties({
        display_name: result.profile.displayName || '',
        business_name: result.profile.businessName || '',
      });
    }
    return result;
  }, [user]);

  // Upload avatar
  const handleUploadAvatar = useCallback(async (imageUri: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    const result = await uploadAvatar(user.id, imageUri);
    if (result.success && result.avatarUrl) {
      setUser(prev => prev ? { ...prev, avatarUrl: result.avatarUrl } : null);
    }
    return result;
  }, [user]);

  // Export user data
  const handleExportData = useCallback(async () => {
    if (!user) return { success: false, error: 'Not authenticated' };
    return exportUserData(user.id);
  }, [user]);

  // Delete account
  const handleDeleteAccount = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await authDeleteAccount();
      if (result.success) {
        setUser(null);
        setSession(null);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh user profile
  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const profile = await getCurrentProfile();
    setUser(profile);
  }, [session]);

  return {
    // State
    user,
    session,
    isLoading,
    isAuthenticated,
    appleSignInAvailable,

    // Auth actions
    signInWithApple: handleSignInWithApple,
    signInWithGoogle: handleSignInWithGoogle,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    signOut: handleSignOut,
    sendPasswordReset: handlePasswordReset,

    // Profile actions
    updateProfile: handleUpdateProfile,
    uploadAvatar: handleUploadAvatar,
    exportData: handleExportData,
    deleteAccount: handleDeleteAccount,
    refreshProfile,
  };
}

export default useAuth;
