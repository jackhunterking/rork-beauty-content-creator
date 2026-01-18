import React, { useCallback, useMemo, useState, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import {
  Image as ImageIcon,
  Square,
  RectangleVertical,
  RectangleHorizontal,
  FolderOpen,
  Plus,
  MoreHorizontal,
  Copy,
  Trash2,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { Draft, TemplateFormat } from '@/types';
import { getDraftPreviewUri } from '@/services/imageUtils';
import { getAllFormats, getDefaultFormat, getFormatById, getFormatLabel, FormatConfig } from '@/constants/formats';
import { useResponsive, getResponsiveTileHeight } from '@/hooks/useResponsive';

// Helper to get icon component for a format config
const getFormatIcon = (config: FormatConfig, active: boolean) => {
  const color = active ? Colors.light.accentDark : Colors.light.text;
  switch (config.icon) {
    case 'square':
      return <Square size={18} color={color} />;
    case 'landscape':
      return <RectangleHorizontal size={18} color={color} />;
    case 'portrait':
    default:
      return <RectangleVertical size={18} color={color} />;
  }
};

// Generate format filters dynamically from centralized config
const formatFilters = getAllFormats().map(config => ({
  format: config.id as TemplateFormat,
  icon: (active: boolean) => getFormatIcon(config, active),
  label: config.id,
}));

export default function ProjectsScreen() {
  const router = useRouter();
  const { 
    drafts,
    templates,
    loadDraft,
    isDraftsLoading,
    refreshDrafts,
    duplicateDraft,
    deleteDraft,
    isDuplicatingDraft,
  } = useApp();

  // Responsive configuration
  const responsive = useResponsive();

  // Bottom sheet ref and selected draft state
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);

  // Refresh projects whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      refreshDrafts();
    }, [refreshDrafts])
  );

  // Local state for format filter - use centralized default
  const [selectedFormat, setSelectedFormat] = useState<TemplateFormat>(getDefaultFormat() as TemplateFormat);

  // Get template for a draft
  const getTemplateForDraft = useCallback((templateId: string) => 
    templates.find(t => t.id === templateId), 
    [templates]
  );

  // Dynamic tile height calculation
  const getTileHeight = useCallback((format: TemplateFormat) => {
    const config = getFormatById(format);
    if (config) {
      return getResponsiveTileHeight(responsive.tileWidth, config.aspectRatio);
    }
    return responsive.tileWidth;
  }, [responsive.tileWidth]);

  // Filter projects by format
  const filteredProjects = useMemo(() => {
    return drafts.filter(draft => {
      const template = getTemplateForDraft(draft.templateId);
      return template?.format === selectedFormat;
    });
  }, [drafts, selectedFormat, getTemplateForDraft, templates.length]);

  // Handle format filter selection
  const handleFormatSelect = useCallback((format: TemplateFormat) => {
    setSelectedFormat(format);
  }, []);

  // Handle resume project (open in editor)
  const handleResumeProject = useCallback((draft: Draft) => {
    const template = getTemplateForDraft(draft.templateId);
    if (!template) return;
    
    loadDraft(draft, template);
    router.push('/editor-v2');
  }, [getTemplateForDraft, loadDraft, router]);

  // Handle start creating
  const handleStartCreating = useCallback(() => {
    router.push('/(tabs)');
  }, [router]);

  // Handle opening bottom sheet (long press on project)
  const handleOpenActionSheet = useCallback((draft: Draft) => {
    setSelectedDraft(draft);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  // Handle closing bottom sheet
  const handleCloseActionSheet = useCallback(() => {
    bottomSheetRef.current?.close();
    setSelectedDraft(null);
  }, []);

  // Handle duplicate draft
  const handleDuplicateDraft = useCallback(async () => {
    if (!selectedDraft) return;
    
    handleCloseActionSheet();
    
    try {
      const newDraft = await duplicateDraft(selectedDraft.id);
      // Show success feedback
      Alert.alert(
        'Project Duplicated',
        'A copy of your project has been created.',
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Open Copy', 
            style: 'default',
            onPress: () => {
              const template = getTemplateForDraft(newDraft.templateId);
              if (template) {
                loadDraft(newDraft, template);
                router.push('/editor-v2');
              }
            }
          },
        ]
      );
    } catch (error) {
      console.error('Failed to duplicate draft:', error);
      Alert.alert('Error', 'Failed to duplicate project. Please try again.');
    }
  }, [selectedDraft, handleCloseActionSheet, duplicateDraft, getTemplateForDraft, loadDraft, router]);

  // Handle delete draft with confirmation
  const handleDeleteDraft = useCallback(async () => {
    if (!selectedDraft) return;
    
    handleCloseActionSheet();
    
    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDraft(selectedDraft.id);
            } catch (error) {
              console.error('Failed to delete draft:', error);
              Alert.alert('Error', 'Failed to delete project. Please try again.');
            }
          }
        },
      ]
    );
  }, [selectedDraft, handleCloseActionSheet, deleteDraft]);

  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['35%'], []);

  // Render bottom sheet backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  // Get selected draft info for bottom sheet header
  const selectedTemplate = selectedDraft ? getTemplateForDraft(selectedDraft.templateId) : null;
  const selectedPreviewUri = selectedDraft ? getDraftPreviewUri(selectedDraft) : null;

  // Dynamic styles based on responsive configuration
  const dynamicStyles = useMemo(() => ({
    header: {
      paddingHorizontal: responsive.gridPadding,
    },
    title: {
      fontSize: responsive.headerFontSize,
    },
    filterSection: {
      paddingHorizontal: responsive.gridPadding,
    },
    gridContainer: {
      paddingHorizontal: responsive.gridPadding,
      alignItems: responsive.isTablet ? 'center' as const : undefined,
    },
    grid: {
      gap: responsive.gridGap,
      maxWidth: responsive.isTablet 
        ? responsive.columns * responsive.tileWidth + (responsive.columns - 1) * responsive.gridGap 
        : undefined,
    },
    projectTile: {
      width: responsive.tileWidth,
    },
  }), [responsive]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, dynamicStyles.header]}>
        <Text style={[styles.title, dynamicStyles.title]}>Projects</Text>
      </View>

      {/* Format Filter Row */}
      <View style={[styles.filterSection, dynamicStyles.filterSection]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {formatFilters.map((item) => {
            const isActive = selectedFormat === item.format;
            return (
              <TouchableOpacity
                key={item.format}
                style={[
                  styles.formatButton,
                  isActive && styles.formatButtonActive,
                ]}
                onPress={() => handleFormatSelect(item.format)}
                activeOpacity={0.7}
              >
                {item.icon(isActive)}
                <Text style={[
                  styles.formatLabel,
                  isActive && styles.formatLabelActive,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isDraftsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : filteredProjects.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FolderOpen size={48} color={Colors.light.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>
            {drafts.length === 0 ? 'No projects yet' : `No ${selectedFormat} projects`}
          </Text>
          <Text style={styles.emptyText}>
            {drafts.length === 0 
              ? 'Your saved projects will appear here. Start creating and save your work!'
              : `You don't have any ${getFormatLabel(selectedFormat)} projects yet.`
            }
          </Text>
          {drafts.length === 0 && (
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleStartCreating}
              activeOpacity={0.8}
            >
              <Plus size={20} color={Colors.light.surface} />
              <Text style={styles.emptyButtonText}>Start Creating</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.gridContainer, dynamicStyles.gridContainer]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.grid, dynamicStyles.grid]}>
            {filteredProjects.map((draft) => {
              const template = getTemplateForDraft(draft.templateId);
              const previewUri = getDraftPreviewUri(draft);
              const format = template?.format || '1:1';
              
              return (
                <Pressable
                  key={draft.id}
                  style={[
                    styles.projectTile,
                    dynamicStyles.projectTile,
                    { height: getTileHeight(format) }
                  ]}
                  onPress={() => handleResumeProject(draft)}
                  onLongPress={() => handleOpenActionSheet(draft)}
                  delayLongPress={400}
                >
                  {previewUri ? (
                    <Image
                      key={`project-preview-${draft.id}-${draft.updatedAt}`}
                      source={{ uri: previewUri }}
                      style={styles.projectThumbnail}
                      contentFit="cover"
                      transition={200}
                      // For local files, disable disk caching to ensure fresh content
                      // Local preview files change content without changing path
                      cachePolicy={previewUri.startsWith('file://') ? 'memory' : 'memory-disk'}
                    />
                  ) : (
                    <View style={styles.projectPlaceholder}>
                      <ImageIcon size={32} color={Colors.light.textTertiary} />
                    </View>
                  )}
                  
                  {/* More button overlay */}
                  <TouchableOpacity
                    style={styles.moreButtonOverlay}
                    onPress={() => handleOpenActionSheet(draft)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MoreHorizontal size={20} color={Colors.light.surface} />
                  </TouchableOpacity>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Loading overlay for duplication */}
      {isDuplicatingDraft && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.light.accent} />
            <Text style={styles.loadingOverlayText}>Duplicating project...</Text>
          </View>
        </View>
      )}

      {/* Action Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {/* Header with preview */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetPreviewContainer}>
              {selectedPreviewUri ? (
                <Image
                  source={{ uri: selectedPreviewUri }}
                  style={styles.sheetPreview}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.sheetPreviewPlaceholder}>
                  <ImageIcon size={20} color={Colors.light.textTertiary} />
                </View>
              )}
            </View>
            <View style={styles.sheetTitleContainer}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {selectedTemplate?.name || 'Project'}
              </Text>
              <Text style={styles.sheetSubtitle}>
                {selectedTemplate ? getFormatLabel(selectedTemplate.format) : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.sheetCloseButton}
              onPress={handleCloseActionSheet}
              activeOpacity={0.7}
            >
              <X size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.sheetDivider} />

          {/* Actions */}
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleDuplicateDraft}
              activeOpacity={0.7}
            >
              <Copy size={22} color={Colors.light.text} />
              <Text style={styles.actionText}>Duplicate Project</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleDeleteDraft}
              activeOpacity={0.7}
            >
              <Trash2 size={22} color={Colors.light.error} />
              <Text style={[styles.actionText, styles.actionTextDestructive]}>
                Delete Project
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: -0.5,
  },
  
  // Filter Section
  filterSection: {
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  formatButtonActive: {
    borderColor: Colors.light.accent,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  formatLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  formatLabelActive: {
    color: Colors.light.accentDark,
    fontWeight: '600' as const,
  },
  
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
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
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: Colors.light.text,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  
  // Grid
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  
  // Project Tile
  projectTile: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.glassEdge,
    shadowColor: Colors.light.glassShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  projectThumbnail: {
    width: '100%',
    height: '100%',
  },
  projectPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // More button overlay on tiles
  moreButtonOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Loading overlay for duplication
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingOverlayText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  
  // Bottom Sheet
  bottomSheetIndicator: {
    backgroundColor: Colors.light.border,
    width: 36,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetPreviewContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  sheetPreview: {
    width: '100%',
    height: '100%',
  },
  sheetPreviewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  sheetActions: {
    paddingTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  actionText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  actionTextDestructive: {
    color: Colors.light.error,
  },
});
