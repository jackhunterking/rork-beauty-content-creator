import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Pressable, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Share2, Trash2, FolderOpen, Image as ImageIcon, Layers } from "lucide-react-native";
import React, { useState, useCallback, useMemo } from "react";
import * as Sharing from 'expo-sharing';
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const TILE_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP) / 2;

type FilterType = 'all' | 'single' | 'carousel';

const filters: { type: FilterType; label: string; icon: React.ReactNode }[] = [
  { type: 'all', label: 'All', icon: null },
  { type: 'single', label: 'Singles', icon: <ImageIcon size={14} color={Colors.light.text} /> },
  { type: 'carousel', label: 'Carousels', icon: <Layers size={14} color={Colors.light.text} /> },
];

export default function LibraryScreen() {
  const router = useRouter();
  const { library, deleteFromLibrary } = useApp();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filteredLibrary = useMemo(() => {
    if (activeFilter === 'all') return library;
    return library.filter(item => item.type === activeFilter);
  }, [library, activeFilter]);

  const handleShare = useCallback(async (e: any, assetId: string) => {
    e.stopPropagation();
    const asset = library.find(a => a.id === assetId);
    if (!asset) return;
    
    if (Platform.OS === 'web') {
      Alert.alert('Share', 'Sharing is available on mobile devices');
      return;
    }
    
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable && asset.outputUris[0]) {
        await Sharing.shareAsync(asset.outputUris[0]);
      }
    } catch (error) {
      console.log('Share error:', error);
    }
  }, [library]);

  const handleDelete = useCallback((e: any, assetId: string) => {
    e.stopPropagation();
    Alert.alert(
      'Delete',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteFromLibrary(assetId) },
      ]
    );
  }, [deleteFromLibrary]);

  const handleItemPress = useCallback((assetId: string) => {
    router.push({ pathname: '/library/viewer' as const, params: { id: assetId } });
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
      </View>

      <View style={styles.filterRow}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.type}
            style={[
              styles.filterChip,
              activeFilter === filter.type && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(filter.type)}
            activeOpacity={0.7}
          >
            {filter.icon}
            <Text style={[
              styles.filterLabel,
              activeFilter === filter.type && styles.filterLabelActive,
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredLibrary.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FolderOpen size={48} color={Colors.light.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyText}>
            Generated content will appear here
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {filteredLibrary.map((item) => (
              <Pressable
                key={item.id}
                style={styles.itemTile}
                onPress={() => handleItemPress(item.id)}
              >
                <Image
                  source={{ uri: item.thumbnailUri }}
                  style={styles.itemThumbnail}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.itemOverlay}>
                  <View style={styles.itemTypeBadge}>
                    {item.type === 'carousel' ? (
                      <Layers size={12} color={Colors.light.surface} />
                    ) : (
                      <ImageIcon size={12} color={Colors.light.surface} />
                    )}
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={styles.itemActionButton}
                      onPress={(e) => handleShare(e, item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Share2 size={14} color={Colors.light.surface} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.itemActionButton}
                      onPress={(e) => handleDelete(e, item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={14} color={Colors.light.surface} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: GRID_PADDING,
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterChipActive: {
    backgroundColor: Colors.light.text,
    borderColor: Colors.light.text,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  filterLabelActive: {
    color: Colors.light.surface,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  itemTile: {
    width: TILE_WIDTH,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  itemThumbnail: {
    width: '100%',
    height: '100%',
  },
  itemOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    justifyContent: 'space-between',
  },
  itemTypeBadge: {
    alignSelf: 'flex-start',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  itemActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
