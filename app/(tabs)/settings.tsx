import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { 
  User, 
  ChevronRight, 
  Crown, 
  Check, 
  LogOut,
  Trash2,
  FileText,
  Shield,
  RefreshCw,
  MessageCircle,
  Send,
  ImageIcon,
  X,
  Gift,
} from "lucide-react-native";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import * as Application from 'expo-application';
import Colors from "@/constants/colors";
import { getTierDisplayInfo } from "@/constants/tiers";
import { usePremiumStatus, useRestorePurchases, useTieredSubscription } from "@/hooks/usePremiumStatus";
import { useAuthContext } from "@/contexts/AuthContext";
import { submitFeedback } from "@/services/feedbackService";
import { 
  loadBrandKit, 
  saveBrandLogo, 
  deleteBrandLogo,
  syncFromCloud,
  BrandKitSaveResult,
} from "@/services/brandKitService";
import { BrandKit } from "@/types";
import { useResponsive } from "@/hooks/useResponsive";
import { Skeleton } from "@/components/ui/Skeleton";

// App configuration - replace with your actual URLs
const APP_CONFIG = {
  privacyPolicyUrl: 'https://www.resulta.app/privacy',
  termsOfServiceUrl: 'https://www.resulta.app/terms',
};

export default function SettingsScreen() {
  const router = useRouter();
  
  // Responsive configuration
  const responsive = useResponsive();
  
  // Auth state
  const { 
    user, 
    isAuthenticated, 
    isLoading: isAuthLoading,
    signOut,
    deleteAccount,
  } = useAuthContext();
  
  // Subscription status from Superwall
  const { 
    isPremium, 
    isLoading: isSubscriptionLoading,
    subscriptionDetails,
  } = usePremiumStatus();
  
  // Get tiered subscription info for accurate tier display
  const { tier, source, requestMembership } = useTieredSubscription();
  const tierInfo = getTierDisplayInfo(tier, source);
  // Restore purchases only needed for free users
  const { 
    restorePurchases, 
    isRestoring: isRestoringPurchases, 
  } = useRestorePurchases();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  // Feedback state
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Brand Kit state
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [isLoadingBrandKit, setIsLoadingBrandKit] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSyncingBrandKit, setIsSyncingBrandKit] = useState(false);

  // Load Brand Kit on mount and when auth changes
  useEffect(() => {
    const loadBrandKitData = async () => {
      try {
        setIsLoadingBrandKit(true);
        const kit = await loadBrandKit();
        setBrandKit(kit);
      } catch (error) {
        // Failed to load brand kit
      } finally {
        setIsLoadingBrandKit(false);
      }
    };
    loadBrandKitData();
  }, [isAuthenticated]);

  // Refresh brand kit from cloud when user signs in
  const handleRefreshBrandKit = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setIsSyncingBrandKit(true);
    try {
      const kit = await syncFromCloud();
      setBrandKit(kit);
    } catch (error) {
      // Failed to sync brand kit
    } finally {
      setIsSyncingBrandKit(false);
    }
  }, [isAuthenticated]);

  // Handle Upload Logo - free for all users
  const handleUploadLogo = useCallback(async () => {
    pickAndUploadLogo();
  }, []);

  const pickAndUploadLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingLogo(true);
        
        const saveResult: BrandKitSaveResult = await saveBrandLogo(result.assets[0].uri);
        
        if (saveResult.success) {
          // Force UI update with new logo
          setBrandKit({ ...saveResult.brandKit });
          Alert.alert('Success', 'Logo saved!');
        } else {
          Alert.alert('Error', saveResult.error || 'Failed to save logo. Please try again.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save logo. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Handle Remove Logo
  const handleRemoveLogo = useCallback(async () => {
    const message = isAuthenticated 
      ? 'Are you sure you want to remove your brand logo? This will also remove it from the cloud.'
      : 'Are you sure you want to remove your brand logo?';
    
    Alert.alert(
      'Remove Logo',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedKit = await deleteBrandLogo();
              setBrandKit(updatedKit);
              Alert.alert('Success', 'Logo removed successfully.');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove logo. Please try again.');
            }
          },
        },
      ]
    );
  }, [isAuthenticated]);

  // Handle Upgrade button press - shows membership_manage paywall
  const handleUpgrade = async () => {
    await requestMembership();
  };

  // Handle Restore Purchases - refreshes entitlements from Superwall
  const handleRestorePurchases = async () => {
    const result = await restorePurchases();
    
    if (result.success) {
      if (result.hasEntitlements) {
        // User has active entitlements - show success
        Alert.alert('Success', 'Your purchases have been restored!');
      } else {
        // No entitlements found - offer options
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases. If you have an active subscription, it may take a moment to sync.\n\nYou can also manage your subscriptions through Apple.',
          [
            { text: 'OK', style: 'cancel' },
            { 
              text: 'Manage in Settings', 
              onPress: () => {
                // Open iOS subscription management
                Linking.openURL('https://apps.apple.com/account/subscriptions');
              }
            },
          ]
        );
      }
    } else {
      Alert.alert('Error', result.error || 'Failed to restore purchases. Please try again.');
    }
  };

  // Handle Sign In
  const handleSignIn = () => {
    router.push('/auth/sign-in');
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              const result = await signOut();
              if (!result.success) {
                Alert.alert('Error', result.error || 'Failed to sign out');
              }
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ]
    );
  };

  // Handle Delete Account
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Are you absolutely sure?',
              'All your data, including your portfolio and drafts, will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeletingAccount(true);
                    try {
                      const result = await deleteAccount();
                      if (result.success) {
                        Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
                      } else {
                        Alert.alert('Error', result.error || 'Failed to delete account');
                      }
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // Handle Send Feedback
  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim() || isSendingFeedback) return;
    
    Keyboard.dismiss();
    setIsSendingFeedback(true);
    
    const result = await submitFeedback(feedbackMessage);
    
    setIsSendingFeedback(false);
    
    if (result.success) {
      setFeedbackMessage('');
      setFeedbackSent(true);
      // Reset success message after 3 seconds
      setTimeout(() => setFeedbackSent(false), 3000);
    } else {
      Alert.alert('Error', result.error || 'Failed to send message');
    }
  };

  // Handle Support Links
  const handlePrivacyPolicy = () => {
    Linking.openURL(APP_CONFIG.privacyPolicyUrl);
  };

  const handleTermsOfService = () => {
    Linking.openURL(APP_CONFIG.termsOfServiceUrl);
  };

  const isSubscribed = isPremium;
  const isLoading = isSubscriptionLoading || isAuthLoading;

  // Get app version
  const appVersion = Application.nativeApplicationVersion || '1.0.0';
  const buildNumber = Application.nativeBuildVersion || '1';

  // Dynamic styles for responsive layout
  const dynamicStyles = useMemo(() => ({
    header: {
      paddingHorizontal: responsive.gridPadding,
    },
    title: {
      fontSize: responsive.headerFontSize,
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, dynamicStyles.header]}>
        <Text style={[styles.title, dynamicStyles.title]}>Settings</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, dynamicStyles.scrollContent]}
        showsVerticalScrollIndicator={false}
      >
        <View style={dynamicStyles.contentContainer}>
          {/* Subscription Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            <View style={[
              styles.card, 
              !isSubscriptionLoading && isSubscribed && { 
                borderColor: tierInfo.color, 
                borderWidth: 2,
              }
            ]}>
              {isSubscriptionLoading ? (
                // Skeleton loading state for subscription
                <View style={styles.subscriptionSkeleton}>
                  <View style={styles.upgradePrompt}>
                    <Skeleton circle size={52} />
                    <View style={[styles.subscriptionInfo, { gap: 8 }]}>
                      <Skeleton width={120} height={18} borderRadius={4} />
                      <Skeleton width={180} height={14} borderRadius={4} />
                    </View>
                  </View>
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
                    <Skeleton width="100%" height={48} borderRadius={12} />
                  </View>
                </View>
              ) : isSubscribed ? (
                // Show current plan card matching membership page
                <>
                  <View style={styles.currentPlanContainer}>
                    <Text style={styles.currentPlanLabel}>Current Plan</Text>
                    <View style={styles.planHeader}>
                      {tierInfo.icon && (
                        <tierInfo.icon size={20} color={tierInfo.color} />
                      )}
                      <Text style={[styles.planName, { color: tierInfo.color }]}>
                        {tierInfo.name}
                      </Text>
                      {source === 'complimentary' && (
                        <View style={styles.complimentaryBadge}>
                          <Gift size={10} color={Colors.light.accent} />
                          <Text style={styles.complimentaryBadgeText}>Complimentary</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {/* Manage Membership button - uses tier color */}
                  <TouchableOpacity 
                    style={[styles.manageMembershipButton, { backgroundColor: tierInfo.color }]}
                    onPress={() => router.push('/membership')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.manageMembershipText}>Manage Membership</Text>
                    <ChevronRight size={18} color={Colors.light.surface} />
                  </TouchableOpacity>
                </>
              ) : (
                // Upgrade prompt view
                <>
                  <View style={styles.upgradePrompt}>
                    <View style={styles.subscriptionIcon}>
                      <Crown size={24} color={Colors.light.textSecondary} />
                    </View>
                    <View style={styles.subscriptionInfo}>
                      <Text style={styles.subscriptionStatus}>Free Plan</Text>
                      <Text style={styles.subscriptionDetail}>Upgrade to unlock unlimited access</Text>
                    </View>
                  </View>
                  <View style={styles.featuresList}>
                    <View style={styles.featureItem}>
                      <Check size={16} color={Colors.light.success} />
                      <Text style={styles.featureText}>Unlimited downloads</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Check size={16} color={Colors.light.success} />
                      <Text style={styles.featureText}>AI-powered enhancements</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Check size={16} color={Colors.light.success} />
                      <Text style={styles.featureText}>Priority support</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[
                      styles.upgradeButton,
                      isLoading && styles.upgradeButtonDisabled,
                    ]} 
                    activeOpacity={0.8}
                    onPress={handleUpgrade}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={Colors.light.surface} />
                    ) : (
                      <Crown size={18} color={Colors.light.surface} />
                    )}
                    <Text style={styles.upgradeButtonText}>Upgrade</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.restoreButton}
                    onPress={handleRestorePurchases}
                    disabled={isRestoringPurchases}
                    activeOpacity={0.7}
                  >
                    {isRestoringPurchases ? (
                      <ActivityIndicator size="small" color={Colors.light.textSecondary} />
                    ) : (
                      <>
                        <RefreshCw size={16} color={Colors.light.textSecondary} />
                        <Text style={styles.restoreButtonText}>Restore Purchases</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              {isAuthenticated && user ? (
                // Signed in state
                <>
                  <View style={styles.profileRow}>
                    <View style={styles.avatarContainer}>
                      {user.avatarUrl ? (
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {(user.displayName || user.email)?.[0]?.toUpperCase() || 'U'}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.avatar}>
                          <User size={24} color={Colors.light.textSecondary} />
                        </View>
                      )}
                    </View>
                    <View style={styles.profileInfo}>
                      <Text style={styles.profileEmail}>{user.email}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <TouchableOpacity 
                    style={styles.settingRow} 
                    onPress={handleSignOut}
                    disabled={isSigningOut}
                    activeOpacity={0.7}
                  >
                    <View style={styles.settingLeft}>
                      <View style={[styles.settingIcon, { backgroundColor: Colors.light.surfaceSecondary }]}>
                        <LogOut size={18} color={Colors.light.textSecondary} />
                      </View>
                      <View>
                        <Text style={styles.settingLabel}>Sign Out</Text>
                      </View>
                    </View>
                    {isSigningOut ? (
                      <ActivityIndicator size="small" color={Colors.light.textTertiary} />
                    ) : (
                      <ChevronRight size={20} color={Colors.light.textTertiary} />
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.divider} />
                  
                  <TouchableOpacity 
                    style={styles.settingRow} 
                    onPress={handleDeleteAccount}
                    disabled={isDeletingAccount}
                    activeOpacity={0.7}
                  >
                    <View style={styles.settingLeft}>
                      <View style={[styles.settingIcon, { backgroundColor: '#FFEBEE' }]}>
                        <Trash2 size={18} color={Colors.light.error} />
                      </View>
                      <View>
                        <Text style={[styles.settingLabel, { color: Colors.light.error }]}>
                          Delete Account
                        </Text>
                        <Text style={styles.settingHint}>Permanently delete all data</Text>
                      </View>
                    </View>
                    {isDeletingAccount ? (
                      <ActivityIndicator size="small" color={Colors.light.error} />
                    ) : (
                      <ChevronRight size={20} color={Colors.light.textTertiary} />
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                // Signed out state
                <TouchableOpacity 
                  style={styles.settingRow} 
                  onPress={handleSignIn}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIcon, { backgroundColor: Colors.light.surfaceSecondary }]}>
                      <User size={18} color={Colors.light.textSecondary} />
                    </View>
                    <View>
                      <Text style={styles.settingLabel}>Sign In</Text>
                      <Text style={styles.settingHint}>Sync your portfolio across devices</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={Colors.light.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Brand Kit Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Brand Kit</Text>
            <View style={styles.card}>
              {/* Logo Section */}
              {brandKit?.logoUri ? (
                // Logo is set - show preview
                <View style={styles.logoPreviewContainer}>
                  <Image
                    source={{ uri: brandKit.logoUri }}
                    style={styles.logoPreview}
                    contentFit="contain"
                    cachePolicy="none"
                    key={brandKit.updatedAt || brandKit.logoUri}
                  />
                  <View style={styles.logoActions}>
                    <TouchableOpacity
                      style={styles.logoChangeButton}
                      onPress={handleUploadLogo}
                      disabled={isUploadingLogo}
                      activeOpacity={0.7}
                    >
                      <ImageIcon size={16} color={Colors.light.accent} />
                      <Text style={styles.logoChangeText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.logoRemoveButton}
                      onPress={handleRemoveLogo}
                      activeOpacity={0.7}
                    >
                      <X size={16} color={Colors.light.error} />
                      <Text style={styles.logoRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // No logo - show upload button
                <TouchableOpacity 
                  style={styles.settingRow} 
                  onPress={handleUploadLogo}
                  disabled={isUploadingLogo}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIcon, { backgroundColor: '#E8F4EC' }]}>
                      {isUploadingLogo ? (
                        <ActivityIndicator size="small" color="#5AAB61" />
                      ) : (
                        <ImageIcon size={18} color="#5AAB61" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.settingLabel}>Upload Logo</Text>
                      <Text style={styles.settingHint}>Add your business logo</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={Colors.light.textTertiary} />
                </TouchableOpacity>
              )}
              
              <View style={styles.divider} />
              
              {/* Logo Usage Info */}
              <View style={styles.brandKitInfo}>
                <Text style={styles.brandKitInfoText}>
                  Your logo will be available as an overlay option when editing templates.
                </Text>
              </View>
            </View>
          </View>

          {/* Feedback Section */}
          <View style={styles.section}>
            <View style={styles.card}>
              <View style={styles.feedbackHeader}>
                <View style={styles.feedbackIconContainer}>
                  <MessageCircle size={24} color={Colors.light.accent} />
                </View>
                <View style={styles.feedbackHeaderText}>
                  <Text style={styles.feedbackTitle}>We'd love to hear from you!</Text>
                  <Text style={styles.feedbackSubtitle}>Got feedback or need help?</Text>
                </View>
              </View>
              
              {feedbackSent ? (
                <View style={styles.feedbackSuccessContainer}>
                  <Check size={24} color={Colors.light.success} />
                  <Text style={styles.feedbackSuccessText}>Thank you for your message!</Text>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.feedbackInput}
                    placeholder="Type your message here..."
                    placeholderTextColor={Colors.light.textTertiary}
                    value={feedbackMessage}
                    onChangeText={setFeedbackMessage}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    maxLength={2000}
                    editable={!isSendingFeedback}
                  />
                  
                  <TouchableOpacity
                    style={[
                      styles.feedbackButton,
                      (!feedbackMessage.trim() || isSendingFeedback) && styles.feedbackButtonDisabled,
                    ]}
                    onPress={handleSendFeedback}
                    disabled={!feedbackMessage.trim() || isSendingFeedback}
                    activeOpacity={0.8}
                  >
                    {isSendingFeedback ? (
                      <ActivityIndicator size="small" color={Colors.light.surface} />
                    ) : (
                      <>
                        <Send size={18} color={Colors.light.surface} />
                        <Text style={styles.feedbackButtonText}>Send Message</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Support Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal</Text>
            <View style={styles.card}>
              <TouchableOpacity 
                style={styles.settingRow} 
                onPress={handlePrivacyPolicy}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: '#FFF3E0' }]}>
                    <Shield size={18} color="#FF9800" />
                  </View>
                  <View>
                    <Text style={styles.settingLabel}>Privacy Policy</Text>
                  </View>
                </View>
                <ChevronRight size={20} color={Colors.light.textTertiary} />
              </TouchableOpacity>
              
              <View style={styles.divider} />
              
              <TouchableOpacity 
                style={styles.settingRow} 
                onPress={handleTermsOfService}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: '#F3E5F5' }]}>
                    <FileText size={18} color="#9C27B0" />
                  </View>
                  <View>
                    <Text style={styles.settingLabel}>Terms of Service</Text>
                  </View>
                </View>
                <ChevronRight size={20} color={Colors.light.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* App Version */}
          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>
              Version {appVersion} ({buildNumber})
            </Text>
          </View>
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
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 4,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  textDisabled: {
    color: Colors.light.textTertiary,
  },
  
  // Brand Kit Logo styles
  logoPreviewContainer: {
    padding: 16,
    alignItems: 'center',
  },
  logoPreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  logoActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  logoChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(229, 164, 59, 0.12)',
  },
  logoChangeText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.accent,
  },
  logoRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(231, 76, 60, 0.12)',
  },
  logoRemoveText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.error,
  },
  brandKitInfo: {
    padding: 16,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  brandKitInfoText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  
  // Subscription styles - matches membership page
  currentPlanContainer: {
    padding: 16,
    gap: 8,
  },
  currentPlanLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  planName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
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
    fontWeight: '600' as const,
    color: Colors.light.accent,
    textTransform: 'uppercase',
  },
  manageMembershipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor set dynamically based on tier
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  manageMembershipText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  subscriptionSkeleton: {
    // Container for skeleton loading state
  },
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  subscriptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionStatus: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  subscriptionDetail: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  
  // Subscription details styles
  complimentaryInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 16,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  complimentaryInfoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.textTertiary,
    lineHeight: 18,
  },
  
  featuresList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.text,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  upgradeButtonDisabled: {
    opacity: 0.7,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 4,
  },
  restoreButtonText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  
  // Profile styles
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  avatarContainer: {
    width: 52,
    height: 52,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileEmail: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  
  // Settings row styles
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  settingHint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.borderLight,
    marginLeft: 68,
  },
  
  // Version styles
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  
  // Feedback styles
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  feedbackIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(229, 164, 59, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackHeaderText: {
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  feedbackSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  feedbackInput: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    minHeight: 100,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    fontSize: 15,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.accent,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  feedbackButtonDisabled: {
    opacity: 0.5,
  },
  feedbackButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  feedbackSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  feedbackSuccessText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.success,
  },
});
