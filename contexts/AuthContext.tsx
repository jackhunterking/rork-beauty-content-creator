import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UserProfile, AuthResult } from '@/types';
import { Session } from '@supabase/supabase-js';

/**
 * Auth Context
 * 
 * Provides authentication state and actions throughout the app.
 * Wrap your app with AuthProvider to use useAuthContext() in any component.
 */

interface AuthContextValue {
  // State
  user: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  appleSignInAvailable: boolean;

  // Auth actions
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;

  // Profile actions
  updateProfile: (updates: { displayName?: string; businessName?: string }) => Promise<{ success: boolean; profile?: UserProfile; error?: string }>;
  uploadAvatar: (imageUri: string) => Promise<{ success: boolean; avatarUrl?: string; error?: string }>;
  exportData: () => Promise<{ success: boolean; data?: object; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 * Must be used within an AuthProvider
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
}

export default AuthContext;
