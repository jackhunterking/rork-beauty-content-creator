/**
 * Auto Quality View
 * Minimal UI for quality enhancement.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import Colors from '@/constants/colors';
import { enhanceQuality, AIProcessingProgress } from '@/services/aiService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = 380;
const IMAGE_WIDTH = SCREEN_WIDTH * 0.8;

interface AutoQualityViewProps {
  imageUri: string;
  imageSize: { width: number; height: number };
  onBack: () => void;
  onStartProcessing: () => void;
  onProgress: (progress: AIProcessingProgress) => void;
  getAbortSignal: () => AbortSignal | undefined;
}

export default function AutoQualityView({
  imageUri,
  onBack,
  onStartProcessing,
  onProgress,
  getAbortSignal,
}: AutoQualityViewProps) {
  const handleEnhance = useCallback(async () => {
    onStartProcessing();
    await enhanceQuality(imageUri, onProgress, getAbortSignal());
  }, [imageUri, onStartProcessing, onProgress, getAbortSignal]);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="close" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Auto Quality</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.imageContainer}>
          <View style={styles.imageWrapper}>
            <ExpoImage
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
          </View>
          <Text style={styles.description}>
            Enhance resolution and sharpen details with AI
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 }]}>
        <TouchableOpacity style={styles.button} onPress={handleEnhance} activeOpacity={0.8}>
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Improve Quality With AI</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
  },
  placeholder: {
    width: 40,
  },
  imageContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  imageWrapper: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 2,
    borderColor: Colors.light.accent,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  description: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  // STANDARD FOOTER - same across all AI views
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.light.background,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.text,
    borderRadius: 14,
    paddingVertical: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});
