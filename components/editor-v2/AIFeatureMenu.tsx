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
  ImagePlus,
  Scissors,
  Sparkles,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { fetchAIConfig } from '@/services/aiService';
import type { AIFeatureKey, AIModelConfig } from '@/types';

/**
 * Get icon component for a feature - simple outlined style
 */
function getFeatureIcon(featureKey: AIFeatureKey, color: string, size: number = 16) {
  const strokeWidth = 1.8;
  switch (featureKey) {
    case 'background_replace':
      return <ImagePlus size={size} color={color} strokeWidth={strokeWidth} />;
    case 'background_remove':
      return <Scissors size={size} color={color} strokeWidth={strokeWidth} />;
    case 'auto_quality':
      return <Wand2 size={size} color={color} strokeWidth={strokeWidth} />;
    default:
      return <Sparkles size={size} color={color} strokeWidth={strokeWidth} />;
  }
}

/**
 * Get short display label for a feature - matches ElementContextBar labels
 */
function getFeatureLabel(featureKey: AIFeatureKey): string {
  switch (featureKey) {
    case 'background_replace':
      return 'Replace BG';
    case 'background_remove':
      return 'Remove BG';
    case 'auto_quality':
      return 'Auto-Quality';
    default:
      return 'AI';
  }
}

/**
 * AIBadge Component
 * 
 * Creates a badge effect where the icon is surrounded by a border,
 * but the top-right corner has a notch where "AI" text sits.
 */
function AIBadge({ children }: { children: React.ReactNode }) {
  return (
    <View style={aiBadgeStyles.container}>
      {/* Border with notch cutout */}
      <View style={aiBadgeStyles.borderContainer}>
        <View style={aiBadgeStyles.borderTop} />
        <View style={aiBadgeStyles.borderRight} />
        <View style={aiBadgeStyles.borderBottom} />
        <View style={aiBadgeStyles.borderLeft} />
      </View>
      
      {/* AI label positioned in the cutoff area */}
      <View style={aiBadgeStyles.aiLabelContainer}>
        <Text style={aiBadgeStyles.aiLabel}>AI</Text>
      </View>
      
      {/* Icon content */}
      <View style={aiBadgeStyles.content}>
        {children}
      </View>
    </View>
  );
}

const aiBadgeStyles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  borderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 12,
    height: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderTopLeftRadius: 6,
  },
  borderRight: {
    position: 'absolute',
    top: 10,
    right: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderBottomRightRadius: 6,
  },
  borderBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  borderLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.light.ai.primary,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  aiLabelContainer: {
    position: 'absolute',
    top: -2,
    right: -3,
    paddingHorizontal: 2,
    paddingVertical: 0,
    zIndex: 1,
  },
  aiLabel: {
    fontSize: 7,
    fontWeight: '700',
    color: Colors.light.ai.primary,
    letterSpacing: 0.2,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

interface AIFeatureButtonProps {
  feature: AIModelConfig;
  isProcessing: boolean;
  onPress: () => void;
}

function AIFeatureButton({ feature, isProcessing, onPress }: AIFeatureButtonProps) {
  const iconColor = Colors.light.ai.primary;
  
  return (
    <TouchableOpacity
      style={styles.featureButton}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={isProcessing}
    >
      {/* Icon with AI badge */}
      <View style={styles.featureIconContainer}>
        {isProcessing ? (
          <ActivityIndicator size="small" color={Colors.light.ai.primary} />
        ) : (
          <AIBadge>
            {getFeatureIcon(feature.featureKey, iconColor)}
          </AIBadge>
        )}
      </View>
      
      {/* Feature name - short labels matching ElementContextBar */}
      <Text style={styles.featureLabel} numberOfLines={1}>
        {getFeatureLabel(feature.featureKey)}
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
    minWidth: 70,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4, // Extra space between icon and label
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.light.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});

export default AIFeatureMenu;
