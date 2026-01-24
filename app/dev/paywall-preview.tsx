/**
 * Paywall Preview Development Screen
 * 
 * A development-only screen for previewing and designing paywall UIs.
 * Use this as reference when configuring paywalls in Superwall.
 * 
 * Access via: /dev/paywall-preview (from editor 3-dots menu)
 * 
 * Variants:
 * - Download (Pro)
 * - Share (Pro)
 * - Remove Watermark (Pro)
 * - AI Remove Background (Studio)
 * - AI Auto Quality (Studio)
 * - Membership Management (Pro vs Studio comparison)
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import {
  ChevronLeft,
  ChevronDown,
  Check,
  Download,
  Share2,
  Sparkles,
  Crown,
  Wand2,
  ImageMinus,
  X,
  Palette,
  HeadphonesIcon,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

// ============================================
// Types
// ============================================

type PaywallContext = 
  | 'download' 
  | 'share' 
  | 'watermark' 
  | 'ai_remove_bg' 
  | 'ai_auto_quality'
  | 'membership';

type PricingPeriod = 'weekly' | 'monthly';
type MembershipTier = 'pro' | 'studio';

interface PaywallConfig {
  id: PaywallContext;
  label: string;
  tier: 'pro' | 'studio' | 'membership';
  headline: string;
  subhead: string;
  icon: React.ReactNode;
  heroImage: string;
  benefits: { icon: React.ReactNode; text: string }[];
  pricing: {
    weekly: number;
    monthly: number;
  };
}

// ============================================
// Constants
// ============================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_SMALL_DEVICE = SCREEN_HEIGHT < 700;

// Studio uses a darker, richer gold for premium feel
const STUDIO_COLOR = '#A88B5E'; // Darker accent gold

// Hero images - using placeholder beauty/content creator themed images
const HERO_IMAGES = {
  download: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop',
  share: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop',
  watermark: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=300&fit=crop',
  ai_remove_bg: 'https://images.unsplash.com/photo-1503236823255-94609f598e71?w=400&h=300&fit=crop',
  ai_auto_quality: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop',
  membership: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=300&fit=crop',
};

// ============================================
// Configuration
// ============================================

const PAYWALL_CONFIGS: PaywallConfig[] = [
  {
    id: 'download',
    label: 'Download',
    tier: 'pro',
    headline: 'Download Your Creation',
    subhead: 'Save high-quality images to your photos',
    icon: <Download size={24} color={Colors.light.accent} />,
    heroImage: HERO_IMAGES.download,
    benefits: [
      { icon: <Download size={18} color={Colors.light.accent} />, text: 'Unlimited downloads' },
      { icon: <Share2 size={18} color={Colors.light.accent} />, text: 'Share to all platforms' },
      { icon: <Sparkles size={18} color={Colors.light.accent} />, text: 'No watermarks' },
      { icon: <HeadphonesIcon size={18} color={Colors.light.accent} />, text: 'Priority support' },
    ],
    pricing: { weekly: 4.99, monthly: 14.99 },
  },
  {
    id: 'share',
    label: 'Share',
    tier: 'pro',
    headline: 'Share to Your Audience',
    subhead: 'Post directly to Instagram, TikTok & more',
    icon: <Share2 size={24} color={Colors.light.accent} />,
    heroImage: HERO_IMAGES.share,
    benefits: [
      { icon: <Share2 size={18} color={Colors.light.accent} />, text: 'Share to all platforms' },
      { icon: <Download size={18} color={Colors.light.accent} />, text: 'Unlimited downloads' },
      { icon: <Sparkles size={18} color={Colors.light.accent} />, text: 'No watermarks' },
      { icon: <HeadphonesIcon size={18} color={Colors.light.accent} />, text: 'Priority support' },
    ],
    pricing: { weekly: 4.99, monthly: 14.99 },
  },
  {
    id: 'watermark',
    label: 'Remove Watermark',
    tier: 'pro',
    headline: 'Go Watermark-Free',
    subhead: 'Export clean, professional content',
    icon: <Sparkles size={24} color={Colors.light.accent} />,
    heroImage: HERO_IMAGES.watermark,
    benefits: [
      { icon: <Sparkles size={18} color={Colors.light.accent} />, text: 'No watermarks' },
      { icon: <Download size={18} color={Colors.light.accent} />, text: 'Unlimited downloads' },
      { icon: <Share2 size={18} color={Colors.light.accent} />, text: 'Share to all platforms' },
      { icon: <HeadphonesIcon size={18} color={Colors.light.accent} />, text: 'Priority support' },
    ],
    pricing: { weekly: 4.99, monthly: 14.99 },
  },
  {
    id: 'ai_remove_bg',
    label: 'AI Remove Background',
    tier: 'studio',
    headline: 'AI Background Removal',
    subhead: 'Instantly remove backgrounds with one tap',
    icon: <ImageMinus size={24} color={STUDIO_COLOR} />,
    heroImage: HERO_IMAGES.ai_remove_bg,
    benefits: [
      { icon: <ImageMinus size={18} color={STUDIO_COLOR} />, text: 'AI Background Remove' },
      { icon: <Palette size={18} color={STUDIO_COLOR} />, text: 'AI Background Replace' },
      { icon: <Wand2 size={18} color={STUDIO_COLOR} />, text: 'AI Auto Quality' },
      { icon: <Crown size={18} color={STUDIO_COLOR} />, text: 'All Pro features included' },
    ],
    pricing: { weekly: 7.99, monthly: 24.99 },
  },
  {
    id: 'ai_auto_quality',
    label: 'AI Auto Quality',
    tier: 'studio',
    headline: 'AI Auto Enhance',
    subhead: 'Automatically perfect your photos',
    icon: <Wand2 size={24} color={STUDIO_COLOR} />,
    heroImage: HERO_IMAGES.ai_auto_quality,
    benefits: [
      { icon: <Wand2 size={18} color={STUDIO_COLOR} />, text: 'AI Auto Quality' },
      { icon: <ImageMinus size={18} color={STUDIO_COLOR} />, text: 'AI Background Remove' },
      { icon: <Palette size={18} color={STUDIO_COLOR} />, text: 'AI Background Replace' },
      { icon: <Crown size={18} color={STUDIO_COLOR} />, text: 'All Pro features included' },
    ],
    pricing: { weekly: 7.99, monthly: 24.99 },
  },
  {
    id: 'membership',
    label: 'Membership',
    tier: 'membership',
    headline: 'Choose Your Plan',
    subhead: 'Unlock features and create without limits',
    icon: <Crown size={24} color={Colors.light.accent} />,
    heroImage: HERO_IMAGES.membership,
    benefits: [],
    pricing: { weekly: 4.99, monthly: 14.99 },
  },
];

// Pro vs Studio comparison data
const PRO_BENEFITS = [
  { icon: <Download size={18} color={Colors.light.accent} />, text: 'Unlimited downloads' },
  { icon: <Share2 size={18} color={Colors.light.accent} />, text: 'Share to all platforms' },
  { icon: <Sparkles size={18} color={Colors.light.accent} />, text: 'No watermarks' },
  { icon: <HeadphonesIcon size={18} color={Colors.light.accent} />, text: 'Priority support' },
];

const STUDIO_BENEFITS = [
  { icon: <Crown size={18} color={STUDIO_COLOR} />, text: 'Everything in Pro' },
  { icon: <Wand2 size={18} color={STUDIO_COLOR} />, text: 'AI Auto Quality' },
  { icon: <ImageMinus size={18} color={STUDIO_COLOR} />, text: 'AI Background Remove' },
  { icon: <Palette size={18} color={STUDIO_COLOR} />, text: 'AI Background Replace' },
];

// ============================================
// Main Screen
// ============================================

export default function PaywallPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedContext, setSelectedContext] = useState<PaywallContext>('download');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PricingPeriod>('monthly');
  const [membershipTier, setMembershipTier] = useState<MembershipTier>('pro');

  const currentConfig = useMemo(
    () => PAYWALL_CONFIGS.find(c => c.id === selectedContext) || PAYWALL_CONFIGS[0],
    [selectedContext]
  );

  const isMembership = selectedContext === 'membership';
  const displayTier = isMembership ? membershipTier : currentConfig.tier;
  const accentColor = displayTier === 'studio' ? STUDIO_COLOR : Colors.light.accent;
  
  // Get benefits based on current view
  const displayBenefits = isMembership 
    ? (membershipTier === 'studio' ? STUDIO_BENEFITS : PRO_BENEFITS)
    : currentConfig.benefits;

  // Get pricing based on membership tier selection
  const displayPricing = isMembership
    ? (membershipTier === 'studio' 
        ? { weekly: 7.99, monthly: 24.99 }
        : { weekly: 4.99, monthly: 14.99 })
    : currentConfig.pricing;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header - Fixed at top */}
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={Colors.light.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Paywall Preview</Text>

          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowDropdown(true)}
          >
            <Text style={styles.dropdownButtonText} numberOfLines={1}>
              {currentConfig.label}
            </Text>
            <ChevronDown size={16} color={Colors.light.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Paywall Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 }
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero Image Section */}
        <View style={styles.heroSection}>
          <Image
            source={{ uri: currentConfig.heroImage }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.heroOverlay} />
          
          {/* Dismiss Button */}
          <TouchableOpacity style={styles.dismissButton} activeOpacity={0.7}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Content Card */}
        <View style={styles.contentCard}>
          {/* Header with Icon and Tier */}
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: `${accentColor}15` }]}>
              {isMembership ? (
                membershipTier === 'studio' 
                  ? <Sparkles size={20} color={accentColor} />
                  : <Crown size={20} color={accentColor} />
              ) : currentConfig.icon}
            </View>
            <View style={[styles.tierPill, { backgroundColor: `${accentColor}15` }]}>
              <Text style={[styles.tierPillText, { color: accentColor }]}>
                {displayTier === 'studio' ? 'STUDIO' : 'PRO'}
              </Text>
            </View>
          </View>

          {/* Headlines */}
          <Text style={styles.headline}>{currentConfig.headline}</Text>
          <Text style={styles.subhead}>{currentConfig.subhead}</Text>

          {/* Membership Tier Toggle - Only for membership context */}
          {isMembership && (
            <View style={styles.tierToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.tierToggleOption,
                  membershipTier === 'pro' && styles.tierToggleOptionActive,
                  membershipTier === 'pro' && { borderColor: Colors.light.accent },
                ]}
                onPress={() => setMembershipTier('pro')}
                activeOpacity={0.8}
              >
                <Crown size={18} color={membershipTier === 'pro' ? Colors.light.accent : Colors.light.textSecondary} />
                <Text style={[
                  styles.tierToggleText,
                  membershipTier === 'pro' && { color: Colors.light.accent, fontWeight: '600' }
                ]}>
                  Pro
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.tierToggleOption,
                  membershipTier === 'studio' && styles.tierToggleOptionActive,
                  membershipTier === 'studio' && { borderColor: STUDIO_COLOR },
                ]}
                onPress={() => setMembershipTier('studio')}
                activeOpacity={0.8}
              >
                <Sparkles size={18} color={membershipTier === 'studio' ? STUDIO_COLOR : Colors.light.textSecondary} />
                <Text style={[
                  styles.tierToggleText,
                  membershipTier === 'studio' && { color: STUDIO_COLOR, fontWeight: '600' }
                ]}>
                  Studio
                </Text>
                <View style={[styles.popularTag, { backgroundColor: STUDIO_COLOR }]}>
                  <Text style={styles.popularTagText}>POPULAR</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Benefits List */}
          <View style={styles.benefitsList}>
            {displayBenefits.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <View style={[styles.benefitIcon, { backgroundColor: `${accentColor}08` }]}>
                  {benefit.icon}
                </View>
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            ))}
          </View>

          {/* Pricing Section */}
          <View style={styles.pricingSection}>
            {/* Weekly Option */}
            <TouchableOpacity
              style={[
                styles.pricingOption,
                selectedPeriod === 'weekly' && [styles.pricingOptionSelected, { borderColor: accentColor }],
              ]}
              onPress={() => setSelectedPeriod('weekly')}
              activeOpacity={0.8}
            >
              <View style={styles.pricingOptionLeft}>
                <View style={[
                  styles.radioButton,
                  selectedPeriod === 'weekly' && { borderColor: accentColor },
                ]}>
                  {selectedPeriod === 'weekly' && (
                    <View style={[styles.radioButtonInner, { backgroundColor: accentColor }]} />
                  )}
                </View>
                <Text style={styles.pricingPeriodLabel}>Weekly</Text>
              </View>
              <Text style={styles.pricingAmount}>
                ${displayPricing.weekly.toFixed(2)}
                <Text style={styles.pricingPeriod}>/week</Text>
              </Text>
            </TouchableOpacity>

            {/* Monthly Option */}
            <TouchableOpacity
              style={[
                styles.pricingOption,
                selectedPeriod === 'monthly' && [styles.pricingOptionSelected, { borderColor: accentColor }],
              ]}
              onPress={() => setSelectedPeriod('monthly')}
              activeOpacity={0.8}
            >
              <View style={styles.pricingOptionLeft}>
                <View style={[
                  styles.radioButton,
                  selectedPeriod === 'monthly' && { borderColor: accentColor },
                ]}>
                  {selectedPeriod === 'monthly' && (
                    <View style={[styles.radioButtonInner, { backgroundColor: accentColor }]} />
                  )}
                </View>
                <View>
                  <Text style={styles.pricingPeriodLabel}>Monthly</Text>
                  <Text style={[styles.savingsLabel, { color: accentColor }]}>
                    Save {Math.round((1 - (displayPricing.monthly / (displayPricing.weekly * 4))) * 100)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.pricingAmount}>
                ${displayPricing.monthly.toFixed(2)}
                <Text style={styles.pricingPeriod}>/mo</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: accentColor }]}
            activeOpacity={0.9}
          >
            <Text style={styles.ctaButtonText}>Continue</Text>
          </TouchableOpacity>

          {/* Dismiss Link */}
          <TouchableOpacity style={styles.dismissLink} activeOpacity={0.7}>
            <Text style={styles.dismissLinkText}>Not now</Text>
          </TouchableOpacity>

          {/* Legal Text */}
          <Text style={styles.legalText}>
            Subscription automatically renews. Cancel anytime.
          </Text>
        </View>

        {/* Dev Info */}
        <View style={styles.devInfo}>
          <Text style={styles.devInfoTitle}>Dev Info</Text>
          <Text style={styles.devInfoText}>
            Context: {currentConfig.id} | Tier: {displayTier} | Period: {selectedPeriod}
          </Text>
        </View>
      </ScrollView>

      {/* Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setShowDropdown(false)}
        >
          <View style={[styles.dropdownMenu, { marginTop: insets.top + 60 }]}>
            {PAYWALL_CONFIGS.map((config) => (
              <TouchableOpacity
                key={config.id}
                style={[
                  styles.dropdownMenuItem,
                  selectedContext === config.id && styles.dropdownMenuItemSelected,
                ]}
                onPress={() => {
                  setSelectedContext(config.id);
                  setShowDropdown(false);
                }}
              >
                <View style={styles.dropdownMenuItemLeft}>
                  <View style={[
                    styles.dropdownMenuItemIcon,
                    { backgroundColor: config.tier === 'studio' ? `${STUDIO_COLOR}15` : `${Colors.light.accent}15` },
                  ]}>
                    {config.tier === 'studio' ? (
                      <Sparkles size={16} color={STUDIO_COLOR} />
                    ) : config.tier === 'membership' ? (
                      <Crown size={16} color={Colors.light.accent} />
                    ) : (
                      <Crown size={16} color={Colors.light.accent} />
                    )}
                  </View>
                  <View>
                    <Text style={styles.dropdownMenuItemText}>{config.label}</Text>
                    <Text style={styles.dropdownMenuItemTier}>
                      {config.tier === 'studio' ? 'Studio' : config.tier === 'membership' ? 'Compare Plans' : 'Pro'}
                    </Text>
                  </View>
                </View>
                {selectedContext === config.id && (
                  <Check size={18} color={Colors.light.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============================================
// Styles - Optimized for iOS
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerSafeArea: {
    backgroundColor: Colors.light.background,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    minWidth: 100,
  },
  dropdownButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.text,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Hero Section
  heroSection: {
    height: IS_SMALL_DEVICE ? 160 : 200,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content Card
  contentCard: {
    flex: 1,
    backgroundColor: Colors.light.background,
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tierPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: IS_SMALL_DEVICE ? 24 : 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
  },
  subhead: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginBottom: 20,
    lineHeight: 21,
  },

  // Tier Toggle (Membership)
  tierToggleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  tierToggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tierToggleOptionActive: {
    backgroundColor: Colors.light.surface,
  },
  tierToggleText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  popularTag: {
    position: 'absolute',
    top: -8,
    right: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularTagText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Benefits
  benefitsList: {
    gap: 12,
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
    flex: 1,
  },

  // Pricing
  pricingSection: {
    gap: 10,
    marginBottom: 20,
  },
  pricingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pricingOptionSelected: {
    backgroundColor: Colors.light.surface,
  },
  pricingOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pricingPeriodLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  savingsLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  pricingAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  pricingPeriod: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.light.textSecondary,
  },

  // CTA
  ctaButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissLink: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissLinkText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  legalText: {
    fontSize: 11,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Dev Info
  devInfo: {
    marginHorizontal: 24,
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
  },
  devInfoTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  devInfoText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },

  // Dropdown Modal
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  dropdownMenu: {
    marginHorizontal: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
    }),
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  dropdownMenuItemSelected: {
    backgroundColor: Colors.light.surfaceSecondary,
  },
  dropdownMenuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownMenuItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
  },
  dropdownMenuItemTier: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
});
