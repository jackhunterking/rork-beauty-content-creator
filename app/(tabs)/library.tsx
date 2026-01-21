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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Pencil,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { Draft, TemplateFormat } from '@/types';
import { getDraftPreviewUri } from '@/services/imageUtils';
import { getAllFormats, getDefaultFormat, getFormatById, getFormatLabel, FormatConfig } from '@/constants/formats';
import { useResponsive } from '@/hooks/useResponsive';
import { getProjectDisplayName } from '@/utils/projectName';
import RenameProjectModal from '@/components/RenameProjectModal';

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
  const insets = useSafeAreaInsets();
  const { 
    drafts,
    templates,
    loadDraft,
    isDraftsLoading,
    refreshDrafts,
    duplicateDraft,
    deleteDraft,
    renameDraft,
    isDuplicatingDraft,
    isRenamingDraft,
  } = useApp();

  // Responsive configuration
  const responsive = useResponsive();
  

  // Bottom sheet ref and selected draft state
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  
  // Rename modal state
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [draftToRename, setDraftToRename] = useState<Draft | null>(null);

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

  // Handle opening bottom sheet (three dots on project row)
  const handleOpenActionSheet = useCallback((draft: Draft) => {
    setSelectedDraft(draft);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  // Handle closing bottom sheet
  const handleCloseActionSheet = useCallback(() => {
    bottomSheetRef.current?.close();
    setSelectedDraft(null);
  }, []);

  // Handle rename action - open rename modal
  const handleOpenRenameModal = useCallback(() => {
    if (!selectedDraft) return;
    setDraftToRename(selectedDraft);
    handleCloseActionSheet();
    // Small delay to let the bottom sheet close first
    setTimeout(() => {
      setIsRenameModalVisible(true);
    }, 200);
  }, [selectedDraft, handleCloseActionSheet]);

  // Handle save rename
  const handleSaveRename = useCallback(async (newName: string | null) => {
    if (!draftToRename) return;
    
    try {
      await renameDraft(draftToRename.id, newName);
      setIsRenameModalVisible(false);
      setDraftToRename(null);
    } catch (error) {
      console.error('Failed to rename project:', error);
      Alert.alert('Error', 'Failed to rename project. Please try again.');
    }
  }, [draftToRename, renameDraft]);

  // Handle cancel rename
  const handleCancelRename = useCallback(() => {
    setIsRenameModalVisible(false);
    setDraftToRename(null);
  }, []);

  // Handle duplicate draft
  const handleDuplicateDraft = useCallback(async () => {
    if (!selectedDraft) return;
    
    handleCloseActionSheet();
    
    try {
      const newDraft = await duplicateDraft(selectedDraft.id);
      
      // Get template for the duplicated draft
      const template = getTemplateForDraft(newDraft.templateId);
      
      if (template) {
        // Load the duplicated draft directly and navigate to editor
        loadDraft(newDraft, template);
        router.push('/editor-v2');
      } else {
        // Fallback: show alert if template not found
        Alert.alert('Error', 'Could not find template for duplicated project.');
      }
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

  // Thumbnail dimensions - width is fixed, height varies by aspect ratio
  const thumbnailWidth = 72;
  
  // Calculate thumbnail height based on format aspect ratio
  const getThumbnailHeight = useCallback((format: string): number => {
    const formatConfig = getFormatById(format);
    if (!formatConfig) return thumbnailWidth; // Default to square
    // Height = Width / AspectRatio (since aspectRatio = width/height)
    return Math.round(thumbnailWidth / formatConfig.aspectRatio);
  }, []);

  // Get selected draft info for bottom sheet header
  const selectedPreviewUri = selectedDraft ? getDraftPreviewUri(selectedDraft) : null;
  const selectedTemplate = selectedDraft ? getTemplateForDraft(selectedDraft.templateId) : null;
  const selectedDisplayName = selectedDraft ? getProjectDisplayName(selectedDraft) : 'Project';
  const selectedThumbnailHeight = selectedTemplate ? getThumbnailHeight(selectedTemplate.format) : 48;

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
    listContainer: {
      paddingHorizontal: responsive.gridPadding,
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
          contentContainerStyle={[styles.listContainer, dynamicStyles.listContainer]}
          showsVerticalScrollIndicator={false}
        >
          {filteredProjects.map((draft) => {
            const template = getTemplateForDraft(draft.templateId);
            const previewUri = getDraftPreviewUri(draft);
            const format = template?.format || '1:1';
            const displayName = getProjectDisplayName(draft);
            const thumbnailHeight = getThumbnailHeight(format);
            
            return (
              <Pressable
                key={draft.id}
                style={styles.projectRow}
                onPress={() => handleResumeProject(draft)}
              >
                {/* Thumbnail - dynamic aspect ratio based on template format */}
                <View style={[styles.thumbnailContainer, { width: thumbnailWidth, height: thumbnailHeight }]}>
                  {previewUri ? (
                    <Image
                      key={`project-preview-${draft.id}-${draft.updatedAt}`}
                      source={{ uri: previewUri }}
                      style={styles.thumbnail}
                      contentFit="cover"
                      transition={200}
                      cachePolicy={previewUri.startsWith('file://') ? 'memory' : 'memory-disk'}
                    />
                  ) : (
                    <View style={styles.thumbnailPlaceholder}>
                      <ImageIcon size={24} color={Colors.light.textTertiary} />
                    </View>
                  )}
                </View>

                {/* Project Info */}
                <View style={styles.projectInfo}>
                  <Text style={styles.projectName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.projectFormat}>
                    {getFormatLabel(format)}
                  </Text>
                </View>

                {/* Three Dots Menu */}
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => handleOpenActionSheet(draft)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MoreHorizontal size={20} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </Pressable>
            );
          })}
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
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <BottomSheetView style={[styles.bottomSheetContent, { paddingBottom: insets.bottom + 12 }]}>
          {/* Header with preview - dynamic aspect ratio */}
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetPreviewContainer, { height: Math.min(selectedThumbnailHeight * 48 / thumbnailWidth, 80) }]}>
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
                {selectedDisplayName}
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
              onPress={handleOpenRenameModal}
              activeOpacity={0.7}
            >
              <Pencil size={22} color={Colors.light.text} />
              <Text style={styles.actionText}>Rename</Text>
            </TouchableOpacity>

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

      {/* Rename Modal */}
      <RenameProjectModal
        visible={isRenameModalVisible}
        currentName={draftToRename?.projectName || null}
        onSave={handleSaveRename}
        onCancel={handleCancelRename}
        isLoading={isRenamingDraft}
      />
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
  
  // List View
  scrollView: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 20,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  thumbnailContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  projectFormat: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  moreButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
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
