/**
 * OverlayActionBar Component
 * 
 * Action bar displayed above the Generate button in the Editor.
 * Contains compact horizontal buttons to add Date, Text, and Logo overlays.
 * Features premium gating via Superwall.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert } from 'react-native';
import { Calendar, Type, Image as ImageIcon, Crown } from 'lucide-react-native';
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
  /** Called when premium feature is requested by free user. Includes callback to execute if premium is granted. */
  onRequestPremium: (featureName: string, onPremiumGranted?: () => void) => void;
}

interface OverlayButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  isPremium: boolean;
  disabled?: boolean;
}

function OverlayButton({ icon, label, onPress, isPremium, disabled }: OverlayButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.overlayButton,
        disabled && styles.overlayButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {/* Crown badge for non-premium users */}
      {!isPremium && (
        <View style={styles.crownBadge}>
          <Crown size={10} color={Colors.light.surface} />
        </View>
      )}
      <View style={styles.iconContainer}>
        {icon}
      </View>
      <Text style={[
        styles.buttonLabel,
        disabled && styles.buttonLabelDisabled,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function OverlayActionBar({
  isPremium,
  disabled = false,
  onAddOverlay,
  onRequestPremium,
}: OverlayActionBarProps) {
  // Helper function to add logo (shared between premium and post-subscription flows)
  const addLogoOverlay = useCallback(async () => {
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
  }, [onAddOverlay]);

  // Handle Date overlay button press
  const handleAddDate = useCallback(() => {
    if (!isPremium) {
      // Pass callback to add overlay after subscription is granted
      onRequestPremium('add_date_overlay', () => onAddOverlay('date'));
      return;
    }
    onAddOverlay('date');
  }, [isPremium, onAddOverlay, onRequestPremium]);

  // Handle Text overlay button press
  const handleAddText = useCallback(() => {
    if (!isPremium) {
      // Pass callback to add overlay after subscription is granted
      onRequestPremium('add_text_overlay', () => onAddOverlay('text'));
      return;
    }
    onAddOverlay('text');
  }, [isPremium, onAddOverlay, onRequestPremium]);

  // Handle Logo overlay button press
  const handleAddLogo = useCallback(async () => {
    if (!isPremium) {
      // Pass callback to add logo overlay after subscription is granted
      onRequestPremium('add_logo_overlay', () => addLogoOverlay());
      return;
    }

    // User is premium, proceed with logo selection
    await addLogoOverlay();
  }, [isPremium, onRequestPremium, addLogoOverlay]);

  // Pick logo image from library
  const pickLogoImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
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
            <Crown size={10} color={Colors.light.surface} />
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        )}
      </View>

      {/* Overlay Options as Horizontal Buttons */}
      <View style={styles.buttonsRow}>
        <OverlayButton
          icon={<Calendar size={20} color={disabled ? Colors.light.textTertiary : Colors.light.accent} />}
          label="Date"
          onPress={handleAddDate}
          isPremium={isPremium}
          disabled={disabled}
        />
        
        <OverlayButton
          icon={<Type size={20} color={disabled ? Colors.light.textTertiary : Colors.light.accent} />}
          label="Text"
          onPress={handleAddText}
          isPremium={isPremium}
          disabled={disabled}
        />
        
        <OverlayButton
          icon={<ImageIcon size={20} color={disabled ? Colors.light.textTertiary : Colors.light.accent} />}
          label="Logo"
          onPress={handleAddLogo}
          isPremium={isPremium}
          disabled={disabled}
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
    paddingVertical: 3,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.surface,
    letterSpacing: 0.5,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  overlayButton: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  overlayButtonDisabled: {
    opacity: 0.5,
  },
  crownBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
  },
  buttonLabelDisabled: {
    color: Colors.light.textTertiary,
  },
});

export default OverlayActionBar;
