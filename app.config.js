// Resolve the API key - prioritize EXPO_PUBLIC_ prefix (Expo standard)
const templatedApiKey = process.env.EXPO_PUBLIC_TEMPLATED_API_KEY || process.env.TEMPLATED_API_KEY || "";

export default {
  expo: {
    name: "Resulta",
    slug: "resulta",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "resulta",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "app.resulta.ios",
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Allow $(PRODUCT_NAME) to access your photos",
        NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access your camera",
        NSMicrophoneUsageDescription: "Allow $(PRODUCT_NAME) to access your microphone",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
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
      favicon: "./assets/images/favicon.png",
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
    ],
    experiments: {
      typedRoutes: true,
    },
    // Environment variables injected at build time
    extra: {
      templatedApiKey: templatedApiKey,
    },
  },
};
