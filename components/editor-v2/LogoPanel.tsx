/**
 * LogoPanel Component
 * 
 * Compact bottom panel for selecting and managing logo overlays.
 * Follows Canva's pattern: 25% height, horizontal layout,
 * brand kit integration, and upload options.
 */

import React, { useState, useCallback, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import {
  X,
  ImageIcon,
  Upload,
  Briefcase,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { getBrandLogo, saveBrandLogo } from '@/services/brandKitService';
import { LogoOverlay, LOGO_SIZE_CONSTRAINTS } from '@/types/overlays';

interface BrandLogoData {
  uri: string;
  width: number;
  height: number;
}

type PanelMode = 'picker' | 'editor';

export interface LogoPanelProps {
  /** Currently selected logo overlay (for editing mode) */
  selectedLogo?: LogoOverlay | null;
  /** Current scale value (for editing mode) */
  currentScale?: number;
  /** Called when a logo is selected */
  onSelectLogo: (logoData: { uri: string; width: number; height: number }) => void;
  /** Called when scale changes */
  onScaleChange?: (scale: number) => void;
  /** Called when logo is deleted */
  onDeleteLogo?: () => void;
  /** Called when panel is closed */
  onClose?: () => void;
}

export interface LogoPanelRef {
  openPicker: () => void;
  openEditor: () => void;
  close: () => void;
}

export const LogoPanel = forwardRef<LogoPanelRef, LogoPanelProps>(
  function LogoPanel(
    {
      selectedLogo,
      currentScale = 1,
      onSelectLogo,
      onScaleChange,
      onDeleteLogo,
      onClose,
    },
    ref
  ) {
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheet>(null);
    const [mode, setMode] = useState<PanelMode>('picker');
    const [brandLogo, setBrandLogo] = useState<BrandLogoData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Calculate bottom padding with safe area
    const bottomPadding = insets.bottom + 12;

    // Load brand kit logo on mount
    useEffect(() => {
      loadBrandLogo();
    }, []);

    const loadBrandLogo = useCallback(async () => {
      try {
        const logo = await getBrandLogo();
        setBrandLogo(logo);
      } catch (error) {
        console.error('[LogoPanel] Failed to load brand logo:', error);
      }
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      openPicker: () => {
        setMode('picker');
        loadBrandLogo();
        bottomSheetRef.current?.snapToIndex(0);
      },
      openEditor: () => {
        setMode('editor');
        bottomSheetRef.current?.snapToIndex(0);
      },
      close: () => {
        bottomSheetRef.current?.close();
        onClose?.();
      },
    }));

    // Handle close
    const handleClose = useCallback(() => {
      bottomSheetRef.current?.close();
      onClose?.();
    }, [onClose]);

    // Handle sheet changes
    const handleSheetChange = useCallback(
      (index: number) => {
        if (index === -1) {
          onClose?.();
        }
      },
      [onClose]
    );

    // Render backdrop
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.3}
          pressBehavior="close"
        />
      ),
      []
    );

    // Handle using brand kit logo
    const handleUseBrandLogo = useCallback(() => {
      if (brandLogo) {
        onSelectLogo({
          uri: brandLogo.uri,
          width: brandLogo.width,
          height: brandLogo.height,
        });
        handleClose();
      }
    }, [brandLogo, onSelectLogo, handleClose]);

    // Handle picking image from library
    const handlePickImage = useCallback(async () => {
      try {
        setIsLoading(true);
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: false,
        });

        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const imageData = {
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
          };

          // If user has no brand logo, offer to save it
          if (!brandLogo) {
            Alert.alert(
              'Save to Brand Kit?',
              'Would you like to save this logo to your brand kit for future use?',
              [
                {
                  text: 'Just Use',
                  style: 'cancel',
                  onPress: () => {
                    onSelectLogo(imageData);
                    handleClose();
                  },
                },
                {
                  text: 'Save & Use',
                  onPress: async () => {
                    setIsSaving(true);
                    try {
                      const saveResult = await saveBrandLogo(imageData.uri);
                      if (saveResult.success && saveResult.brandKit.logoUri) {
                        onSelectLogo({
                          uri: saveResult.brandKit.logoUri,
                          width: saveResult.brandKit.logoWidth || imageData.width,
                          height: saveResult.brandKit.logoHeight || imageData.height,
                        });
                        setBrandLogo({
                          uri: saveResult.brandKit.logoUri,
                          width: saveResult.brandKit.logoWidth || imageData.width,
                          height: saveResult.brandKit.logoHeight || imageData.height,
                        });
                      } else {
                        onSelectLogo(imageData);
                      }
                    } catch (error) {
                      console.error('[LogoPanel] Save failed:', error);
                      onSelectLogo(imageData);
                    } finally {
                      setIsSaving(false);
                      handleClose();
                    }
                  },
                },
              ]
            );
          } else {
            onSelectLogo(imageData);
            handleClose();
          }
        }
      } catch (error) {
        console.error('[LogoPanel] Failed to pick image:', error);
        Alert.alert('Error', 'Failed to pick image. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, [brandLogo, onSelectLogo, handleClose]);

    // Handle slider change
    const handleSliderChange = useCallback(
      (value: number) => {
        const roundedValue = Math.round(value * 100) / 100;
        onScaleChange?.(roundedValue);
      },
      [onScaleChange]
    );

    // Render picker mode content
    const renderPickerContent = () => (
      <View style={[styles.pickerContent, { paddingBottom: bottomPadding }]}>
        {/* Brand Logo Section */}
        {brandLogo ? (
          <TouchableOpacity
            style={styles.brandLogoButton}
            onPress={handleUseBrandLogo}
            activeOpacity={0.7}
          >
            <View style={styles.brandLogoPreview}>
              <Image
                source={{ uri: brandLogo.uri }}
                style={styles.brandLogoImage}
                contentFit="contain"
              />
            </View>
            <View style={styles.brandLogoInfo}>
              <Briefcase size={16} color={Colors.light.accent} />
              <Text style={styles.brandLogoText}>Use Brand Logo</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.noBrandLogo}>
            <Briefcase size={20} color={Colors.light.textTertiary} />
            <Text style={styles.noBrandLogoText}>No brand logo saved</Text>
          </View>
        )}

        {/* Upload Button */}
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handlePickImage}
          disabled={isLoading || isSaving}
          activeOpacity={0.7}
        >
          {isLoading || isSaving ? (
            <ActivityIndicator size="small" color={Colors.light.surface} />
          ) : (
            <>
              <Upload size={20} color={Colors.light.surface} />
              <Text style={styles.uploadButtonText}>Upload Logo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );

    // Render editor mode content
    const renderEditorContent = () => {
      const scalePercentage = Math.round(currentScale * 100);

      return (
        <View style={[styles.editorContent, { paddingBottom: bottomPadding }]}>
          {/* Scale Slider */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>Size</Text>
              <Text style={styles.sliderValue}>{scalePercentage}%</Text>
            </View>
            <View style={styles.sliderRow}>
              <ZoomOut size={18} color={Colors.light.textSecondary} />
              <Slider
                style={styles.slider}
                minimumValue={LOGO_SIZE_CONSTRAINTS.minScale}
                maximumValue={LOGO_SIZE_CONSTRAINTS.maxScale}
                value={currentScale}
                onValueChange={handleSliderChange}
                minimumTrackTintColor={Colors.light.accent}
                maximumTrackTintColor={Colors.light.border}
                thumbTintColor={Colors.light.accent}
              />
              <ZoomIn size={18} color={Colors.light.textSecondary} />
            </View>
          </View>

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={onDeleteLogo}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color={Colors.light.error} />
            <Text style={styles.deleteButtonText}>Delete Logo</Text>
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onChange={handleSheetChange}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'picker' ? 'Add Logo' : 'Logo Settings'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {mode === 'picker' ? renderPickerContent() : renderEditorContent()}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handleIndicator: {
    backgroundColor: 'rgba(60, 60, 67, 0.3)',
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  container: {
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'relative',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  // Picker content
  pickerContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  brandLogoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  brandLogoPreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandLogoImage: {
    width: 40,
    height: 40,
  },
  brandLogoInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
  },
  noBrandLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  noBrandLogoText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  // Editor content
  editorContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
  },
  sliderSection: {
    gap: 8,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214, 69, 69, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.error,
  },
});

export default LogoPanel;
