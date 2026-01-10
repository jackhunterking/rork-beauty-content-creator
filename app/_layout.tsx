import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SuperwallProvider } from "expo-superwall";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AnimatedSplash from "@/components/AnimatedSplash";

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
    </Stack>
  );
}

export default function RootLayout() {
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  useEffect(() => {
    // Hide the native splash screen immediately to show our animated one
    SplashScreen.hideAsync();
  }, []);

  const handleSplashAnimationEnd = useCallback(() => {
    setShowAnimatedSplash(false);
  }, []);

  return (
    <SuperwallProvider apiKeys={SUPERWALL_API_KEYS}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <AppProvider>
              <RootLayoutNav />
              {showAnimatedSplash && (
                <AnimatedSplash onAnimationEnd={handleSplashAnimationEnd} />
              )}
            </AppProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SuperwallProvider>
  );
}
