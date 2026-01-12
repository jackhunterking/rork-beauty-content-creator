/**
 * OverlayActionBar Component
 * 
 * Action bar displayed above the Generate button in the Editor.
 * Contains rows to add Date, Text, and Logo overlays.
 * Features premium gating via Superwall.
 * UI styled to match the Remove Watermark toggle row.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert } from 'react-native';
import { Calendar, Type, Image as ImageIcon, Crown, ChevronRight } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { OverlayType } from '@/types/overlays';
import { getBrandLogo } from '@/services/brandKitService';

interface OverlayActionBarProps {
  /** Whether the user has premium status */
  isPremium: boolean;
  /** Whether overlays are currently disabled (e.g., during rendering) */
  disabled?: boolean;
  /** Called when user wants to add an overlay */
  onAddOverlay: (type: OverlayType, imageData?: { uri: string; width: number; height: number }) => void;
  /** Called when premium feature is requested by free user */
  onRequestPremium: (featureName: string) => void;
}

interface OverlayRowProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  isPremium: boolean;
  disabled?: boolean;
  isLast?: boolean;
}

function OverlayRow({ icon, label, onPress, isPremium, disabled, isLast }: OverlayRowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.overlayRow,
        !isLast && styles.overlayRowBorder,
        disabled && styles.overlayRowDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.overlayRowLeft}>
        {!isPremium && (
          <Crown size={16} color={Colors.light.accent} style={styles.crownIcon} />
        )}
        <View style={styles.overlayIconContainer}>
          {icon}
        </View>
        <Text style={[
          styles.overlayRowText,
          disabled && styles.overlayRowTextDisabled,
        ]}>
          {label}
        </Text>
      </View>
      <ChevronRight 
        size={18} 
        color={disabled ? Colors.light.textTertiary : Colors.light.textSecondary} 
      />
    </TouchableOpacity>
  );
}

export function OverlayActionBar({
  isPremium,
  disabled = false,
  onAddOverlay,
  onRequestPremium,
}: OverlayActionBarProps) {
  // Handle Date overlay button press
  const handleAddDate = useCallback(() => {
    if (!isPremium) {
      onRequestPremium('add_date_overlay');
      return;
    }
    onAddOverlay('date');
  }, [isPremium, onAddOverlay, onRequestPremium]);

  // Handle Text overlay button press
  const handleAddText = useCallback(() => {
    if (!isPremium) {
      onRequestPremium('add_text_overlay');
      return;
    }
    onAddOverlay('text');
  }, [isPremium, onAddOverlay, onRequestPremium]);

  // Handle Logo overlay button press
  const handleAddLogo = useCallback(async () => {
    if (!isPremium) {
      onRequestPremium('add_logo_overlay');
      return;
    }

    // Check if user has a brand kit logo
    const brandLogo = await getBrandLogo();

    if (brandLogo) {
      // Ask user if they want to use brand kit logo or pick new one
      Alert.alert(
        'Add Logo',
        'Would you like to use your Brand Kit logo or choose a different image?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Brand Kit Logo',
            onPress: () => {
              onAddOverlay('logo', {
                uri: brandLogo.uri,
                width: brandLogo.width,
                height: brandLogo.height,
              });
            },
          },
          {
            text: 'Choose Image',
            onPress: () => pickLogoImage(),
          },
        ]
      );
    } else {
      // No brand kit logo, pick from library
      pickLogoImage();
    }
  }, [isPremium, onAddOverlay, onRequestPremium]);

  // Pick logo image from library
  const pickLogoImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        onAddOverlay('logo', {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
        });
      }
    } catch (error) {
      console.error('[OverlayActionBar] Failed to pick logo image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, [onAddOverlay]);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Add Overlay</Text>
        {!isPremium && (
          <View style={styles.proBadge}>
            <Crown size={12} color={Colors.light.surface} />
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        )}
      </View>

      {/* Overlay Options as Rows */}
      <View style={styles.rowsContainer}>
        <OverlayRow
          icon={<Calendar size={18} color={disabled ? Colors.light.textTertiary : Colors.light.text} />}
          label="Add Date"
          onPress={handleAddDate}
          isPremium={isPremium}
          disabled={disabled}
        />
        
        <OverlayRow
          icon={<Type size={18} color={disabled ? Colors.light.textTertiary : Colors.light.text} />}
          label="Add Text"
          onPress={handleAddText}
          isPremium={isPremium}
          disabled={disabled}
        />
        
        <OverlayRow
          icon={<ImageIcon size={18} color={disabled ? Colors.light.textTertiary : Colors.light.text} />}
          label="Add Logo"
          onPress={handleAddLogo}
          isPremium={isPremium}
          disabled={disabled}
          isLast
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.surface,
    letterSpacing: 0.5,
  },
  rowsContainer: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  overlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.surface,
  },
  overlayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  overlayRowDisabled: {
    opacity: 0.5,
  },
  overlayRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  crownIcon: {
    marginRight: -4,
  },
  overlayIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
  },
  overlayRowTextDisabled: {
    color: Colors.light.textTertiary,
  },
});

export default OverlayActionBar;
