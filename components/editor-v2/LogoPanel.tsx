/**
 * LogoPanel Component
 * 
 * Compact bottom panel for selecting and managing logo overlays.
 * Follows Canva's pattern: 25% height, horizontal layout,
 * brand kit integration, and upload options.
 * 
 * Supports:
 * - PNG images with transparency preservation
 * - SVG files (converted to PNG)
 * - Brand Kit integration
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
import { SvgXml } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
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
  ZoomIn,
  ZoomOut,
  Circle,
  FileImage,
  FolderOpen,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Colors from '@/constants/colors';
import { getBrandLogo, saveBrandLogo } from '@/services/brandKitService';
import { LogoOverlay, LOGO_SIZE_CONSTRAINTS } from '@/types/overlays';
import { pickImageFile, parseSVGDimensions, getSVGRenderProps, isSVGPickerAvailable } from '@/utils/svgProcessor';

interface BrandLogoData {
  uri: string;
  width: number;
  height: number;
}

type PanelMode = 'picker' | 'editor';
type EditorMode = 'size' | 'opacity';

// SVG processing state
interface SVGProcessingState {
  isProcessing: boolean;
  svgContent: string | null;
  width: number;
  height: number;
}

export interface LogoPanelProps {
  /** Currently selected logo overlay (for editing mode) */
  selectedLogo?: LogoOverlay | null;
  /** Current scale value (for editing mode) */
  currentScale?: number;
  /** Current opacity value (for editing mode) */
  currentOpacity?: number;
  /** Called when a logo is selected */
  onSelectLogo: (logoData: { uri: string; width: number; height: number }) => void;
  /** Called when scale changes */
  onScaleChange?: (scale: number) => void;
  /** Called when opacity changes */
  onOpacityChange?: (opacity: number) => void;
  /** Called when logo is deleted */
  onDeleteLogo?: () => void;
  /** Called when panel is closed */
  onClose?: () => void;
}

export interface LogoPanelRef {
  openPicker: () => void;
  openSizeEditor: () => void;
  openOpacityEditor: () => void;
  close: () => void;
}

