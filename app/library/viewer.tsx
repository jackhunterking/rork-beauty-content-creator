import { StyleSheet, View, Text, TouchableOpacity, Dimensions, ScrollView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Share2, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react-native";
import React, { useState, useCallback, useMemo, useRef } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

const { width } = Dimensions.get('window');

export default function LibraryViewerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { library, deleteFromLibrary } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const asset = useMemo(() => 
    library.find(a => a.id === id),
    [library, id]
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

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            if (id) {
              deleteFromLibrary(id);
              router.back();
            }
          }
        },
      ]
    );
  }, [id, deleteFromLibrary, router]);

  const handleScroll = useCallback((event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentSlide(slideIndex);
  }, []);

  const goToSlide = useCallback((index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
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
  const formattedDate = new Date(asset.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <X size={22} color={Colors.light.text} />
          </TouchableOpacity>
          <View style={styles.meta}>
            <Text style={styles.metaType}>{isCarousel ? 'Carousel' : 'Single'}</Text>
            <Text style={styles.metaDate}>{formattedDate}</Text>
          </View>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Trash2 size={20} color={Colors.light.error} />
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
                decelerationRate="fast"
              >
                {asset.outputUris.map((uri, index) => (
                  <View key={index} style={styles.carouselSlide}>
                    <Image
                      source={{ uri }}
                      style={styles.slideImage}
                      contentFit="contain"
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
                contentFit="contain"
              />
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.8}>
            <Share2 size={20} color={Colors.light.surface} />
            <Text style={styles.actionButtonText}>Share</Text>
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
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    alignItems: 'center',
  },
  metaType: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  metaDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    flex: 1,
    paddingVertical: 16,
  },
  singlePreview: {
    flex: 1,
    marginHorizontal: 20,
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  carouselSlide: {
    width: width,
    paddingHorizontal: 20,
  },
  slideImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  slideTag: {
    position: 'absolute',
    top: 16,
    left: 36,
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.text,
    paddingVertical: 16,
    borderRadius: 14,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.surface,
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
