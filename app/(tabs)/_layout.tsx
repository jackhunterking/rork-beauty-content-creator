import { Tabs, useRouter } from "expo-router";
import { Plus, FolderOpen, Settings } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import Colors from "@/constants/colors";
import { useAuthContext } from "@/contexts/AuthContext";
import { hasCompletedOnboarding } from "@/services/onboardingService";

export default function TabLayout() {
  const { isAuthenticated, isLoading, user } = useAuthContext();
  const router = useRouter();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  // Check if onboarding is complete
  useEffect(() => {
    hasCompletedOnboarding(user?.id).then(setOnboardingDone);
  }, [user?.id]);

  // Redirect to auth screen if not authenticated and onboarding not complete
  useEffect(() => {
    // Wait until we have all the info we need
    if (isLoading || onboardingDone === null) return;
    
    // If user hasn't completed onboarding and isn't authenticated, redirect to auth
    if (!isAuthenticated && !onboardingDone) {
      router.replace('/auth/onboarding-auth');
    }
  }, [isLoading, isAuthenticated, onboardingDone, router]);

  // Show loading state while checking auth status
  // This blocks access to tabs until we confirm authentication
  if (isLoading || onboardingDone === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
      </View>
    );
  }

  // Block access if not authenticated and onboarding not complete
  if (!isAuthenticated && !onboardingDone) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.accent,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Create",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.createIcon, focused && styles.createIconActive]}>
              <Plus color={focused ? Colors.light.surface : color} size={22} strokeWidth={2.5} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Portfolio",
          tabBarIcon: ({ color }) => <FolderOpen color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  tabBar: {
    backgroundColor: Colors.light.surface,
    borderTopColor: Colors.light.borderLight,
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 4,
    height: 88,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 4,
    marginBottom: 2,
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createIconActive: {
    backgroundColor: Colors.light.accent,
  },
});
