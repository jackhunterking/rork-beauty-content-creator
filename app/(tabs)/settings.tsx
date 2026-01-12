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
import { 
  Palette, 
  User, 
  ChevronRight, 
  Crown, 
  Check, 
  LogOut,
  Trash2,
  FileText,
  Shield,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Send,
} from "lucide-react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import * as Application from 'expo-application';
import Colors from "@/constants/colors";
import { usePremiumStatus, usePremiumFeature } from "@/hooks/usePremiumStatus";
import { useAuthContext } from "@/contexts/AuthContext";
import { submitFeedback } from "@/services/feedbackService";

// App configuration - replace with your actual URLs
const APP_CONFIG = {
  privacyPolicyUrl: 'https://www.resulta.app/privacy',
  termsOfServiceUrl: 'https://www.resulta.app/terms',
};

export default function SettingsScreen() {
  const router = useRouter();
  
  // Auth state
  const { 
    user, 
    isAuthenticated, 
    isLoading: isAuthLoading,
    signOut,
    deleteAccount,
  } = useAuthContext();
  
  // Subscription status from Superwall
  const { isPremium, isLoading: isSubscriptionLoading } = usePremiumStatus();
  const { requestPremiumAccess, paywallState } = usePremiumFeature();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  
  // Feedback state
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Handle Upgrade to Pro button press
  const handleUpgradeToPro = async () => {
    await requestPremiumAccess('settings_upgrade', () => {
      console.log('[Settings] User upgraded to pro!');
    });
  };

  // Handle Restore Purchases
  const handleRestorePurchases = async () => {
    setIsRestoringPurchases(true);
    try {
      // Superwall handles restore via the paywall
      await requestPremiumAccess('settings_restore', () => {
        Alert.alert('Success', 'Your purchases have been restored!');
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsRestoringPurchases(false);
    }
  };

  // Open App Store subscription management
  const handleManageSubscription = () => {
    Linking.openURL('https://apps.apple.com/account/subscriptions');
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.card}>
            {isSubscribed ? (
              // Active subscription view
              <>
                <View style={styles.subscriptionActive}>
                  <View style={styles.subscriptionIcon}>
                    <Crown size={24} color={Colors.light.accent} />
                  </View>
                  <View style={styles.subscriptionInfo}>
                    <Text style={styles.subscriptionStatus}>Pro Member</Text>
                    <Text style={styles.subscriptionDetail}>Unlimited access to all features</Text>
                  </View>
                  <View style={styles.activeBadge}>
                    <Check size={14} color={Colors.light.success} />
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <TouchableOpacity 
                  style={styles.settingRow} 
                  onPress={handleManageSubscription}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.settingIcon, { backgroundColor: '#E8F4EC' }]}>
                      <ExternalLink size={18} color={Colors.light.success} />
                    </View>
                    <View>
                      <Text style={styles.settingLabel}>Manage Subscription</Text>
                      <Text style={styles.settingHint}>View in App Store</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={Colors.light.textTertiary} />
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
                    <Text style={styles.featureText}>All templates included</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Check size={16} color={Colors.light.success} />
                    <Text style={styles.featureText}>No watermarks</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.upgradeButton,
                    (isLoading || paywallState === 'presenting') && styles.upgradeButtonDisabled,
                  ]} 
                  activeOpacity={0.8}
                  onPress={handleUpgradeToPro}
                  disabled={isLoading || paywallState === 'presenting'}
                >
                  {isLoading || paywallState === 'presenting' ? (
                    <ActivityIndicator size="small" color={Colors.light.surface} />
                  ) : (
                    <Crown size={18} color={Colors.light.surface} />
                  )}
                  <Text style={styles.upgradeButtonText}>
                    {paywallState === 'presenting' ? 'Loading...' : 'Upgrade to Pro'}
                  </Text>
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
                    <Text style={styles.profileName}>
                      {user.displayName || user.businessName || 'Beauty Creator'}
                    </Text>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleInline}>Brand Kit</Text>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Soon</Text>
            </View>
          </View>
          <View style={[styles.card, styles.cardDisabled]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#E8F4EC' }]}>
                  <Palette size={18} color="#5AAB61" />
                </View>
                <View>
                  <Text style={[styles.settingLabel, styles.textDisabled]}>Upload Logo</Text>
                  <Text style={[styles.settingHint, styles.textDisabled]}>Add your clinic logo</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.light.border} />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#FEF3E6' }]}>
                  <Palette size={18} color="#E5A43B" />
                </View>
                <View>
                  <Text style={[styles.settingLabel, styles.textDisabled]}>Brand Color</Text>
                  <Text style={[styles.settingHint, styles.textDisabled]}>Not set</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.light.border} />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#EEE8F8' }]}>
                  <Palette size={18} color="#8B5CF6" />
                </View>
                <View>
                  <Text style={[styles.settingLabel, styles.textDisabled]}>Auto-apply Logo</Text>
                  <Text style={[styles.settingHint, styles.textDisabled]}>Add logo to exports</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.light.border} />
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
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
  sectionTitleInline: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comingSoonBadge: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.surface,
    textTransform: 'uppercase',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  textDisabled: {
    color: Colors.light.textTertiary,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  
  // Subscription styles
  subscriptionActive: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
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
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(90, 171, 97, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.success,
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
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
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
    paddingVertical: 20,
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
