import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { 
  Crown, 
  ChevronLeft,
  ExternalLink,
  Repeat,
  Gift,
  Sparkles,
} from "lucide-react-native";
import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";
import { getTierDisplayInfo, TIER_COLORS } from "@/constants/tiers";
import { useTieredSubscription } from "@/hooks/usePremiumStatus";
import { useResponsive } from "@/hooks/useResponsive";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SubscriptionTier, SubscriptionTierSource } from "@/types";

/**
 * Membership Management Screen
 * 
 * Simplified screen for managing subscription:
 * - Shows current plan
 * - Change Plan: Opens Superwall's membership_manage campaign
 * - Cancel Subscription: Opens App Store subscription management
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
    requestMembership,
  } = useTieredSubscription();

  // Handle Change Plan - opens Superwall's membership_manage campaign
  const handleChangePlan = async () => {
    await requestMembership();
  };

  // Open App Store subscription settings for cancellation
  const openCancellationSettings = async () => {
    const iosSettingsUrl = 'itms-apps://apps.apple.com/account/subscriptions';
    
    try {
      await Linking.openURL(iosSettingsUrl);
      
      setTimeout(() => {
        Alert.alert(
          'Manage in App Store',
          'To manage your subscription:\n\n1. Find "Resulta" in your subscriptions\n2. Make your desired changes\n\nYour features will remain active until your billing period ends.',
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

  // Handle cancel subscription button
  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription?',
      'You will be redirected to the App Store to manage your subscription.\n\nYour features will remain active until your current billing period ends.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Go to App Store',
          onPress: openCancellationSettings,
        },
      ]
    );
  };

  // Get tier display info from centralized config
  const tierInfo = getTierDisplayInfo(tier, source as SubscriptionTierSource | 'none');
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

  // Loading state - show skeleton
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
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, dynamicStyles.scrollContent]}
          showsVerticalScrollIndicator={false}
        >
          <View style={dynamicStyles.contentContainer}>
            {/* Skeleton Current Plan Card */}
            <View style={styles.card}>
              <Skeleton width={80} height={12} borderRadius={4} style={{ marginBottom: 16 }} />
              <View style={styles.planInfo}>
                <View style={styles.planHeader}>
                  <Skeleton circle size={24} />
                  <Skeleton width={100} height={24} borderRadius={4} />
                </View>
                <Skeleton width={160} height={14} borderRadius={4} style={{ marginTop: 8 }} />
              </View>
            </View>

            {/* Skeleton Management Section */}
            <View style={styles.section}>
              <Skeleton width={60} height={12} borderRadius={4} style={{ marginBottom: 12 }} />
              
              {/* Skeleton Action Button */}
              <View style={styles.actionButton}>
                <View style={styles.actionButtonContent}>
                  <Skeleton width={44} height={44} borderRadius={12} />
                  <View style={styles.actionTextContainer}>
                    <Skeleton width={100} height={16} borderRadius={4} />
                    <Skeleton width={140} height={13} borderRadius={4} style={{ marginTop: 6 }} />
                  </View>
                </View>
                <Skeleton width={20} height={20} borderRadius={4} />
              </View>
            </View>
          </View>
        </ScrollView>
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

          {/* Management Options - Available for all users */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MANAGE</Text>
            
            {/* Change Plan Button - Opens Superwall membership_manage campaign */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleChangePlan}
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
              <ChevronLeft size={20} color={Colors.light.textTertiary} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>

            {/* Cancel Subscription Button - Only shown for paid subscriptions */}
            {isPaid && (
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
            )}
          </View>

          {/* Complimentary Info */}
          {isComplimentary && (
            <View style={[styles.complimentaryInfo, { backgroundColor: tierInfo.backgroundColor }]}>
              <Gift size={20} color={tierInfo.color} />
              <Text style={styles.complimentaryInfoText}>
                Your {tierInfo.shortName} access was granted by an administrator and doesn't require a subscription. Contact support if you have any questions.
              </Text>
            </View>
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
    // backgroundColor set dynamically based on tier
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
});
