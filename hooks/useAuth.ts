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
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);

  // Check if user is authenticated
  const isAuthenticated = !!session && !!user;

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(initialSession);

        if (initialSession?.user) {
          const profile = await getCurrentProfile();
          if (mounted) {
            setUser(profile);
          }
        }
      } catch (error) {
        console.error('[useAuth] Error initializing auth:', error);
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

        setSession(newSession);

        if (event === 'SIGNED_IN' && newSession?.user) {
          const profile = await getCurrentProfile();
          if (mounted) setUser(profile);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'USER_UPDATED' && newSession?.user) {
          const profile = await getCurrentProfile();
          if (mounted) setUser(profile);
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