export const LogoPanel = forwardRef<LogoPanelRef, LogoPanelProps>(
  function LogoPanel(
    {
      selectedLogo,
      currentScale = 1,
      currentOpacity = 1,
      onSelectLogo,
      onScaleChange,
      onOpacityChange,
      onDeleteLogo,
      onClose,
    },
    ref
  ) {
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheet>(null);
    const svgRenderRef = useRef<View>(null);
    const [mode, setMode] = useState<PanelMode>('picker');
    const [editorMode, setEditorMode] = useState<EditorMode>('size');
    const [brandLogo, setBrandLogo] = useState<BrandLogoData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [svgState, setSvgState] = useState<SVGProcessingState>({
      isProcessing: false,
      svgContent: null,
      width: 0,
      height: 0,
    });
    
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
      openSizeEditor: () => {
        setMode('editor');
        setEditorMode('size');
        bottomSheetRef.current?.snapToIndex(0);
      },
      openOpacityEditor: () => {
        setMode('editor');
        setEditorMode('opacity');
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

    // Handle picking image from photo library (PNG/JPEG with transparency support)
    const handlePickImage = useCallback(async () => {
      try {
        setIsLoading(true);
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1.0,  // Full quality to preserve transparency
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
                      // Save with transparency preservation (PNG format)
                      const saveResult = await saveBrandLogo(imageData.uri, true);
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

    // Handle picking file from Files app (PNG or SVG)
    const handlePickFromFiles = useCallback(async () => {
      try {
        setIsLoading(true);
        
        const result = await pickImageFile();
        
        if (!result.success) {
          if (result.error && result.error !== 'No file selected') {
            Alert.alert('Error', result.error);
          }
          setIsLoading(false);
          return;
        }

        // Handle SVG files
        if (result.fileType === 'svg' && result.svgContent) {
          // Set SVG state for rendering and conversion
          setSvgState({
            isProcessing: true,
            svgContent: result.svgContent,
            width: result.width || 200,
            height: result.height || 200,
          });
          // The SVG will be rendered and captured in useEffect
          return;
        }

        // Handle PNG/JPEG files
        if (result.imageUri) {
          // For images from files, we need to get dimensions
          // Use Image.getSize or process through ImageManipulator
          const imageData = {
            uri: result.imageUri,
            width: result.width || 200,
            height: result.height || 200,
          };

          setIsLoading(false);

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
                      const saveResult = await saveBrandLogo(imageData.uri, true);
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
                      console.error('[LogoPanel] Save file failed:', error);
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
        console.error('[LogoPanel] Failed to pick file:', error);
        Alert.alert('Error', 'Failed to process file. Please try again.');
        setIsLoading(false);
      }
    }, [brandLogo, onSelectLogo, handleClose]);

    // Effect to capture SVG as PNG after render
    useEffect(() => {
      if (svgState.isProcessing && svgState.svgContent && svgRenderRef.current) {
        // Small delay to ensure SVG is rendered
        const captureTimeout = setTimeout(async () => {
          try {
            // Capture the rendered SVG as PNG
            const pngUri = await captureRef(svgRenderRef, {
              format: 'png',
              quality: 1,
              result: 'tmpfile',
            });

            const imageData = {
              uri: pngUri,
              width: svgState.width,
              height: svgState.height,
            };

            // Reset SVG state
            setSvgState({
              isProcessing: false,
              svgContent: null,
              width: 0,
              height: 0,
            });
            setIsLoading(false);

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
                        const saveResult = await saveBrandLogo(imageData.uri, true);
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
                        console.error('[LogoPanel] Save SVG failed:', error);
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
          } catch (error) {
            console.error('[LogoPanel] Failed to capture SVG:', error);
            setSvgState({
              isProcessing: false,
              svgContent: null,
              width: 0,
              height: 0,
            });
            setIsLoading(false);
            Alert.alert('Error', 'Failed to process SVG file. Please try again.');
          }
        }, 100);

        return () => clearTimeout(captureTimeout);
      }
    }, [svgState, brandLogo, onSelectLogo, handleClose]);

    // Handle scale slider change
    const handleScaleSliderChange = useCallback(
      (value: number) => {
        const roundedValue = Math.round(value * 100) / 100;
        onScaleChange?.(roundedValue);
      },
      [onScaleChange]
    );

    // Handle opacity slider change
    const handleOpacitySliderChange = useCallback(
      (value: number) => {
        const roundedValue = Math.round(value * 100) / 100;
        onOpacityChange?.(roundedValue);
      },
      [onOpacityChange]
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

        {/* Upload Options Row */}
        <View style={styles.uploadOptionsRow}>
          {/* From Photos Button - uses photo library */}
          <TouchableOpacity
            style={[
              styles.uploadOptionButton,
              // Make full width if file picker not available
              !isSVGPickerAvailable() && styles.uploadOptionButtonFullWidth,
            ]}
            onPress={handlePickImage}
            disabled={isLoading || isSaving}
            activeOpacity={0.7}
          >
            {isLoading && !svgState.isProcessing ? (
              <ActivityIndicator size="small" color={Colors.light.surface} />
            ) : (
              <>
                <FileImage size={20} color={Colors.light.surface} />
                <Text style={styles.uploadButtonText}>
                  {isSVGPickerAvailable() ? 'From Photos' : 'Upload Logo'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* From Files Button - uses Files app (PNG/SVG) */}
          {isSVGPickerAvailable() && (
            <TouchableOpacity
              style={[styles.uploadOptionButton, styles.uploadOptionButtonSecondary]}
              onPress={handlePickFromFiles}
              disabled={isLoading || isSaving}
              activeOpacity={0.7}
            >
              {svgState.isProcessing ? (
                <ActivityIndicator size="small" color={Colors.light.accent} />
              ) : (
                <>
                  <FolderOpen size={20} color={Colors.light.accent} />
                  <Text style={styles.uploadButtonTextSecondary}>From Files</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Helper text */}
        <Text style={styles.helperText}>
          {isSVGPickerAvailable() 
            ? 'Select PNG or SVG from Files. Transparency is preserved.'
            : 'PNG files with transparency are fully supported.'}
        </Text>
      </View>
    );

    // Render editor mode content
    const renderEditorContent = () => {
      const scalePercentage = Math.round(currentScale * 100);
      const opacityPercentage = Math.round(currentOpacity * 100);

      return (
        <View style={[styles.editorContent, { paddingBottom: bottomPadding }]}>
          {editorMode === 'size' ? (
            /* Size Slider */
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
                  onValueChange={handleScaleSliderChange}
                  minimumTrackTintColor={Colors.light.accent}
                  maximumTrackTintColor={Colors.light.border}
                  thumbTintColor={Colors.light.accent}
                />
                <ZoomIn size={18} color={Colors.light.textSecondary} />
              </View>
            </View>
          ) : (
            /* Opacity Slider */
            <View style={styles.sliderSection}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Opacity</Text>
                <Text style={styles.sliderValue}>{opacityPercentage}%</Text>
              </View>
              <View style={styles.sliderRow}>
                <Circle size={18} color={Colors.light.textSecondary} strokeWidth={1} />
                <Slider
                  style={styles.slider}
                  minimumValue={LOGO_SIZE_CONSTRAINTS.minOpacity}
                  maximumValue={LOGO_SIZE_CONSTRAINTS.maxOpacity}
                  value={currentOpacity}
                  onValueChange={handleOpacitySliderChange}
                  minimumTrackTintColor={Colors.light.accent}
                  maximumTrackTintColor={Colors.light.border}
                  thumbTintColor={Colors.light.accent}
                />
                <Circle size={18} color={Colors.light.textSecondary} fill={Colors.light.textSecondary} />
              </View>
            </View>
          )}

        </View>
      );
    };

    // Get SVG render props if processing
    const svgRenderProps = svgState.svgContent 
      ? getSVGRenderProps(svgState.svgContent, 500)
      : null;

    return (
      <>
        {/* Hidden SVG render view for capture */}
        {svgState.isProcessing && svgRenderProps && (
          <View 
            ref={svgRenderRef}
            style={styles.hiddenSvgContainer}
            collapsable={false}
          >
            <SvgXml
              xml={svgRenderProps.xml}
              width={svgRenderProps.width}
              height={svgRenderProps.height}
            />
          </View>
        )}

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
                {mode === 'picker' ? 'Add Logo' : editorMode === 'size' ? 'Logo Size' : 'Logo Opacity'}
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
      </>
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
  uploadOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  uploadOptionButtonSecondary: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.light.accent,
  },
  uploadOptionButtonFullWidth: {
    flex: undefined,
    width: '100%',
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
  uploadButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  helperText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  hiddenSvgContainer: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    backgroundColor: 'transparent',
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
});

export default LogoPanel;
