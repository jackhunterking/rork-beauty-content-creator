import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Linking,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

/**
 * Force Update Screen
 * 
 * Full-screen blocking modal that prevents users from using the app
 * until they update to the minimum required version.
 * 
 * Features:
 * - No way to dismiss (full block)
 * - Clean, branded design matching app aesthetics
 * - "Update Now" button opens appropriate app store
 * - Shows current vs required version for transparency
 */

interface ForceUpdateScreenProps {
  /** Message to display to the user */
  message: string;
  /** URL to the app store */
  storeUrl: string | null;
  /** Current app version */
  currentVersion: string;
  /** Minimum required version */
  minimumVersion: string;
}

export default function ForceUpdateScreen({
  message,
  storeUrl,
  currentVersion,
  minimumVersion,
}: ForceUpdateScreenProps) {
  const colors = Colors.light;

  const handleUpdatePress = async () => {
    if (!storeUrl) {
      // Fallback to generic store if URL not configured
      const fallbackUrl = Platform.OS === 'ios'
        ? 'https://apps.apple.com'
        : 'https://play.google.com/store';
      
      try {
        await Linking.openURL(fallbackUrl);
      } catch (error) {
        console.error('[ForceUpdate] Could not open store:', error);
      }
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(storeUrl);
      if (canOpen) {
        await Linking.openURL(storeUrl);
      } else {
        console.error('[ForceUpdate] Cannot open URL:', storeUrl);
      }
    } catch (error) {
      console.error('[ForceUpdate] Error opening store:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      {/* Subtle gradient background */}
      <LinearGradient
        colors={['#FEFCF9', '#F7F4F0', '#F0EDE9']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* App Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/resultalogo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Update Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons
                name="cloud-download-outline"
                size={48}
                color={colors.accent}
              />
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            Update Required
          </Text>

          {/* Message */}
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message || 'A new version of the app is available. Please update to continue using Resulta.'}
          </Text>

          {/* Version Info */}
          <View style={[styles.versionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.versionRow}>
              <Text style={[styles.versionLabel, { color: colors.textTertiary }]}>
                Your Version
              </Text>
              <Text style={[styles.versionValue, { color: colors.textSecondary }]}>
                {currentVersion}
              </Text>
            </View>
            <View style={[styles.versionDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.versionRow}>
              <Text style={[styles.versionLabel, { color: colors.textTertiary }]}>
                Required Version
              </Text>
              <Text style={[styles.versionValue, { color: colors.accent }]}>
                {minimumVersion}
              </Text>
            </View>
          </View>

          {/* Update Button */}
          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: colors.accent }]}
            onPress={handleUpdatePress}
            activeOpacity={0.8}
          >
            <Ionicons
              name={Platform.OS === 'ios' ? 'logo-apple-appstore' : 'logo-google-playstore'}
              size={22}
              color="#FFFFFF"
              style={styles.buttonIcon}
            />
            <Text style={styles.updateButtonText}>
              Update Now
            </Text>
          </TouchableOpacity>

          {/* Store hint */}
          <Text style={[styles.storeHint, { color: colors.textTertiary }]}>
            {Platform.OS === 'ios' 
              ? 'You will be redirected to the App Store'
              : 'You will be redirected to Google Play Store'
            }
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(201, 168, 124, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 320,
  },
  versionCard: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 32,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  versionDivider: {
    height: 1,
    marginVertical: 4,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    minWidth: 200,
    shadowColor: '#C9A87C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonIcon: {
    marginRight: 10,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  storeHint: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
});
