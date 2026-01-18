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
} from "lucide-react-native";
import Constants from 'expo-constants';
import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import { useSuperwallEvents } from "expo-superwall";
import Colors from "@/constants/colors";
import { usePremiumStatus, usePremiumFeature } from "@/hooks/usePremiumStatus";
import { useResponsive } from "@/hooks/useResponsive";

/**
 * Detect if running in development/sandbox mode
 */
const isDevelopmentMode = (): boolean => {
  return __DEV__ || Constants.appOwnership === 'expo';
};

/**
 * Membership Management Screen
 * 
 * Dedicated screen for Pro members to:
 * - View their current plan details
 * - Change plan (via Superwall paywall)
 * - Cancel subscription (via App Store)
 * - Restore purchases
 */
export default function MembershipScreen() {
  const router = useRouter();
  const responsive = useResponsive();
  
  // Subscription status from Superwall
  const { 
    isPremium, 
    isLoading: isSubscriptionLoading,
    subscriptionDetails,
    isComplimentaryPro,
  } = usePremiumStatus();
  
  const { requestPremiumAccess, paywallState } = usePremiumFeature();

  // Listen for custom paywall actions (like "downgrade_to_free" from Superwall)
  useSuperwallEvents({
    onCustomAction: (name) => {
      console.log('[Membership] Custom paywall action:', name);
      if (name === 'downgrade_to_free') {
        handleDowngradeConfirmation();
      }
    },
  });

  // Handle Change Plan - opens Superwall paywall with Free/Paid options
  // Passes currentPlan as a placement parameter so the paywall can show "Current" indicator
  const handleChangePlan = async () => {
    const currentPlan = isComplimentaryPro 
      ? 'free' // Complimentary users see "free" in the paywall
      : subscriptionDetails.currentPlan || 'unknown';
    
    console.log('[Membership] Opening Change Plan paywall with currentPlan:', currentPlan);
    
    try {
      await requestPremiumAccess('change_plan', undefined, { currentPlan });
      console.log('[Membership] Change Plan paywall request completed');
    } catch (error) {
      console.error('[Membership] Error opening Change Plan paywall:', error);
    }
    // Custom actions like "downgrade_to_free" are handled by useSuperwallEvents above
  };

  // Show downgrade confirmation dialog
  const handleDowngradeConfirmation = () => {
    Alert.alert(
      'Downgrade to Free?',
      'You will lose access to:\n\n• Unlimited downloads\n• Premium templates\n• Watermark-free exports\n\nYour Pro features will remain active until your current billing period ends.',
      [
        { 
          text: 'Keep Pro', 
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
      
      // Show follow-up instructions after a short delay
      setTimeout(() => {
        Alert.alert(
          'Complete Cancellation',
          'To finish downgrading:\n\n1. Find "Resulta" in your subscriptions\n2. Tap "Cancel Subscription"\n\nYour Pro features will remain active until your billing period ends.',
          [{ text: 'Got it' }]
        );
      }, 1000);
    } catch (error) {
      Alert.alert(
        'Open Settings Manually',
        'Go to:\n\nSettings → [Your Name] → Subscriptions → Resulta\n\nThen tap "Cancel Subscription"',
        [
          { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
          { text: 'OK', style: 'cancel' },
        ]
      );
    }
  };

  // Handle direct cancel button (for users who want to cancel directly)
  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription?',
      'Are you sure you want to cancel your Pro subscription?\n\nYour features will remain active until your current billing period ends.',
      [
        { text: 'Keep Pro', style: 'cancel' },
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

  // Features included in Pro
  const proFeatures = [
    'Unlimited downloads',
    'All premium templates',
    'No watermarks',
    'Priority support',
  ];

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

  // If not premium, redirect back (this screen is only for Pro members)
  if (!isSubscriptionLoading && !isPremium) {
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
        <View style={styles.notPremiumContainer}>
          <Crown size={48} color={Colors.light.textTertiary} />
          <Text style={styles.notPremiumTitle}>No Active Membership</Text>
          <Text style={styles.notPremiumText}>
            Upgrade to Pro to access this page and unlock all premium features.
          </Text>
          <TouchableOpacity 
            style={styles.upgradeButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.upgradeButtonText}>Go Back</Text>
          </TouchableOpacity>
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
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Current Plan</Text>
            {isComplimentaryPro ? (
              <View style={styles.planInfo}>
                <View style={styles.planHeader}>
                  <Gift size={20} color={Colors.light.accent} />
                  <Text style={styles.planName}>Complimentary Pro</Text>
                </View>
                <Text style={styles.planDescription}>
                  Your Pro access was granted by an admin
                </Text>
              </View>
            ) : (
              <View style={styles.planInfo}>
                <View style={styles.planHeader}>
                  <Crown size={20} color={Colors.light.accent} />
                  <Text style={styles.planName}>
                    {subscriptionDetails.currentPlan === 'weekly' 
                      ? 'Pro Weekly' 
                      : subscriptionDetails.currentPlan === 'monthly'
                      ? 'Pro Monthly'
                      : 'Pro Plan'}
                  </Text>
                </View>
                <Text style={styles.planDescription}>
                  {subscriptionDetails.currentPlan === 'weekly' 
                    ? 'Billed $5.49/week • Auto-renews'
                    : subscriptionDetails.currentPlan === 'monthly'
                    ? 'Billed $9.99/month • Auto-renews'
                    : 'Auto-renews • Managed via App Store'}
                </Text>
              </View>
            )}
          </View>

          {/* What's Included */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WHAT'S INCLUDED</Text>
            <View style={styles.featuresList}>
              {proFeatures.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Check size={18} color={Colors.light.success} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Management Options - Only for App Store subscriptions */}
          {!isComplimentaryPro && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MANAGE</Text>
              
              {/* Change Plan Button - Opens Superwall paywall with Free/Paid options */}
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleChangePlan}
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

          {/* Complimentary Pro Info */}
          {isComplimentaryPro && (
            <View style={styles.complimentaryInfo}>
              <Gift size={20} color={Colors.light.accent} />
              <Text style={styles.complimentaryInfoText}>
                Your Pro access was granted by an administrator and doesn't require a subscription. Contact support if you have any questions.
              </Text>
            </View>
          )}

          {/* Sandbox Warning - Development mode only */}
          {isDevelopmentMode() && !isComplimentaryPro && (
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
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  planDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
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
    backgroundColor: 'rgba(201, 168, 124, 0.15)', // Light golden
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

  // Not Premium State
  notPremiumContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  notPremiumTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  notPremiumText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.surface,
  },
});
