import React, { useCallback, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Platform, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Share2, Trash2, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { getFormatLabel } from '@/constants/formats';
import { useResponsive } from '@/hooks/useResponsive';

export default function PortfolioViewerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { portfolio, deleteFromPortfolio } = useApp();
  
  // Responsive configuration
  const responsive = useResponsive();

  const item = useMemo(() => 
    portfolio.find(p => p.id === id),
    [portfolio, id]
  );

  const handleShare = useCallback(async () => {
    if (!item) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (Platform.OS === 'web') {
      Alert.alert('Share', 'Sharing is available on mobile devices');
      return;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable && item.imageUrl) {
        await Sharing.shareAsync(item.imageUrl, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Share your creation',
        });
      }
    } catch (error) {
      console.log('Share error:', error);
    }
  }, [item]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete',
      'Are you sure you want to remove this from your portfolio?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            if (id) {
              try {
                await deleteFromPortfolio(id);
                router.back();
              } catch {
                // Error handled silently
              }
            }
          }
        },
      ]
    );
  }, [id, deleteFromPortfolio, router]);

  // Dynamic styles for responsive layout
  const dynamicStyles = useMemo(() => ({
    safeArea: {
      alignItems: responsive.isTablet ? 'center' as const : undefined,
    },
    contentContainer: {
      width: '100%' as const,
      maxWidth: responsive.isTablet ? 600 : undefined,
      flex: 1,
    },
    previewContainer: {
      paddingHorizontal: responsive.isTablet ? 40 : 20,
    },
    infoSection: {
      marginHorizontal: responsive.isTablet ? 40 : 20,
    },
    actions: {
      paddingHorizontal: responsive.isTablet ? 40 : 20,
    },
  }), [responsive]);

  if (!item) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]}>
          <Text style={styles.errorText}>Content not found</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const formattedDate = new Date(item.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Get platforms this was published to
  const publishedPlatforms = item.publishedTo?.length > 0 
    ? item.publishedTo.map(p => {
        switch (p) {
          case 'instagram_post': return 'Instagram Post';
          case 'instagram_story': return 'Instagram Story';
          case 'facebook_post': return 'Facebook';
          case 'tiktok': return 'TikTok';
          case 'download': return 'Downloaded';
          case 'share': return 'Shared';
          default: return p;
        }
      }).join(', ')
    : null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]} edges={['top', 'bottom']}>
        <View style={dynamicStyles.contentContainer}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <X size={22} color={Colors.light.text} />
            </TouchableOpacity>
            <View style={styles.meta}>
              <Text style={styles.metaFormat}>{getFormatLabel(item.format)}</Text>
              <Text style={styles.metaDate}>{formattedDate}</Text>
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Trash2 size={20} color={Colors.light.error} />
            </TouchableOpacity>
          </View>

          <View style={[styles.previewContainer, dynamicStyles.previewContainer]}>
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.image}
                contentFit="contain"
              />
            </View>
          </View>

          {/* Info section */}
          {publishedPlatforms && (
            <View style={[styles.infoSection, dynamicStyles.infoSection]}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Published to</Text>
                <Text style={styles.infoValue}>{publishedPlatforms}</Text>
              </View>
            </View>
          )}

          <View style={[styles.actions, dynamicStyles.actions]}>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.8}>
              <Share2 size={20} color={Colors.light.surface} />
              <Text style={styles.actionButtonText}>Share Again</Text>
            </TouchableOpacity>
          </View>
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
  metaFormat: {
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
  imageWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    padding: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  actions: {
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
