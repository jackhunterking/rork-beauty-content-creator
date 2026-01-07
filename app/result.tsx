import { StyleSheet, View, Text, TouchableOpacity, Dimensions, ScrollView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Share2, Download, Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useState, useCallback, useMemo, useRef } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

const { width } = Dimensions.get('window');

export default function ResultScreen() {
  const router = useRouter();
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const { work, resetProject } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [saved, setSaved] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const asset = useMemo(() => 
    work.find(a => a.id === assetId),
    [work, assetId]
  );

  const handleShare = useCallback(async () => {
    if (!asset) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (Platform.OS === 'web') {
      Alert.alert('Share', 'Sharing is available on mobile devices');
      return;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable && asset.outputUris[currentSlide]) {
        await Sharing.shareAsync(asset.outputUris[currentSlide]);
      }
    } catch (error) {
      console.log('Share error:', error);
    }
  }, [asset, currentSlide]);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const handleDone = useCallback(() => {
    resetProject();
    router.push('/(tabs)/library');
  }, [resetProject, router]);

  const handleScroll = useCallback((event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / (width - 40));
    setCurrentSlide(slideIndex);
  }, []);

  const goToSlide = useCallback((index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * (width - 40), animated: true });
    setCurrentSlide(index);
  }, []);

  if (!asset) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.errorText}>Content not found</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const isCarousel = asset.type === 'carousel';

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View style={{ width: 60 }} />
          <View style={styles.successBadge}>
            <Check size={14} color={Colors.light.success} />
            <Text style={styles.successText}>Ready to share</Text>
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.previewContainer}>
          {isCarousel ? (
            <>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                contentContainerStyle={styles.carouselContent}
                decelerationRate="fast"
                snapToInterval={width - 40}
              >
                {asset.outputUris.map((uri, index) => (
                  <View key={index} style={styles.carouselSlide}>
                    <Image
                      source={{ uri }}
                      style={styles.slideImage}
                      contentFit="cover"
                    />
                    {index < 2 && (
                      <View style={styles.slideTag}>
                        <Text style={styles.slideTagText}>
                          {index === 0 ? 'BEFORE' : 'AFTER'}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
              <View style={styles.pagination}>
                {asset.outputUris.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.paginationDot,
                      currentSlide === index && styles.paginationDotActive,
                    ]}
                    onPress={() => goToSlide(index)}
                  />
                ))}
              </View>
              <View style={styles.slideNavigation}>
                <TouchableOpacity 
                  style={[styles.navButton, currentSlide === 0 && styles.navButtonDisabled]}
                  onPress={() => goToSlide(Math.max(0, currentSlide - 1))}
                  disabled={currentSlide === 0}
                >
                  <ChevronLeft size={20} color={currentSlide === 0 ? Colors.light.textTertiary : Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.slideCounter}>
                  {currentSlide + 1} / {asset.outputUris.length}
                </Text>
                <TouchableOpacity 
                  style={[styles.navButton, currentSlide === asset.outputUris.length - 1 && styles.navButtonDisabled]}
                  onPress={() => goToSlide(Math.min(asset.outputUris.length - 1, currentSlide + 1))}
                  disabled={currentSlide === asset.outputUris.length - 1}
                >
                  <ChevronRight size={20} color={currentSlide === asset.outputUris.length - 1 ? Colors.light.textTertiary : Colors.light.text} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.singlePreview}>
              <Image
                source={{ uri: asset.outputUris[0] }}
                style={styles.singleImage}
                contentFit="cover"
              />
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.8}>
            <Share2 size={20} color={Colors.light.surface} />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.actionButtonSecondary, saved && styles.actionButtonSaved]} 
            onPress={handleSave}
            activeOpacity={0.8}
          >
            {saved ? (
              <>
                <Check size={20} color={Colors.light.success} />
                <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary, { color: Colors.light.success }]}>Saved</Text>
              </>
            ) : (
              <>
                <Download size={20} color={Colors.light.text} />
                <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.text,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F4EC',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.success,
  },
  previewContainer: {
    flex: 1,
    paddingVertical: 16,
  },
  singlePreview: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  carouselContent: {
    paddingHorizontal: 20,
  },
  carouselSlide: {
    width: width - 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  slideTag: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  slideTagText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.surface,
    letterSpacing: 0.5,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.border,
  },
  paginationDotActive: {
    backgroundColor: Colors.light.text,
    width: 20,
  },
  slideNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  slideCounter: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.text,
    paddingVertical: 16,
    borderRadius: 14,
  },
  actionButtonSecondary: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  actionButtonSaved: {
    borderColor: Colors.light.success,
    backgroundColor: '#F0FBF3',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  actionButtonTextSecondary: {
    color: Colors.light.text,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 100,
  },
  backLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  backLinkText: {
    fontSize: 15,
    color: Colors.light.accent,
    fontWeight: '500' as const,
  },
});
