import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Star, Image as ImageIcon, Layers, Video } from "lucide-react-native";
import React, { useCallback } from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { ContentType } from "@/types";

const { width } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const TILE_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP) / 2;
const TILE_HEIGHT = TILE_WIDTH * 1.3;

const contentTypes: { type: ContentType; icon: React.ReactNode; label: string; disabled?: boolean }[] = [
  { type: 'single', icon: <ImageIcon size={20} color={Colors.light.text} />, label: 'Single' },
  { type: 'carousel', icon: <Layers size={20} color={Colors.light.textTertiary} />, label: 'Carousel', disabled: true },
  { type: 'video', icon: <Video size={20} color={Colors.light.textTertiary} />, label: 'Video', disabled: true },
];

export default function CreateScreen() {
  const router = useRouter();
  const { themes, currentProject, setContentType, selectTheme, toggleFavourite } = useApp();

  const handleContentTypeSelect = useCallback((type: ContentType) => {
    if (type === 'video' || type === 'carousel') return;
    setContentType(type);
  }, [setContentType]);

  const handleThemeSelect = useCallback((themeId: string) => {
    selectTheme(themeId);
    router.push('/capture/before');
  }, [selectTheme, router]);

  const handleToggleFavourite = useCallback((e: any, themeId: string) => {
    e.stopPropagation();
    toggleFavourite(themeId);
  }, [toggleFavourite]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Create</Text>
      </View>

      <View style={styles.typeSelector}>
        {contentTypes.map((item) => (
          <TouchableOpacity
            key={item.type}
            style={[
              styles.typeButton,
              currentProject.contentType === item.type && styles.typeButtonActive,
              item.disabled && styles.typeButtonDisabled,
            ]}
            onPress={() => handleContentTypeSelect(item.type)}
            disabled={item.disabled}
            activeOpacity={0.7}
          >
            {item.icon}
            <Text style={[
              styles.typeLabel,
              currentProject.contentType === item.type && styles.typeLabelActive,
              item.disabled && styles.typeLabelDisabled,
            ]}>
              {item.label}
            </Text>
            {item.disabled && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Soon</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {themes.map((theme) => (
            <Pressable
              key={theme.id}
              style={styles.themeTile}
              onPress={() => handleThemeSelect(theme.id)}
            >
              <Image
                source={{ uri: theme.thumbnail }}
                style={styles.themeThumbnail}
                contentFit="cover"
                transition={200}
              />
              <TouchableOpacity
                style={[styles.favouriteButton, theme.isFavourite && styles.favouriteButtonActive]}
                onPress={(e) => handleToggleFavourite(e, theme.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Star
                  size={16}
                  color={theme.isFavourite ? Colors.light.accent : Colors.light.surface}
                  fill={theme.isFavourite ? Colors.light.accent : 'transparent'}
                />
              </TouchableOpacity>
            </Pressable>
          ))}
        </View>
      </ScrollView>
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
  typeSelector: {
    flexDirection: 'row',
    paddingHorizontal: GRID_PADDING,
    gap: 10,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  typeButtonActive: {
    borderColor: Colors.light.accent,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  typeButtonDisabled: {
    opacity: 0.5,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  typeLabelActive: {
    color: Colors.light.accentDark,
  },
  typeLabelDisabled: {
    color: Colors.light.textTertiary,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.surface,
    textTransform: 'uppercase',
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
  themeTile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  themeThumbnail: {
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
