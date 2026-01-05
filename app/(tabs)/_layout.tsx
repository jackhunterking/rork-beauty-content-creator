import { Tabs } from "expo-router";
import { Plus, Star, FolderOpen, Settings } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import Colors from "@/constants/colors";

export default function TabLayout() {
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
        name="favourites"
        options={{
          title: "Favourites",
          tabBarIcon: ({ color }) => <Star color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
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
