import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { 
  Crown, 
  Check, 
  ChevronLeft,
  ExternalLink,
  Repeat,
  AlertCircle,
  HelpCircle,
  Gift,
  Sparkles,
  Download,
  Share2,
  Wand2,
} from "lucide-react-native";
import Constants from 'expo-constants';
import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import { useSuperwallEvents, usePlacement } from "expo-superwall";
import Colors from "@/constants/colors";
import { useTieredSubscription } from "@/hooks/usePremiumStatus";
import { useResponsive } from "@/hooks/useResponsive";
import type { SubscriptionTier } from "@/types";

/**
 * Detect if running in development/sandbox mode
 */
const isDevelopmentMode = (): boolean => {
  return __DEV__ || Constants.appOwnership === 'expo';
};

/**
 * Get tier display info
 */
const getTierInfo = (tier: SubscriptionTier, source: string) => {
  switch (tier) {
    case 'studio':
      return {
        name: source === 'complimentary' ? 'Complimentary Studio' : 'Studio',
        icon: Sparkles,
        color: '#9333EA', // Purple
        features: [
          { icon: Download, text: 'Unlimited downloads' },
          { icon: Share2, text: 'Share to all platforms' },
          { icon: Wand2, text: 'All AI features' },
          { icon: Check, text: 'No watermarks' },
          { icon: Check, text: 'Priority support' },
        ],
      };
    case 'pro':
      return {
        name: source === 'complimentary' ? 'Complimentary Pro' : 'Pro',
        icon: Crown,
        color: Colors.light.accent,
        features: [
          { icon: Download, text: 'Unlimited downloads' },
          { icon: Share2, text: 'Share to all platforms' },
          { icon: Check, text: 'No watermarks' },
          { icon: Check, text: 'Priority support' },
        ],
      };
    default:
      return {
        name: 'Free',
        icon: null,
        color: Colors.light.textSecondary,
        features: [
          { icon: Check, text: 'Browse all templates' },
          { icon: Check, text: 'Capture & edit photos' },
          { icon: Check, text: 'Preview results' },
        ],
      };
  }
};

/**
 * Membership Management Screen
 * 
 * Dedicated screen for viewing and managing subscription tiers:
 * - Free: Basic features
 * - Pro: Download + Share
 * - Studio: Pro + AI features
 * 
 * Supports both Superwall (paid) and complimentary (admin-granted) tiers.
 */
