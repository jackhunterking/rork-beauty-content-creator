import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from 'react-native-toast-message';
import { AppProvider } from "@/contexts/AppContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="capture/before" 
        options={{ 
          headerShown: false,
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="capture/after" 
        options={{ 
          headerShown: false,
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="capture/adjust" 
        options={{ 
          headerShown: false,
          presentation: 'modal',
        }} 
      />
      <Stack.Screen 
        name="generate" 
        options={{ 
          headerShown: false,
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="result" 
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
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <RootLayoutNav />
          <Toast />
        </AppProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
