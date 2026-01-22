/**
 * Premium AI Prompt
 * 
 * Shown to non-premium users when they try to access AI features.
 * Provides compelling upgrade messaging and CTA.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/colors';

interface PremiumAIPromptProps {
  onUpgrade: () => void;
  onClose: () => void;
}

const FEATURES = [
  {
    icon: 'sparkles' as const,
    title: 'Ultra Quality',
    description: '2x AI upscaling & sharpening',
  },
  {
    icon: 'image-outline' as const,
    title: 'Replace Background',
    description: 'Professional studio backgrounds',
  },
];

export default function PremiumAIPrompt({
  onUpgrade,
  onClose,
}: PremiumAIPromptProps) {
  return (
    <View style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
      </TouchableOpacity>
      
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[Colors.light.accent, Colors.light.accentDark]}
            style={styles.iconGradient}
          >
            <Ionicons name="sparkles" size={40} color="#FFFFFF" />
          </LinearGradient>
        </View>
        
        <Text style={styles.title}>Unlock AI Studio</Text>
        <Text style={styles.subtitle}>
          Take your photos to the next level with professional AI enhancements
        </Text>
      </View>
      
      {/* Features List */}
      <View style={styles.featuresSection}>
        {FEATURES.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons
                name={feature.icon}
                size={22}
                color={Colors.light.accent}
              />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={Colors.light.success}
            />
          </View>
        ))}
      </View>
      
      {/* Unlimited Badge */}
      <View style={styles.unlimitedBadge}>
        <Ionicons name="infinite" size={18} color={Colors.light.accent} />
        <Text style={styles.unlimitedText}>Unlimited AI enhancements</Text>
      </View>
      
      {/* CTA */}
      <View style={styles.ctaSection}>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={onUpgrade}
          activeOpacity={0.8}
        >
          <Ionicons name="star" size={20} color="#FFFFFF" />
          <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 24,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  featuresSection: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.ai.lightBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  unlimitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.ai.lightBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'center',
    marginBottom: 24,
  },
  unlimitedText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
    marginLeft: 8,
  },
  ctaSection: {
    marginTop: 'auto',
    paddingBottom: 16,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    borderRadius: 14,
    paddingVertical: 18,
    width: '100%',
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
});
