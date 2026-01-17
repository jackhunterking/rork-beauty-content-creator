/**
 * LogoPickerModal Component
 * 
 * A bottom sheet modal for selecting logo overlays.
 * Shows brand kit logo preview if available, or guides users
 * to upload and optionally save to their brand kit.
 * 
 * Uses ref-based pattern like OverlayStyleSheet for proper z-index layering.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { X, ImageIcon, Briefcase, Upload, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { getBrandLogo, saveBrandLogo } from '@/services/brandKitService';

interface BrandLogoData {
  uri: string;
  width: number;
  height: number;
}

interface LogoPickerModalProps {
  /** Reference to the bottom sheet - controlled by parent */
  bottomSheetRef: React.RefObject<BottomSheet>;
  /** Called when a logo is selected (from brand kit or upload) */
  onSelectLogo: (logoData: { uri: string; width: number; height: number }) => void;
  /** Called when modal should close */
  onClose: () => void;
  /** Whether the user has premium status */
  isPremium: boolean;
  /** Called when premium feature is requested by free user */
  onRequestPremium: (featureName: string, onPremiumGranted?: () => void) => void;
}

type ModalState = 'loading' | 'with-brand-logo' | 'no-brand-logo' | 'confirming-save';

interface UploadedImage {
  uri: string;
  width: number;
  height: number;
}

