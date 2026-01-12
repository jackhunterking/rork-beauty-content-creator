import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { User, Mail, Lock, Eye, EyeOff, ChevronRight } from 'lucide-react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useUser } from 'expo-superwall';
import Colors from '@/constants/colors';
import { useAuthContext } from '@/contexts/AuthContext';
import { 
  saveOnboardingDataToProfile, 
  markOnboardingComplete,
  getPendingSurveyData,
} from '@/services/onboardingService';

/**
 * Onboarding Auth Screen
 * 
 * This is a mandatory authentication screen that appears after the Superwall
 * onboarding flow (surveys + paywall). Users must sign in or create an account
 * to proceed to the main app.
 * 
 * Key differences from regular auth screens:
 * - Cannot be dismissed (no back button, no swipe gesture)
 * - Saves onboarding survey data after successful auth
 * - Marks onboarding as complete
 */
export default function OnboardingAuthScreen() {
  const router = useRouter();
  const { 
    signInWithApple, 
    signInWithEmail,
    signUpWithEmail,
    isLoading,
    appleSignInAvailable,
    user,
    isAuthenticated,
  } = useAuthContext();

  // Superwall user hook for setting user attributes
  // Following best practices: https://superwall.com/docs/dashboard/guides/using-superwall-for-onboarding-flows
  const { update: updateSuperwallUser, identify: identifySuperwallUser } = useUser();

  const [mode, setMode] = useState<'signin' | 'signup'>('signup'); // Default to signup for new users
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  // Prevent back navigation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => backHandler.remove();
  }, []);

  // If user becomes authenticated, complete onboarding and proceed
  useEffect(() => {
    if (isAuthenticated && user) {
      completeOnboarding(user.id);
    }
  }, [isAuthenticated, user]);

  const completeOnboarding = async (userId: string) => {
    try {
      // Get pending survey data before saving
      const surveyData = await getPendingSurveyData();
      
      // Log survey data status for debugging
      console.log('[OnboardingAuth] Completing onboarding for user:', userId);
      console.log('[OnboardingAuth] Survey data status:', {
        exists: surveyData !== null,
        industry: surveyData?.industry || 'NOT CAPTURED',
        goal: surveyData?.goal || 'NOT CAPTURED',
      });
      
      // Warn if survey data is missing - this helps identify issues
      if (!surveyData || (!surveyData.industry && !surveyData.goal)) {
        console.warn('[OnboardingAuth] ⚠️ No survey data captured! User completed auth without survey responses.');
        console.warn('[OnboardingAuth] This may indicate Superwall events were not properly captured.');
      }
      
      // Save pending survey data to Supabase profile
      const result = await saveOnboardingDataToProfile(userId, surveyData || undefined);
      
      if (!result.success) {
        console.warn('[OnboardingAuth] Failed to save survey data:', result.error);
        // Still mark as complete even if survey data save fails
        await markOnboardingComplete(userId);
      } else {
        console.log('[OnboardingAuth] ✓ Survey data saved to Supabase successfully');
      }

      // Set Superwall user attributes for analytics & audience filtering
      // This follows Superwall best practices for onboarding:
      // https://superwall.com/docs/dashboard/guides/using-superwall-for-onboarding-flows
      try {
        // Identify the user in Superwall
        await identifySuperwallUser(userId);
        
        // Set hasCompletedOnboarding attribute for audience filtering
        await updateSuperwallUser({
          hasCompletedOnboarding: true,
          userId: userId,
          // Include survey data for personalization and audience targeting
          ...(surveyData && {
            industry: surveyData.industry,
            goal: surveyData.goal,
          }),
        });
        
        console.log('[OnboardingAuth] ✓ Superwall user attributes set');
      } catch (superwallError) {
        // Non-critical: log but don't block navigation
        console.warn('[OnboardingAuth] Failed to set Superwall attributes:', superwallError);
      }

      console.log('[OnboardingAuth] ✓ Onboarding complete, navigating to main app');
      
      // Navigate to main app, replacing the auth stack
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[OnboardingAuth] Error completing onboarding:', error);
      // Still try to proceed
      router.replace('/(tabs)');
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const resetErrors = () => {
    setEmailError('');
    setPasswordError('');
    setNameError('');
    setConfirmError('');
  };

  const handleEmailAuth = async () => {
    resetErrors();

    let hasError = false;

    // Validate email
    if (!email.trim()) {
      setEmailError('Email is required');
      hasError = true;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email');
      hasError = true;
    }

    // Validate password
    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    } else if (mode === 'signup' && !validatePassword(password)) {
      setPasswordError('Password must be at least 8 characters');
      hasError = true;
    }

    // Additional signup validations
    if (mode === 'signup') {
      if (!displayName.trim()) {
        setNameError('Name is required');
        hasError = true;
      }
      if (!confirmPassword) {
        setConfirmError('Please confirm your password');
        hasError = true;
      } else if (password !== confirmPassword) {
        setConfirmError('Passwords do not match');
        hasError = true;
      }
    }

    if (hasError) return;

    if (mode === 'signup') {
      const result = await signUpWithEmail(email, password, displayName.trim());
      
      if (result.success) {
        if (result.error) {
          // Email confirmation required
          Alert.alert(
            'Check Your Email',
            result.error,
            [{ text: 'OK' }]
          );
        }
        // User will be authenticated and useEffect will handle completion
      } else {
        Alert.alert('Sign Up Failed', result.error || 'Please try again');
      }
    } else {
      const result = await signInWithEmail(email, password);
      
      if (!result.success) {
        Alert.alert('Sign In Failed', result.error || 'Please check your credentials');
      }
      // User will be authenticated and useEffect will handle completion
    }
  };

  const handleAppleSignIn = async () => {
    const result = await signInWithApple();
    
    if (!result.success && result.error !== 'Sign in cancelled') {
      Alert.alert('Sign In Failed', result.error || 'Apple sign in failed');
    }
    // User will be authenticated and useEffect will handle completion
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    resetErrors();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo & Header */}
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/resultalogo.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.title}>
              {mode === 'signup' ? 'Create Your Account' : 'Welcome Back'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signup' 
                ? 'Sign up to save your work and unlock all features'
                : 'Sign in to continue creating amazing content'
              }
            </Text>
          </View>

          {/* Social Sign In */}
          {appleSignInAvailable && (
            <View style={styles.socialButtons}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={mode === 'signup' 
                  ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                  : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            </View>
          )}

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.divider} />
          </View>

          {/* Email Form */}
          <View style={styles.form}>
            {/* Display Name - Only for signup */}
            {mode === 'signup' && (
              <>
                <View style={styles.inputContainer}>
                  <User size={20} color={Colors.light.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, nameError ? styles.inputError : null]}
                    placeholder="Your Name"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={displayName}
                    onChangeText={(text) => {
                      setDisplayName(text);
                      setNameError('');
                    }}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
                {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
              </>
            )}

            {/* Email */}
            <View style={styles.inputContainer}>
              <Mail size={20} color={Colors.light.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, emailError ? styles.inputError : null]}
                placeholder="Email"
                placeholderTextColor={Colors.light.textTertiary}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

            {/* Password */}
            <View style={styles.inputContainer}>
              <Lock size={20} color={Colors.light.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, passwordError ? styles.inputError : null]}
                placeholder="Password"
                placeholderTextColor={Colors.light.textTertiary}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError('');
                }}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <EyeOff size={20} color={Colors.light.textTertiary} />
                ) : (
                  <Eye size={20} color={Colors.light.textTertiary} />
                )}
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

            {/* Confirm Password - Only for signup */}
            {mode === 'signup' && (
              <>
                <View style={styles.inputContainer}>
                  <Lock size={20} color={Colors.light.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, confirmError ? styles.inputError : null]}
                    placeholder="Confirm Password"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      setConfirmError('');
                    }}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                </View>
                {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}
                
                <Text style={styles.passwordHint}>
                  Password must be at least 8 characters
                </Text>
              </>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleEmailAuth}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.light.surface} />
              ) : (
                <View style={styles.submitButtonContent}>
                  <Text style={styles.submitButtonText}>
                    {mode === 'signup' ? 'Create Account' : 'Sign In'}
                  </Text>
                  <ChevronRight size={20} color={Colors.light.surface} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Toggle Mode */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
            </Text>
            <TouchableOpacity onPress={toggleMode} disabled={isLoading}>
              <Text style={styles.toggleText}>
                {mode === 'signup' ? 'Sign In' : 'Create one'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  socialButtons: {
    gap: 12,
    marginBottom: 24,
  },
  appleButton: {
    height: 50,
    width: '100%',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: Colors.light.text,
  },
  inputError: {
    borderColor: Colors.light.error,
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 13,
    color: Colors.light.error,
    marginTop: -8,
    marginLeft: 4,
  },
  passwordHint: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: -8,
    marginLeft: 4,
  },
  submitButton: {
    height: 54,
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  footerText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  toggleText: {
    fontSize: 15,
    color: Colors.light.accent,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.light.accent,
    fontWeight: '500',
  },
});
