// Resolve the API key - prioritize EXPO_PUBLIC_ prefix (Expo standard)
const templatedApiKey = process.env.EXPO_PUBLIC_TEMPLATED_API_KEY || process.env.TEMPLATED_API_KEY || "";

// Superwall API keys - get these from your Superwall dashboard (Settings → Keys)
const superwallIosKey = process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY || "";
const superwallAndroidKey = process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_KEY || "";

// PostHog API keys - get these from your PostHog dashboard (Project Settings → Project API Key)
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || "";
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export default {
  expo: {
    name: "Resulta",
    slug: "resulta",
    version: "1.6",
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
      buildNumber: "21",
      usesAppleSignIn: true,
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Allow $(PRODUCT_NAME) to access your photos",
        NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access your camera",
        NSMicrophoneUsageDescription: "Allow $(PRODUCT_NAME) to access your microphone",
        // Facebook SDK Configuration
        FacebookAppID: "664828860049907",
        FacebookClientToken: "ef9324eb6436b29a84d6009d346c8b6e",
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
          appID: "664828860049907",
          clientToken: "ef9324eb6436b29a84d6009d346c8b6e",
          displayName: "Resulta",
          scheme: "fb664828860049907",
          autoInitEnabled: true,
          autoLogAppEventsEnabled: true,
          advertiserIdCollectionEnabled: true,
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
