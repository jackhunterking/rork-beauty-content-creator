import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SuperwallProvider, useSuperwallEvents, usePlacement } from "expo-superwall";
import { PostHogProvider } from "posthog-react-native";
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
import { 
  initializePostHog,
  forwardSuperwallEvent,
  captureEvent,
  POSTHOG_EVENTS,
} from "@/services/posthogService";
import { useScreenTracking } from "@/hooks/useScreenTracking";
// Note: In-app purchase tracking is handled automatically by Facebook SDK
// Enable "Log In-App Purchases Automatically" in Facebook Developer Dashboard

// Superwall API keys - replace with your actual keys from Superwall dashboard
const SUPERWALL_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY || "",
  android: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_KEY || "",
};

// PostHog configuration - get from PostHog dashboard (Project Settings → Project API Key)
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || "";
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

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
      // Forward to PostHog for unified analytics
      captureEvent(POSTHOG_EVENTS.PAYWALL_PRESENTED, {
        paywall_name: info.name,
        paywall_identifier: info.identifier,
        source: 'superwall',
      });
    },
    
    // Called when paywall is dismissed - for logging/analytics only
    // DO NOT navigate here - this fires for ALL paywalls (feature-gating + onboarding)
    // Navigation for onboarding is handled by usePlacement.onDismiss above
    onPaywallDismiss: (info, result) => {
      console.log('[Superwall] Paywall dismissed:', info.name, 'Result:', result);
      // Forward to PostHog for unified analytics
      captureEvent(POSTHOG_EVENTS.PAYWALL_DISMISSED, {
        paywall_name: info.name,
        paywall_identifier: info.identifier,
        result_type: result?.type || 'unknown',
        source: 'superwall',
      });
    },
    
    // Called when paywall is skipped (user already completed onboarding or has subscription)
    onPaywallSkip: (reason) => {
      console.log('[Superwall] Paywall skipped:', reason);
      // Forward to PostHog for unified analytics
      captureEvent(POSTHOG_EVENTS.PAYWALL_SKIPPED, {
        skip_reason: reason,
        source: 'superwall',
      });
      // Mark as complete since Superwall determined they don't need to see it
      setOnboardingComplete(true);
      onOnboardingComplete();
    },
    
    // Called on error - for logging only
    // DO NOT navigate here - this fires for ALL paywalls
    onPaywallError: (error) => {
      console.error('[Superwall] Paywall error:', error);
      // Forward to PostHog for unified analytics
      captureEvent(POSTHOG_EVENTS.PAYWALL_ERROR, {
        error: String(error),
        source: 'superwall',
      });
    },
    
    // Capture all Superwall events including survey responses - for analytics
    onSuperwallEvent: async (eventInfo) => {
      const eventName = eventInfo.event?.event || eventInfo.event;
      console.log('[Superwall] Event:', eventName);
      
      // Forward ALL Superwall events to PostHog for comprehensive tracking
      // This includes transaction events, subscription events, etc.
      forwardSuperwallEvent(String(eventName), eventInfo.params || {});
      
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

  // Track screen views for PostHog analytics
  useScreenTracking({
    enabled: splashComplete, // Only track after splash is complete
  });

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
  const [posthogReady, setPosthogReady] = useState(false);

  useEffect(() => {
    // #region agent log - Hypothesis C: RootLayout mount
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'_layout.tsx:RootLayout:mount',message:'RootLayout useEffect running',data:{hasApiKey:!!POSTHOG_API_KEY,apiKeyLength:POSTHOG_API_KEY?.length,host:POSTHOG_HOST},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // Hide the native splash screen immediately to show our animated one
    SplashScreen.hideAsync();
    
    // Initialize PostHog analytics (before other SDKs)
    // PostHog should be initialized first to capture all events
    const initAnalytics = async () => {
      try {
        if (POSTHOG_API_KEY) {
          // #region agent log - Hypothesis C: Calling initializePostHog
          fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'_layout.tsx:initAnalytics:before',message:'About to call initializePostHog',data:{apiKeyPrefix:POSTHOG_API_KEY?.substring(0,15)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          await initializePostHog(POSTHOG_API_KEY, POSTHOG_HOST);
          // #region agent log - Hypothesis C: initializePostHog completed
          fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'_layout.tsx:initAnalytics:after',message:'initializePostHog completed',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          console.log('[Analytics] PostHog initialized');
        } else {
          // #region agent log - Hypothesis A: No API key in layout
          fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'_layout.tsx:initAnalytics:noKey',message:'NO API KEY in RootLayout',data:{POSTHOG_API_KEY},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          console.warn('[Analytics] PostHog API key not configured');
        }
      } catch (error) {
        // #region agent log - Hypothesis D: Init error in layout
        fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'_layout.tsx:initAnalytics:error',message:'PostHog init error in layout',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.error('[Analytics] Failed to initialize PostHog:', error);
      } finally {
        setPosthogReady(true);
      }
    };

    initAnalytics();
    
    // Initialize Facebook SDK for Meta Ads attribution (iOS only)
    if (Platform.OS === 'ios') {
      initializeFacebookSDK().catch(console.error);
    }
  }, []);

  // PostHog client configuration for the provider
  const posthogClientConfig = {
    host: POSTHOG_HOST,
    // Enable session replay for mobile
    enableSessionReplay: true,
    // Automatically capture app lifecycle events
    captureApplicationLifecycleEvents: true,
    // Automatically capture deep links
    captureDeepLinks: true,
    // Flush events every 30 seconds
    flushInterval: 30,
    // Queue up to 20 events before forcing flush
    flushAt: 20,
    // Session replay configuration
    sessionReplayConfig: {
      // Mask all text inputs for privacy (passwords, emails, etc.)
      maskAllTextInputs: true,
      // Don't mask images - we want to see template/content UI
      maskAllImages: false,
      // Capture network requests for debugging
      captureNetworkTelemetry: true,
      // Debounce screenshots for performance
      androidDebouncerDelayMs: 500,
      iOSdebouncerDelayMs: 500,
    },
    // Enable debug logging in development
    debug: __DEV__,
  };

  // #region agent log - Hypothesis E: PostHogProvider config
  fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'_layout.tsx:RootLayout:render',message:'PostHogProvider about to render',data:{apiKeyProvided:!!POSTHOG_API_KEY,apiKeyLength:POSTHOG_API_KEY?.length,host:POSTHOG_HOST,enableSessionReplay:posthogClientConfig.enableSessionReplay,hasSessionReplayConfig:!!posthogClientConfig.sessionReplayConfig},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

  return (
    <PostHogProvider 
      apiKey={POSTHOG_API_KEY} 
      options={posthogClientConfig}
      autocapture={{
        captureLifecycleEvents: true,
        captureScreens: true,
        captureTouches: true,
      }}
    >
      <SuperwallProvider apiKeys={SUPERWALL_API_KEYS}>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <RootLayoutInner />
            </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </SuperwallProvider>
    </PostHogProvider>
  );
}
