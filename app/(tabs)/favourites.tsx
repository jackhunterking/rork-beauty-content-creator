import { StyleSheet, View, Text, Pressable, Dimensions, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Star, Heart } from "lucide-react-native";
import React, { useCallback } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { Template } from "@/types";

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const TILE_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP) / 2;
const TILE_HEIGHT = TILE_WIDTH * 1.3;

export default function FavouritesScreen() {
  const router = useRouter();
  const { favouriteTemplates, selectTemplate, toggleFavourite } = useApp();

  const handleTemplateSelect = useCallback((template: Template) => {
    selectTemplate(template);
    router.push('/editor');
  }, [selectTemplate, router]);

  const handleToggleFavourite = useCallback((e: any, templateId: string) => {
    e.stopPropagation();
    toggleFavourite(templateId);
  }, [toggleFavourite]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Favourites</Text>
      </View>

      {favouriteTemplates.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Heart size={48} color={Colors.light.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No favourites yet</Text>
          <Text style={styles.emptyText}>
            Star templates you love for quick access
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {favouriteTemplates.map((template) => (
              <Pressable
                key={template.id}
                style={styles.templateTile}
                onPress={() => handleTemplateSelect(template)}
              >
                <Image
                  source={{ uri: template.thumbnail }}
                  style={styles.templateThumbnail}
                  contentFit="cover"
                  transition={200}
                />
                {/* Template info badge */}
                <View style={styles.templateInfoBadge}>
                  <Text style={styles.templateInfoText}>
                    {template.canvasWidth}x{template.canvasHeight}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.favouriteButton, styles.favouriteButtonActive]}
                  onPress={(e) => handleToggleFavourite(e, template.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Star
                    size={16}
                    color={Colors.light.accent}
                    fill={Colors.light.accent}
                  />
                </TouchableOpacity>
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
  templateTile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  templateThumbnail: {
    width: '100%',
    height: '100%',
  },
  templateInfoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  templateInfoText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.surface,
  },
  favouriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favouriteButtonActive: {
    backgroundColor: Colors.light.surface,
  },
});
