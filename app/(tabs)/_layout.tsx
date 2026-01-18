import { Tabs, useRouter } from "expo-router";
import { Plus, FolderOpen, Settings } from "lucide-react-native";
import React, { useEffect, useState, useMemo } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import Colors from "@/constants/colors";
import { useAuthContext } from "@/contexts/AuthContext";
import { hasCompletedOnboarding } from "@/services/onboardingService";
import { useResponsive } from "@/hooks/useResponsive";

export default function TabLayout() {
  const { isAuthenticated, isLoading, user } = useAuthContext();
  const router = useRouter();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  
  // Responsive configuration for iPad/iPhone
  const responsive = useResponsive();

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

  // Dynamic tab bar styles for responsive design
  const dynamicTabStyles = useMemo(() => ({
    tabBar: {
      height: responsive.tabBarHeight,
      paddingTop: responsive.isTablet ? 12 : 8,
      paddingBottom: responsive.isTablet ? 8 : 4,
    },
    tabLabel: {
      fontSize: responsive.isTablet ? 12 : 11,
    },
  }), [responsive]);

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
        tabBarStyle: [styles.tabBar, dynamicTabStyles.tabBar],
        tabBarLabelStyle: [styles.tabLabel, dynamicTabStyles.tabLabel],
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Create",
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.createIcon,
              focused && styles.createIconActive,
              responsive.isTablet && styles.createIconTablet,
            ]}>
              <Plus 
                color={focused ? Colors.light.surface : color} 
                size={responsive.tabIconSize} 
                strokeWidth={2.5} 
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Projects",
          tabBarIcon: ({ color }) => (
            <FolderOpen color={color} size={responsive.tabIconSize} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Settings color={color} size={responsive.tabIconSize} />
          ),
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
  },
  tabLabel: {
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
  createIconTablet: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  createIconActive: {
    backgroundColor: Colors.light.accent,
  },
});
