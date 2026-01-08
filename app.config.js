// ============================================
// DEBUG: Log environment variables at config evaluation time
// This runs when Expo loads the config (at build/start time)
// ============================================
console.log('\n========== app.config.js Environment Debug ==========');
console.log('[app.config.js] EXPO_PUBLIC_TEMPLATED_API_KEY:', 
  process.env.EXPO_PUBLIC_TEMPLATED_API_KEY ? `SET (length: ${process.env.EXPO_PUBLIC_TEMPLATED_API_KEY.length})` : 'NOT SET'
);
console.log('[app.config.js] TEMPLATED_API_KEY:', 
  process.env.TEMPLATED_API_KEY ? `SET (length: ${process.env.TEMPLATED_API_KEY.length})` : 'NOT SET'
);
console.log('======================================================\n');

// Resolve the API key - prioritize EXPO_PUBLIC_ prefix (Expo standard)
const templatedApiKey = process.env.EXPO_PUBLIC_TEMPLATED_API_KEY || process.env.TEMPLATED_API_KEY || "";

if (!templatedApiKey) {
  console.warn('[app.config.js] WARNING: No Templated.io API key found in environment variables!');
  console.warn('[app.config.js] Please set EXPO_PUBLIC_TEMPLATED_API_KEY in your .env file');
} else {
  console.log('[app.config.js] Templated API key resolved successfully');
}

export default {
  expo: {
    name: "Beauty Content Creator",
    slug: "beauty-content-creator",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "rork-app",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "app.rork.beauty-content-creator",
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
      package: "app.rork.beauty_content_creator",
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
          origin: "https://rork.com/",
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
    // Prioritizes EXPO_PUBLIC_ prefix (Expo standard)
    extra: {
      templatedApiKey: templatedApiKey,
      // Debug flag to verify config is loaded
      configLoadedAt: new Date().toISOString(),
    },
  },
};