export function LogoPickerModal({
  bottomSheetRef,
  onSelectLogo,
  onClose,
  isPremium,
  onRequestPremium,
}: LogoPickerModalProps) {
  // State
  const [modalState, setModalState] = useState<ModalState>('loading');
  const [brandLogo, setBrandLogo] = useState<BrandLogoData | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [saveToKit, setSaveToKit] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Snap points - use percentage for consistent height across devices
  const snapPoints = useMemo(() => ['55%', '70%'], []);
  
  // Load brand kit logo
  const loadBrandLogo = useCallback(async () => {
    setModalState('loading');
    try {
      const logo = await getBrandLogo();
      setBrandLogo(logo);
      setModalState(logo ? 'with-brand-logo' : 'no-brand-logo');
    } catch (error) {
      console.error('[LogoPickerModal] Failed to load brand logo:', error);
      setBrandLogo(null);
      setModalState('no-brand-logo');
    }
  }, []);
  
  // Handle using brand kit logo
  const handleUseBrandLogo = useCallback(() => {
    if (brandLogo) {
      onSelectLogo({
        uri: brandLogo.uri,
        width: brandLogo.width,
        height: brandLogo.height,
      });
      onClose();
    }
  }, [brandLogo, onSelectLogo, onClose]);
  
  // Actual image picking logic (called after premium check)
  const pickImageFromLibrary = useCallback(async () => {
    try {
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
        
        // If user has no brand logo, show save confirmation
        if (!brandLogo) {
          setUploadedImage(imageData);
          setModalState('confirming-save');
        } else {
          // User has brand logo, just add the overlay directly
          onSelectLogo(imageData);
          onClose();
        }
      }
    } catch (error) {
      console.error('[LogoPickerModal] Failed to pick image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, [brandLogo, onSelectLogo, onClose]);

  // Handle picking image from library - with premium gate
  const handlePickImage = useCallback(async () => {
    // Premium gate for logo upload (same as settings screen)
    if (!isPremium) {
      await onRequestPremium('brand_kit_logo', () => {
        console.log('[LogoPickerModal] Brand kit logo callback triggered after premium granted');
        pickImageFromLibrary();
      });
      return;
    }
    
    pickImageFromLibrary();
  }, [isPremium, onRequestPremium, pickImageFromLibrary]);
  
  // Handle confirming upload (with optional save to brand kit)
  const handleConfirmUpload = useCallback(async () => {
    if (!uploadedImage) return;
    
    if (saveToKit) {
      setIsSaving(true);
      try {
        const result = await saveBrandLogo(uploadedImage.uri);
        if (result.success && result.brandKit.logoUri) {
          // Use the processed brand kit logo (may have been resized)
          onSelectLogo({
            uri: result.brandKit.logoUri,
            width: result.brandKit.logoWidth || uploadedImage.width,
            height: result.brandKit.logoHeight || uploadedImage.height,
          });
        } else {
          // Saving failed, but still add the overlay with original image
          console.warn('[LogoPickerModal] Brand kit save failed, using original image');
          onSelectLogo(uploadedImage);
        }
      } catch (error) {
        console.error('[LogoPickerModal] Failed to save to brand kit:', error);
        // Still add the overlay even if save failed
        onSelectLogo(uploadedImage);
      } finally {
        setIsSaving(false);
      }
    } else {
      // Just add the overlay without saving to brand kit
      onSelectLogo(uploadedImage);
    }
    
    onClose();
  }, [uploadedImage, saveToKit, onSelectLogo, onClose]);
  
  // Render backdrop
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
  
  // Handle sheet state changes
  const handleSheetChange = useCallback((index: number) => {
    if (index === 0 || index === 1) {
      // Sheet is opening - load brand logo data
      loadBrandLogo();
    } else if (index === -1) {
      // Sheet is closed - reset state
      setUploadedImage(null);
      setSaveToKit(true);
      onClose();
    }
  }, [loadBrandLogo, onClose]);
  
  // Handle close button press
  const handleClosePress = useCallback(() => {
    bottomSheetRef.current?.close();
  }, [bottomSheetRef]);
  
  // Render content based on state
  const renderContent = () => {
    switch (modalState) {
      case 'loading':
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.accent} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        );
        
      case 'with-brand-logo':
        return (
          <View style={styles.contentContainer}>
            {/* Brand Logo Preview */}
            <View style={styles.brandLogoSection}>
              <View style={styles.brandLogoPreviewContainer}>
                {brandLogo && (
                  <Image
                    source={{ uri: brandLogo.uri }}
                    style={styles.brandLogoPreview}
                    contentFit="contain"
                  />
                )}
              </View>
              <View style={styles.brandLogoInfo}>
                <View style={styles.brandKitBadge}>
                  <Briefcase size={12} color={Colors.light.accent} />
                  <Text style={styles.brandKitBadgeText}>Brand Kit</Text>
                </View>
                <Text style={styles.brandLogoLabel}>Your saved logo</Text>
              </View>
            </View>
            
            {/* Use Brand Logo Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleUseBrandLogo}
              activeOpacity={0.8}
            >
              <Check size={20} color={Colors.light.surface} />
              <Text style={styles.primaryButtonText}>Use Brand Kit Logo</Text>
            </TouchableOpacity>
            
            {/* Upload Different Button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handlePickImage}
              activeOpacity={0.7}
            >
              <Upload size={18} color={Colors.light.accent} />
              <Text style={styles.secondaryButtonText}>Upload Different Image</Text>
            </TouchableOpacity>
          </View>
        );
        
      case 'no-brand-logo':
        return (
          <View style={styles.contentContainer}>
            {/* Empty State */}
            <View style={styles.emptyStateSection}>
              <View style={styles.emptyStateIcon}>
                <Briefcase size={32} color={Colors.light.accent} />
              </View>
              <Text style={styles.emptyStateTitle}>Brand Kit Logo</Text>
              <Text style={styles.emptyStateDescription}>
                Save your logo to your Brand Kit for quick access across all your designs. Upload once, use everywhere!
              </Text>
            </View>
            
            {/* Upload Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handlePickImage}
              activeOpacity={0.8}
            >
              <ImageIcon size={20} color={Colors.light.surface} />
              <Text style={styles.primaryButtonText}>Upload Logo</Text>
            </TouchableOpacity>
            
            {/* Helper text */}
            <Text style={styles.helperText}>
              You can save this logo to your Brand Kit after uploading
            </Text>
          </View>
        );
        
      case 'confirming-save':
        return (
          <View style={styles.contentContainer}>
            {/* Uploaded Image Preview */}
            <View style={styles.uploadedPreviewSection}>
              {uploadedImage && (
                <View style={styles.uploadedPreviewContainer}>
                  <Image
                    source={{ uri: uploadedImage.uri }}
                    style={styles.uploadedPreview}
                    contentFit="contain"
                  />
                </View>
              )}
              <Text style={styles.previewLabel}>Logo Preview</Text>
            </View>
            
            {/* Save to Brand Kit Toggle */}
            <TouchableOpacity
              style={styles.saveToggleRow}
              onPress={() => setSaveToKit(!saveToKit)}
              activeOpacity={0.7}
              disabled={isSaving}
            >
              <View style={styles.saveToggleLeft}>
                <Briefcase size={20} color={Colors.light.accent} />
                <View style={styles.saveToggleTextContainer}>
                  <Text style={styles.saveToggleLabel}>Save to Brand Kit</Text>
                  <Text style={styles.saveToggleHint}>
                    Use this logo quickly in future designs
                  </Text>
                </View>
              </View>
              <Switch
                value={saveToKit}
                onValueChange={setSaveToKit}
                disabled={isSaving}
                trackColor={{ 
                  false: Colors.light.border, 
                  true: Colors.light.accent 
                }}
                thumbColor={Colors.light.surface}
                ios_backgroundColor={Colors.light.border}
              />
            </TouchableOpacity>
            
            {/* Confirm Button */}
            <TouchableOpacity
              style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
              onPress={handleConfirmUpload}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={Colors.light.surface} />
              ) : (
                <Check size={20} color={Colors.light.surface} />
              )}
              <Text style={styles.primaryButtonText}>
                {isSaving ? 'Saving...' : 'Add Logo'}
              </Text>
            </TouchableOpacity>
          </View>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
    >
      <BottomSheetScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Logo</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClosePress}
            activeOpacity={0.7}
            disabled={isSaving}
          >
            <X size={24} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>
        
        {renderContent()}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: Colors.light.border,
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  
  // Brand Logo Section (when user has brand kit logo)
  brandLogoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 16,
  },
  brandLogoPreviewContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  brandLogoPreview: {
    width: 72,
    height: 72,
  },
  brandLogoInfo: {
    flex: 1,
    gap: 6,
  },
  brandKitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(229, 164, 59, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  brandKitBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  brandLogoLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  
  // Empty State Section (when no brand kit logo)
  emptyStateSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 24,
  },
  emptyStateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(229, 164, 59, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  
  // Uploaded Preview Section (confirming save state)
  uploadedPreviewSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadedPreviewContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
  },
  uploadedPreview: {
    width: 90,
    height: 90,
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  
  // Save Toggle Row
  saveToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  saveToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  saveToggleTextContainer: {
    flex: 1,
  },
  saveToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  saveToggleHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  
  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.text,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  helperText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default LogoPickerModal;