export default function MembershipScreen() {
  const router = useRouter();
  const responsive = useResponsive();
  
  // Tiered subscription from Superwall + Supabase
  const { 
    tier,
    isLoading: isSubscriptionLoading,
    source,
    currentPlan,
    canDownload,
    canUseAIStudio,
    requestProAccess,
    requestStudioAccess,
  } = useTieredSubscription();
  
  // Placement hook for manage plan
  const { registerPlacement, state: paywallState } = usePlacement({
    onDismiss: (info, result) => {
      console.log('[Membership] Paywall dismissed:', result);
      if (result.type === 'purchased') {
        // Refresh will happen automatically via Superwall
        Alert.alert('Success!', 'Your subscription has been updated.');
      }
    },
    onError: (error) => {
      console.error('[Membership] Paywall error:', error);
    },
  });

  // Listen for custom paywall actions (like "downgrade_to_free" from Superwall)
  useSuperwallEvents({
    onCustomAction: (name) => {
      console.log('[Membership] Custom paywall action:', name);
      if (name === 'downgrade_to_free') {
        handleDowngradeConfirmation();
      }
    },
  });

  // Handle Upgrade to Pro
  const handleUpgradeToPro = async () => {
    await requestProAccess(() => {
      console.log('[Membership] Pro access granted');
    }, 'membership_upgrade');
  };

  // Handle Upgrade to Studio
  const handleUpgradeToStudio = async () => {
    await requestStudioAccess(() => {
      console.log('[Membership] Studio access granted');
    }, 'membership_upgrade');
  };

  // Handle Manage Plan - opens Superwall paywall for existing subscribers
  const handleManagePlan = async () => {
    console.log('[Membership] Opening membership_manage paywall');
    
    try {
      await registerPlacement({
        placement: 'membership_manage',
        params: {
          current_tier: tier,
          current_plan: currentPlan || 'unknown',
        },
      });
    } catch (error) {
      console.error('[Membership] Error opening paywall:', error);
    }
  };

  // Show downgrade confirmation dialog
  const handleDowngradeConfirmation = () => {
    Alert.alert(
      'Downgrade Plan?',
      tier === 'studio' 
        ? 'You will lose access to:\n\n• AI features (Auto Quality, Background Replace, etc.)\n\nYour current features will remain active until your billing period ends.'
        : 'You will lose access to:\n\n• Unlimited downloads\n• Sharing features\n\nYour current features will remain active until your billing period ends.',
      [
        { 
          text: 'Keep Current', 
          style: 'cancel',
        },
        {
          text: 'Downgrade',
          style: 'destructive',
          onPress: openCancellationSettings,
        },
      ]
    );
  };

  // Open App Store subscription settings for cancellation
  const openCancellationSettings = async () => {
    const iosSettingsUrl = 'itms-apps://apps.apple.com/account/subscriptions';
    
    try {
      await Linking.openURL(iosSettingsUrl);
      
      setTimeout(() => {
        Alert.alert(
          'Complete in App Store',
          'To finish:\n\n1. Find "Resulta" in your subscriptions\n2. Make your desired changes\n\nYour features will remain active until your billing period ends.',
          [{ text: 'Got it' }]
        );
      }, 1000);
    } catch (error) {
      Alert.alert(
        'Open Settings Manually',
        'Go to:\n\nSettings → [Your Name] → Subscriptions → Resulta',
        [
          { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
          { text: 'OK', style: 'cancel' },
        ]
      );
    }
  };

  // Handle direct cancel button
  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription?',
      'Are you sure you want to cancel your subscription?\n\nYour features will remain active until your current billing period ends.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: openCancellationSettings,
        },
      ]
    );
  };

  // Show help for sandbox/development mode
  const handleSandboxHelp = () => {
    Alert.alert(
      'Development Mode',
      'You\'re running in development/sandbox mode.\n\n' +
      '📱 Sandbox Limitations:\n' +
      '• Subscriptions auto-renew quickly (monthly = 5 min)\n' +
      '• They expire after ~6 renewals\n' +
      '• "Cancel Subscription" may not show sandbox purchases\n\n' +
      '🔧 To test without subscription:\n' +
      '1. Go to Settings > App Store\n' +
      '2. Sign out of your Apple ID\n' +
      '3. Sign in with a different sandbox account\n\n' +
      '💡 Production builds don\'t have these limitations.',
      [{ text: 'Got it' }]
    );
  };

  // Get tier display info
  const tierInfo = getTierInfo(tier, source);
  const isComplimentary = source === 'complimentary';
  const isPaid = source === 'superwall';

  // Dynamic styles for responsive layout
  const dynamicStyles = useMemo(() => ({
    header: {
      paddingHorizontal: responsive.gridPadding,
    },
    scrollContent: {
      paddingHorizontal: responsive.gridPadding,
      alignItems: responsive.isTablet ? 'center' as const : undefined,
    },
    contentContainer: {
      width: '100%' as const,
      maxWidth: responsive.maxContentWidth,
    },
  }), [responsive]);

  // Loading state
  if (isSubscriptionLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, dynamicStyles.header]}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Membership</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, dynamicStyles.header]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Membership</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, dynamicStyles.scrollContent]}
        showsVerticalScrollIndicator={false}
      >
        <View style={dynamicStyles.contentContainer}>
          {/* Current Plan Card */}
          <View style={[styles.card, { borderColor: tierInfo.color, borderWidth: tier !== 'free' ? 2 : 0 }]}>
            <Text style={styles.cardLabel}>Current Plan</Text>
            <View style={styles.planInfo}>
              <View style={styles.planHeader}>
                {tierInfo.icon && (
                  <tierInfo.icon size={24} color={tierInfo.color} />
                )}
                <Text style={[styles.planName, { color: tier === 'free' ? Colors.light.text : tierInfo.color }]}>
                  {tierInfo.name}
                </Text>
                {isComplimentary && (
                  <View style={styles.complimentaryBadge}>
                    <Gift size={12} color={Colors.light.accent} />
                    <Text style={styles.complimentaryBadgeText}>Complimentary</Text>
                  </View>
                )}
              </View>
              {isPaid && currentPlan && (
                <Text style={styles.planDescription}>
                  {currentPlan.includes('weekly') 
                    ? 'Billed weekly • Auto-renews'
                    : currentPlan.includes('monthly')
                    ? 'Billed monthly • Auto-renews'
                    : currentPlan.includes('yearly')
                    ? 'Billed yearly • Auto-renews'
                    : 'Auto-renews • Managed via App Store'}
                </Text>
              )}
            </View>
          </View>

          {/* What's Included */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WHAT'S INCLUDED</Text>
            <View style={styles.featuresList}>
              {tierInfo.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <feature.icon size={18} color={Colors.light.success} />
                  <Text style={styles.featureText}>{feature.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Upgrade Options - Only for Free or Pro users (not complimentary) */}
          {tier === 'free' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>UPGRADE</Text>
              
              {/* Upgrade to Pro */}
              <TouchableOpacity 
                style={[styles.upgradeCard, { borderColor: Colors.light.accent }]}
                onPress={handleUpgradeToPro}
                activeOpacity={0.8}
              >
                <View style={styles.upgradeCardHeader}>
                  <Crown size={24} color={Colors.light.accent} />
                  <Text style={[styles.upgradeCardTitle, { color: Colors.light.accent }]}>Pro</Text>
                </View>
                <Text style={styles.upgradeCardDescription}>
                  Download & share your content
                </Text>
                <View style={styles.upgradeCardFeatures}>
                  <Text style={styles.upgradeCardFeature}>• Unlimited downloads</Text>
                  <Text style={styles.upgradeCardFeature}>• Share to social media</Text>
                </View>
              </TouchableOpacity>

              {/* Upgrade to Studio */}
              <TouchableOpacity 
                style={[styles.upgradeCard, { borderColor: '#9333EA' }]}
                onPress={handleUpgradeToStudio}
                activeOpacity={0.8}
              >
                <View style={styles.upgradeCardHeader}>
                  <Sparkles size={24} color="#9333EA" />
                  <Text style={[styles.upgradeCardTitle, { color: '#9333EA' }]}>Studio</Text>
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>POPULAR</Text>
                  </View>
                </View>
                <Text style={styles.upgradeCardDescription}>
                  Everything in Pro + AI features
                </Text>
                <View style={styles.upgradeCardFeatures}>
                  <Text style={styles.upgradeCardFeature}>• All Pro features</Text>
                  <Text style={styles.upgradeCardFeature}>• AI Auto Quality</Text>
                  <Text style={styles.upgradeCardFeature}>• AI Background Replace</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Upgrade to Studio - For Pro users */}
          {tier === 'pro' && !isComplimentary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>UPGRADE</Text>
              
              <TouchableOpacity 
                style={[styles.upgradeCard, { borderColor: '#9333EA' }]}
                onPress={handleUpgradeToStudio}
                activeOpacity={0.8}
              >
                <View style={styles.upgradeCardHeader}>
                  <Sparkles size={24} color="#9333EA" />
                  <Text style={[styles.upgradeCardTitle, { color: '#9333EA' }]}>Upgrade to Studio</Text>
                </View>
                <Text style={styles.upgradeCardDescription}>
                  Unlock all AI features
                </Text>
                <View style={styles.upgradeCardFeatures}>
                  <Text style={styles.upgradeCardFeature}>• AI Auto Quality enhancement</Text>
                  <Text style={styles.upgradeCardFeature}>• AI Background Replace</Text>
                  <Text style={styles.upgradeCardFeature}>• AI Background Remove</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Management Options - Only for App Store subscriptions */}
          {isPaid && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MANAGE</Text>
              
              {/* Change Plan Button */}
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleManagePlan}
                disabled={paywallState === 'presenting'}
                activeOpacity={0.8}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: 'rgba(201, 168, 124, 0.15)' }]}>
                    <Repeat size={20} color={Colors.light.accent} />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionButtonTitle}>Change Plan</Text>
                    <Text style={styles.actionButtonSubtitle}>View available plans</Text>
                  </View>
                </View>
                {paywallState === 'presenting' ? (
                  <ActivityIndicator size="small" color={Colors.light.accent} />
                ) : (
                  <ChevronLeft size={20} color={Colors.light.textTertiary} style={{ transform: [{ rotate: '180deg' }] }} />
                )}
              </TouchableOpacity>

              {/* Cancel Subscription Button */}
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleCancelSubscription}
                activeOpacity={0.8}
              >
                <View style={styles.actionButtonContent}>
                  <View style={[styles.actionIcon, { backgroundColor: Colors.light.surfaceSecondary }]}>
                    <ExternalLink size={20} color={Colors.light.textSecondary} />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionButtonTitle}>Cancel Subscription</Text>
                    <Text style={styles.actionButtonSubtitle}>Manage in App Store</Text>
                  </View>
                </View>
                <ChevronLeft size={20} color={Colors.light.textTertiary} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            </View>
          )}

          {/* Complimentary Info */}
          {isComplimentary && (
            <View style={styles.complimentaryInfo}>
              <Gift size={20} color={Colors.light.accent} />
              <Text style={styles.complimentaryInfoText}>
                Your {tier === 'studio' ? 'Studio' : 'Pro'} access was granted by an administrator and doesn't require a subscription. Contact support if you have any questions.
              </Text>
            </View>
          )}

          {/* Sandbox Warning - Development mode only */}
          {isDevelopmentMode() && isPaid && (
            <TouchableOpacity 
              style={styles.sandboxWarning}
              onPress={handleSandboxHelp}
              activeOpacity={0.7}
            >
              <AlertCircle size={16} color="#F57C00" />
              <Text style={styles.sandboxWarningText}>
                Development Mode - Tap for sandbox testing info
              </Text>
              <HelpCircle size={16} color={Colors.light.textTertiary} />
            </TouchableOpacity>
          )}

          {/* Bottom spacing */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Card
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  planInfo: {
    gap: 8,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  planName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  planDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  complimentaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(201, 168, 124, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  complimentaryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.accent,
    textTransform: 'uppercase',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Features List
  featuresList: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: Colors.light.text,
  },

  // Upgrade Cards
  upgradeCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
  },
  upgradeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  upgradeCardTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  upgradeCardDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  upgradeCardFeatures: {
    gap: 4,
  },
  upgradeCardFeature: {
    fontSize: 13,
    color: Colors.light.text,
  },
  popularBadge: {
    backgroundColor: '#9333EA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Action Buttons
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },

  // Complimentary Info
  complimentaryInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(201, 168, 124, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  complimentaryInfoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },

  // Sandbox Warning
  sandboxWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  sandboxWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#F57C00',
  },
});
