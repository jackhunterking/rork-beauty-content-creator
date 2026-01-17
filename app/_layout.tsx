import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SuperwallProvider, useSuperwallEvents, usePlacement } from "expo-superwall";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import AnimatedSplash from "@/components/AnimatedSplash";
import ForceUpdateScreen from "@/components/ForceUpdateScreen";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import { 
  hasCompletedOnboarding,
  hasPendingSurveyData,
  clearPendingSurveyData,
  storePendingSurveyData,
  parseSuperWallSurveyData,
} from "@/services/onboardingService";
import { initializeFacebookSDK } from "@/services/metaAnalyticsService";
// Note: In-app purchase tracking is handled automatically by Facebook SDK
// Enable "Log In-App Purchases Automatically" in Facebook Developer Dashboard

// Superwall API keys - replace with your actual keys from Superwall dashboard
const SUPERWALL_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY || "",
  android: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_KEY || "",
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="drafts" 
        options={{ 
          headerShown: true,
          title: 'Drafts',
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="editor" 
        options={{ 
          headerShown: true,
          title: 'Editor',
          presentation: 'card',
          headerBackButtonMenuEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="publish" 
        options={{ 
          headerShown: true,
          title: 'Publish',
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="capture/[slotId]" 
        options={{ 
          headerShown: false,
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="adjust/[slotId]" 
        options={{ 
          headerShown: false,
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="library/viewer" 
        options={{ 
          headerShown: false,
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="auth/sign-in" 
        options={{ 
          headerShown: true,
          title: 'Sign In',
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="auth/sign-up" 
        options={{ 
          headerShown: true,
          title: 'Create Account',
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="auth/onboarding-auth" 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal',
          gestureEnabled: false, // Prevent swipe to dismiss
        }} 
      />
      <Stack.Screen 
        name="membership" 
        options={{ 
          headerShown: false,
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}

/**
 * Onboarding Flow Handler
 * 
 * This component handles the onboarding flow logic following Superwall best practices:
 * https://superwall.com/docs/dashboard/guides/using-superwall-for-onboarding-flows
 * 
 * Uses app_install placement which fires AUTOMATICALLY on first app install.
 * For returning users who didn't complete sign-up, we manually trigger the paywall.
 * 
 * This component:
 * 1. Clears stale local data for non-authenticated users (fresh onboarding)
 * 2. Listens for paywall events to capture survey responses
 * 3. Manually triggers onboarding if app_install won't fire again
 * 4. Redirects to auth screen after paywall dismissal
 * 5. Tracks onboarding completion state
 */
function OnboardingFlowHandler({ 
  splashComplete,
  onOnboardingComplete,
}: { 
  splashComplete: boolean;
  onOnboardingComplete: () => void;
}) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthContext();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const hasNavigatedToAuth = useRef(false);
  const hasTriggeredManualPaywall = useRef(false);
  
  // Get Superwall paywall trigger for manual presentation
  const { registerPlacement } = usePlacement({
    onPresent: (info) => console.log('[Onboarding] Manual paywall presented:', info.name),
    onDismiss: (info, result) => {
      console.log('[Onboarding] Manual paywall dismissed:', result);
      // Navigate to auth after manual paywall dismisses
      if (!hasNavigatedToAuth.current) {
        hasNavigatedToAuth.current = true;
        router.replace('/auth/onboarding-auth');
      }
    },
    onSkip: (reason) => {
      console.log('[Onboarding] Manual paywall skipped:', reason);
      // If skipped, still go to auth
      if (!hasNavigatedToAuth.current) {
        hasNavigatedToAuth.current = true;
        router.replace('/auth/onboarding-auth');
      }
    },
    onError: (error) => {
      console.error('[Onboarding] Manual paywall error:', error);
      // On error, go to auth
      if (!hasNavigatedToAuth.current) {
        hasNavigatedToAuth.current = true;
        router.replace('/auth/onboarding-auth');
      }
    },
  });

  // Clear stale local data for non-authenticated users
  // This ensures they'll see fresh onboarding on every app open until they sign up
  useEffect(() => {
    if (splashComplete && !isAuthenticated) {
      console.log('[Onboarding] Clearing stale local data for non-authenticated user');
      clearPendingSurveyData();
    }
  }, [splashComplete, isAuthenticated]);

  // Listen for Superwall events using the recommended useSuperwallEvents hook
  // IMPORTANT: This hook is for GLOBAL analytics/tracking only, NOT for navigation.
  // Navigation is handled by the usePlacement hook above, which only fires for
  // placements registered through that specific hook instance (app_install).
  // Feature-gating paywalls (e.g., remove_watermark) use their own usePlacement hooks.
  useSuperwallEvents({
    // Called when paywall is presented - for logging/analytics only
    onPaywallPresent: (info) => {
      console.log('[Superwall] Paywall presented:', info.name);
    },
    
    // Called when paywall is dismissed - for logging/analytics only
    // DO NOT navigate here - this fires for ALL paywalls (feature-gating + onboarding)
    // Navigation for onboarding is handled by usePlacement.onDismiss above
    onPaywallDismiss: (info, result) => {
      console.log('[Superwall] Paywall dismissed:', info.name, 'Result:', result);
    },
    
    // Called when paywall is skipped (user already completed onboarding or has subscription)
    onPaywallSkip: (reason) => {
      console.log('[Superwall] Paywall skipped:', reason);
      // Mark as complete since Superwall determined they don't need to see it
      setOnboardingComplete(true);
      onOnboardingComplete();
    },
    
    // Called on error - for logging only
    // DO NOT navigate here - this fires for ALL paywalls
    onPaywallError: (error) => {
      console.error('[Superwall] Paywall error:', error);
    },
    
    // Capture all Superwall events including survey responses - for analytics
    onSuperwallEvent: async (eventInfo) => {
      const eventName = eventInfo.event?.event || eventInfo.event;
      console.log('[Superwall] Event:', eventName);
      
      // Note: In-app purchase events are tracked automatically by Facebook SDK
      // when "Log In-App Purchases Automatically" is enabled in Facebook Dashboard
      
      // Capture survey response events and user attribute changes
      // Superwall sets attributes when user selects industry/goal options
      if (eventName === 'surveyResponse' || 
          eventName === 'survey_response' ||
          eventName === 'userAttributes') {
        try {
          const surveyData = parseSuperWallSurveyData(eventInfo.params || {});
          await storePendingSurveyData(surveyData);
          console.log('[Superwall] Captured survey data:', surveyData);
        } catch (error) {
          console.error('[Superwall] Error storing survey data:', error);
        }
      }
    },
  });

  // Check if user has already completed onboarding (for returning users)
  useEffect(() => {
    if (!splashComplete || onboardingChecked) return;

    const checkOnboarding = async () => {
      const completed = await hasCompletedOnboarding(user?.id);
      setOnboardingChecked(true);
      setOnboardingComplete(completed);
      
      if (completed) {
        console.log('[Onboarding] User already completed onboarding (verified from Supabase)');
        onOnboardingComplete();
      } else {
        console.log('[Onboarding] User needs onboarding');
        // app_install will trigger automatically on first install
        // For returning users who didn't sign up, we'll manually trigger below
      }
    };

    checkOnboarding();
  }, [splashComplete, onboardingChecked, user?.id, onOnboardingComplete]);

  // Manually trigger onboarding for returning users who didn't complete sign-up
  // app_install placement only fires once, so we need to manually present for:
  // - Users who closed the app before signing up
  // - Users who reinstalled and don't have data in Supabase
  useEffect(() => {
    if (!splashComplete || !onboardingChecked || onboardingComplete) return;
    if (hasTriggeredManualPaywall.current) return;

    const triggerOnboardingIfNeeded = async () => {
      // Double-check we're not authenticated and haven't completed
      if (isAuthenticated) return;
      
      const hasSurveyData = await hasPendingSurveyData();
      
      if (!hasSurveyData) {
        console.log('[Onboarding] No survey data found, manually triggering onboarding paywall');
        hasTriggeredManualPaywall.current = true;
        
        // Manually present the onboarding paywall using registerPlacement
        // This handles the case where app_install already fired but user didn't sign up
        try {
          await registerPlacement({ placement: 'app_install' });
        } catch (error) {
          console.error('[Onboarding] Error presenting paywall:', error);
          // If paywall fails, still redirect to auth
          if (!hasNavigatedToAuth.current) {
            hasNavigatedToAuth.current = true;
            router.replace('/auth/onboarding-auth');
          }
        }
      } else {
        // Has survey data but not authenticated - go directly to auth
        console.log('[Onboarding] Survey data exists, redirecting to auth');
        if (!hasNavigatedToAuth.current) {
          hasNavigatedToAuth.current = true;
          router.replace('/auth/onboarding-auth');
        }
      }
    };

    // Small delay to let app_install trigger first if it's going to
    const timeoutId = setTimeout(triggerOnboardingIfNeeded, 1000);
    return () => clearTimeout(timeoutId);
  }, [splashComplete, onboardingChecked, onboardingComplete, isAuthenticated, registerPlacement, router]);

  return null; // This is a logic-only component
}

/**
 * Inner layout component that has access to auth context
 */
function RootLayoutInner() {
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [splashComplete, setSplashComplete] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Force update check - runs after splash completes
  const {
    isUpdateRequired,
    updateMessage,
    storeUrl,
    currentVersion,
    minimumVersion,
    hasChecked: forceUpdateChecked,
  } = useForceUpdate(splashComplete);

  const handleSplashAnimationEnd = useCallback(() => {
    setShowAnimatedSplash(false);
    setSplashComplete(true);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingComplete(true);
  }, []);

  // If force update is required, block the entire app
  if (forceUpdateChecked && isUpdateRequired) {
    return (
      <ForceUpdateScreen
        message={updateMessage}
        storeUrl={storeUrl}
        currentVersion={currentVersion}
        minimumVersion={minimumVersion}
      />
    );
  }

  return (
    <AppProvider>
      <RootLayoutNav />
      {showAnimatedSplash && (
        <AnimatedSplash onAnimationEnd={handleSplashAnimationEnd} />
      )}
      {/* Onboarding flow handler - runs after splash and force update check */}
      {!onboardingComplete && forceUpdateChecked && (
        <OnboardingFlowHandler 
          splashComplete={splashComplete}
          onOnboardingComplete={handleOnboardingComplete}
        />
      )}
    </AppProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Hide the native splash screen immediately to show our animated one
    SplashScreen.hideAsync();
    
    // Initialize Facebook SDK for Meta Ads attribution (iOS only)
    if (Platform.OS === 'ios') {
      initializeFacebookSDK().catch(console.error);
    }
  }, []);

  return (
    <SuperwallProvider apiKeys={SUPERWALL_API_KEYS}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <RootLayoutInner />
          </AuthProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SuperwallProvider>
  );
}
