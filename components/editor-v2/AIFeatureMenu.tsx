/**
 * AIFeatureMenu Component
 * 
 * Inline expandable menu for AI feature selection.
 * Appears above the context bar or main toolbar when AI is tapped.
 * Matches the minimal style of other inline menus (font size, color picker).
 * Uses simple outlined icons to match the rest of the editor UI.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import {
  Wand2,
  Scissors,
  ImagePlus,
  Sparkles,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { fetchAIConfig } from '@/services/aiService';
import type { AIFeatureKey, AIModelConfig } from '@/types';

/**
 * Get icon component for a feature - simple outlined style
 */
function getFeatureIcon(featureKey: AIFeatureKey, color: string, size: number = 22) {
  const strokeWidth = 1.8;
  switch (featureKey) {
    case 'background_remove':
      return <Scissors size={size} color={color} strokeWidth={strokeWidth} />;
    case 'background_replace':
      return <ImagePlus size={size} color={color} strokeWidth={strokeWidth} />;
    case 'auto_quality':
      return <Wand2 size={size} color={color} strokeWidth={strokeWidth} />;
    default:
      return <Sparkles size={size} color={color} strokeWidth={strokeWidth} />;
  }
}

interface AIFeatureButtonProps {
  feature: AIModelConfig;
  isProcessing: boolean;
  onPress: () => void;
}

function AIFeatureButton({ feature, isProcessing, onPress }: AIFeatureButtonProps) {
  const iconColor = Colors.light.text;
  
  return (
    <TouchableOpacity
      style={styles.featureButton}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={isProcessing}
    >
      {/* Simple icon - matches other toolbar items */}
      <View style={styles.featureIconContainer}>
        {isProcessing ? (
          <ActivityIndicator size="small" color={Colors.light.ai.primary} />
        ) : (
          getFeatureIcon(feature.featureKey, iconColor)
        )}
      </View>
      
      {/* Feature name - same style as other action labels */}
      <Text style={styles.featureLabel} numberOfLines={1}>
        {feature.displayName}
      </Text>
    </TouchableOpacity>
  );
}

interface AIFeatureMenuProps {
  /** Whether user has premium access */
  isPremium: boolean;
  /** Whether an enhancement is currently processing */
  isProcessing: boolean;
  /** Currently processing feature key */
  processingType: AIFeatureKey | null;
  /** Called when a feature is selected */
  onSelectFeature: (featureKey: AIFeatureKey) => void;
  /** Called to request premium access */
  onRequestPremium: (feature: string) => void;
  /** Called when menu is closed (optional - parent handles closing) */
  onClose?: () => void;
}

export function AIFeatureMenu({
  isPremium,
  isProcessing,
  processingType,
  onSelectFeature,
  onRequestPremium,
}: AIFeatureMenuProps) {
  // Feature config state
  const [features, setFeatures] = useState<AIModelConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load AI config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const config = await fetchAIConfig();
      setFeatures(config);
    } catch (err: any) {
      console.error('[AIFeatureMenu] Config load error:', err);
      setError(err.message || 'Failed to load AI features');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeaturePress = useCallback((feature: AIModelConfig) => {
    // Check premium access
    if (feature.isPremiumOnly && !isPremium) {
      onRequestPremium(`ai_${feature.featureKey}`);
      return;
    }
    
    // Select the feature
    onSelectFeature(feature.featureKey);
  }, [isPremium, onSelectFeature, onRequestPremium]);

  // Loading state - show minimal loader
  if (isLoading) {
    return (
      <Animated.View 
        style={styles.container}
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.light.ai.primary} />
        </View>
      </Animated.View>
    );
  }

  // Error state - show retry option
  if (error) {
    return (
      <Animated.View 
        style={styles.container}
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
      >
        <TouchableOpacity 
          style={styles.errorButton}
          onPress={loadConfig}
          activeOpacity={0.7}
        >
          <Text style={styles.errorText}>Tap to retry</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View 
      style={styles.container}
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {features.map((feature) => (
          <AIFeatureButton
            key={`ai-feature-${feature.featureKey}`}
            feature={feature}
            isProcessing={isProcessing && processingType === feature.featureKey}
            onPress={() => handleFeaturePress(feature)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 8,
    gap: 4,
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  featureButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    minWidth: 60,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginTop: 2,
  },
});

export default AIFeatureMenu;
