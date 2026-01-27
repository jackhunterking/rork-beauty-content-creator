// Resolve the API key - prioritize EXPO_PUBLIC_ prefix (Expo standard)
const templatedApiKey = process.env.EXPO_PUBLIC_TEMPLATED_API_KEY || process.env.TEMPLATED_API_KEY || "";

// Superwall API keys - get these from your Superwall dashboard (Settings → Keys)
const superwallIosKey = process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY || "";
const superwallAndroidKey = process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_KEY || "";

// PostHog API keys - get these from your PostHog dashboard (Project Settings → Project API Key)
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || "";
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// Note: FAL_API_KEY is now server-side only (in Supabase Edge Functions)
// No client-side API key needed for AI features

export default {
  expo: {
    name: "Resulta",
    slug: "resulta",
    version: "2.0",
    orientation: "portrait",
    icon: "./assets/images/resultalogo.png",
    scheme: "resulta",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/resultalogo.png",
      resizeMode: "contain",
      backgroundColor: "#C9A87C",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.resulta",
      buildNumber: "1",
      usesAppleSignIn: true,
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Allow $(PRODUCT_NAME) to access your photos",
        NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access your camera",
        NSMicrophoneUsageDescription: "Allow $(PRODUCT_NAME) to access your microphone",
        // App Tracking Transparency (ATT) - Required by Apple for iOS 14.5+
        NSUserTrackingUsageDescription: "This identifier will be used to deliver personalized ads to you and helps us understand how our ads perform.",
        // Facebook SDK Configuration
        // NOTE: Updated to new Facebook App (without Meta Login)
        FacebookAppID: "2066856954071896",
        FacebookClientToken: "e2fb3be264e725ef4281a199ed3dcc1f",
        FacebookDisplayName: "Resulta",
        LSApplicationQueriesSchemes: ["fbapi", "fb-messenger-share-api", "fbauth2", "fbshareextension"],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/resultalogo.png",
        backgroundColor: "#C9A87C",
      },
      package: "app.resulta.android",
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "android.permission.VIBRATE",
        "RECORD_AUDIO",
        "INTERNET",
      ],
    },
    web: {
      favicon: "./assets/images/resultalogo.png",
    },
    plugins: [
      [
        "expo-router",
        {
          origin: "https://resulta.app/",
        },
      ],
      "expo-font",
      "expo-web-browser",
      "expo-apple-authentication",
      [
        "react-native-fbsdk-next",
        {
          // NOTE: Updated to new Facebook App (without Meta Login)
          appID: "2066856954071896",
          clientToken: "e2fb3be264e725ef4281a199ed3dcc1f",
          displayName: "Resulta",
          autoInitEnabled: false, // Disabled - we initialize manually after ATT prompt
          autoLogAppEventsEnabled: true,
          advertiserIdCollectionEnabled: false, // Disabled by default - enabled programmatically based on ATT status
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "The app accesses your photos to let you share them with your friends.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow $(PRODUCT_NAME) to access your camera",
          microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone",
          recordAudioAndroid: true,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 21,
          },
          ios: {
            deploymentTarget: "15.1",
          },
        },
      ],
      [
        "expo-tracking-transparency",
        {
          userTrackingPermission: "This identifier will be used to deliver personalized ads to you and helps us understand how our ads perform.",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    // Environment variables injected at build time
    extra: {
      templatedApiKey: templatedApiKey,
      superwallIosKey: superwallIosKey,
      superwallAndroidKey: superwallAndroidKey,
      posthogApiKey: posthogApiKey,
      posthogHost: posthogHost,
    },
  },
};
