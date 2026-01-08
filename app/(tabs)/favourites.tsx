import { StyleSheet, View, Text, Pressable, Dimensions, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Star, Heart } from "lucide-react-native";
import React, { useCallback } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { Template, TemplateFormat } from "@/types";

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const TILE_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP) / 2;

// Dynamic tile height based on format
const getTileHeight = (format: TemplateFormat) => {
  switch (format) {
    case 'vertical':
      return TILE_WIDTH * 1.78; // 9:16 ratio
    case 'square':
    default:
      return TILE_WIDTH; // 1:1 ratio
  }
};

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
                style={[styles.templateTile, { height: getTileHeight(template.format) }]}
                onPress={() => handleTemplateSelect(template)}
              >
                <Image
                  source={{ uri: template.thumbnail }}
                  style={styles.templateThumbnail}
                  contentFit="cover"
                  transition={200}
                />
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
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    // Glass UI border effect
    borderWidth: 1,
    borderColor: Colors.light.glassEdge,
    // Subtle shadow for glass depth
    shadowColor: Colors.light.glassShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  templateThumbnail: {
    width: '100%',
    height: '100%',
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
