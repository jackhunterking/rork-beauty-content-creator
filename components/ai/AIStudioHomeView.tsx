/**
 * AI Studio Home View
 * 
 * Feature selection screen with 3 AI enhancement options.
 * Minimal design with image preview and feature cards.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import type { AIFeatureKey } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AIStudioHomeViewProps {
  imageUri: string;
  imageSize: { width: number; height: number };
  onSelectFeature: (featureKey: AIFeatureKey) => void;
  onSkip: () => void;
}

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}

function FeatureCard({ icon, title, description, onPress }: FeatureCardProps) {
  return (
    <TouchableOpacity
      style={styles.featureCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.featureIconContainer}>
        <Ionicons name={icon} size={24} color={Colors.light.accent} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription} numberOfLines={2}>
        {description}
      </Text>
    </TouchableOpacity>
  );
}

export default function AIStudioHomeView({
  imageUri,
  imageSize,
  onSelectFeature,
  onSkip,
}: AIStudioHomeViewProps) {
  // Calculate preview dimensions
  const maxPreviewHeight = 280;
  const aspectRatio = imageSize.width / imageSize.height;
  const previewWidth = Math.min(SCREEN_WIDTH - 48, maxPreviewHeight * aspectRatio);
  const previewHeight = previewWidth / aspectRatio;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI Studio</Text>
        <Text style={styles.subtitle}>Enhance your photo with AI</Text>
      </View>

      {/* Image Preview */}
      <View style={styles.previewContainer}>
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.preview,
            { width: previewWidth, height: previewHeight },
          ]}
          resizeMode="cover"
        />
      </View>

      {/* Feature Cards */}
      <View style={styles.featuresContainer}>
        <Text style={styles.sectionLabel}>Choose an enhancement</Text>
        
        <View style={styles.featuresRow}>
          <FeatureCard
            icon="sparkles"
            title="Ultra Quality"
            description="Sharpen and enhance image quality"
            onPress={() => onSelectFeature('auto_quality')}
          />
          
          <FeatureCard
            icon="cut-outline"
            title="Remove BG"
            description="Remove the background"
            onPress={() => onSelectFeature('background_remove')}
          />
          
          <FeatureCard
            icon="image-outline"
            title="Replace BG"
            description="Change to a new background"
            onPress={() => onSelectFeature('background_replace')}
          />
        </View>
      </View>

      {/* Skip Button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={onSkip}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Continue without AI</Text>
      </TouchableOpacity>
    </View>
  );
}

const CARD_WIDTH = (SCREEN_WIDTH - 48 - 24) / 3; // 48px padding, 24px gaps

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  preview: {
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  featuresContainer: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.ai.lightBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 11,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    lineHeight: 14,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  skipText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
});
