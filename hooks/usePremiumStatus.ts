import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Premium Status Hook
 * 
 * Manages premium/subscription status for the app.
 * Currently uses local storage for development/testing.
 * 
 * In production, replace with actual subscription service:
 * - RevenueCat
 * - Stripe
 * - App Store/Play Store subscriptions
 * 
 * Premium features:
 * - Remove watermark from rendered images
 * - (Future) Additional templates
 * - (Future) Advanced features
 */

const PREMIUM_STORAGE_KEY = '@beauty_app_premium_status';

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  expiresAt?: Date;
  plan?: 'monthly' | 'yearly' | 'lifetime';
}

export function usePremiumStatus() {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<'monthly' | 'yearly' | 'lifetime' | undefined>();
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();

  // Load premium status from storage
  useEffect(() => {
    loadPremiumStatus();
  }, []);

  const loadPremiumStatus = async () => {
    try {
      const storedData = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
      
      if (storedData) {
        const data = JSON.parse(storedData);
        
        // Check if subscription is still valid
        if (data.expiresAt) {
          const expiry = new Date(data.expiresAt);
          if (expiry > new Date()) {
            setIsPremium(true);
            setPlan(data.plan);
            setExpiresAt(expiry);
          } else {
            // Subscription expired
            setIsPremium(false);
            await AsyncStorage.removeItem(PREMIUM_STORAGE_KEY);
          }
        } else if (data.plan === 'lifetime') {
          // Lifetime never expires
          setIsPremium(true);
          setPlan('lifetime');
        }
      }
    } catch (error) {
      console.error('Failed to load premium status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Set premium status (called after successful purchase)
  const setPremiumActive = useCallback(async (
    newPlan: 'monthly' | 'yearly' | 'lifetime',
    expiry?: Date
  ) => {
    try {
      const data = {
        isPremium: true,
        plan: newPlan,
        expiresAt: newPlan === 'lifetime' ? undefined : expiry?.toISOString(),
        activatedAt: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify(data));
      
      setIsPremium(true);
      setPlan(newPlan);
      setExpiresAt(expiry);
    } catch (error) {
      console.error('Failed to save premium status:', error);
      throw error;
    }
  }, []);

  // Clear premium status (for testing or cancellation)
  const clearPremium = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(PREMIUM_STORAGE_KEY);
      setIsPremium(false);
      setPlan(undefined);
      setExpiresAt(undefined);
    } catch (error) {
      console.error('Failed to clear premium status:', error);
    }
  }, []);

  // Refresh status (call when app comes to foreground)
  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    await loadPremiumStatus();
  }, []);

  return {
    isPremium,
    isLoading,
    plan,
    expiresAt,
    setPremiumActive,
    clearPremium,
    refreshStatus,
  };
}

/**
 * Check premium status synchronously (for render functions)
 * Note: This is a convenience function that returns the last known status
 * For accurate status, use the hook
 */
export async function checkPremiumStatus(): Promise<boolean> {
  try {
    const storedData = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
    
    if (!storedData) {
      return false;
    }
    
    const data = JSON.parse(storedData);
    
    if (data.plan === 'lifetime') {
      return true;
    }
    
    if (data.expiresAt) {
      return new Date(data.expiresAt) > new Date();
    }
    
    return false;
  } catch {
    return false;
  }
}

export default usePremiumStatus;

