import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast, { ToastConfig } from 'react-native-toast-message';
import { CheckCircle, AlertCircle, Info } from 'lucide-react-native';
import { AppProvider } from "@/contexts/AppContext";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

// Custom toast configuration to match app design
const toastConfig: ToastConfig = {
  success: (props) => (
    <View style={toastStyles.container}>
      <View style={[toastStyles.iconContainer, toastStyles.successIcon]}>
        <CheckCircle size={18} color={Colors.light.success} />
      </View>
      <View style={toastStyles.textContainer}>
        <Text style={toastStyles.title} numberOfLines={1}>
          {props.text1}
        </Text>
        {props.text2 && (
          <Text style={toastStyles.message} numberOfLines={2}>
            {props.text2}
          </Text>
        )}
      </View>
    </View>
  ),
  error: (props) => (
    <View style={toastStyles.container}>
      <View style={[toastStyles.iconContainer, toastStyles.errorIcon]}>
        <AlertCircle size={18} color={Colors.light.error} />
      </View>
      <View style={toastStyles.textContainer}>
        <Text style={toastStyles.title} numberOfLines={1}>
          {props.text1}
        </Text>
        {props.text2 && (
          <Text style={toastStyles.message} numberOfLines={2}>
            {props.text2}
          </Text>
        )}
      </View>
    </View>
  ),
  info: (props) => (
    <View style={toastStyles.container}>
      <View style={[toastStyles.iconContainer, toastStyles.infoIcon]}>
        <Info size={18} color={Colors.light.accent} />
      </View>
      <View style={toastStyles.textContainer}>
        <Text style={toastStyles.title} numberOfLines={1}>
          {props.text1}
        </Text>
        {props.text2 && (
          <Text style={toastStyles.message} numberOfLines={2}>
            {props.text2}
          </Text>
        )}
      </View>
    </View>
  ),
};

const toastStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    maxWidth: 380,
    backgroundColor: Colors.light.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: Colors.light.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  successIcon: {
    backgroundColor: 'rgba(90, 171, 97, 0.12)',
  },
  errorIcon: {
    backgroundColor: 'rgba(214, 69, 69, 0.12)',
  },
  infoIcon: {
    backgroundColor: 'rgba(201, 168, 124, 0.15)',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
});

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="editor" 
        options={{ 
          headerShown: true,
          title: 'Editor',
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="drafts" 
        options={{ 
          headerShown: false,
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
          <Toast 
            config={toastConfig}
            topOffset={100}
            visibilityTime={3000}
          />
        </AppProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
