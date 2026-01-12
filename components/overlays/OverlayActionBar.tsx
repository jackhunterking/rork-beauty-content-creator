/**
 * OverlayActionBar Component
 * 
 * Action bar displayed above the Generate button in the Editor.
 * Contains buttons to add Date, Text, and Logo overlays.
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
  /** Called when premium feature is requested by free user */
  onRequestPremium: (featureName: string) => void;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  isPremium: boolean;
  disabled?: boolean;
}

function ActionButton({ icon, label, onPress, isPremium, disabled }: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {icon}
        {!isPremium && (
          <View style={styles.crownBadge}>
            <Crown size={10} color={Colors.light.surface} />
          </View>
        )}
      </View>
      <Text style={[
        styles.actionLabel,
        disabled && styles.actionLabelDisabled,
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
      <View style={styles.divider} />
      
      <View style={styles.actionsRow}>
        <Text style={styles.sectionLabel}>Add Overlay</Text>
        
        <View style={styles.buttonsContainer}>
          <ActionButton
            icon={<Calendar size={20} color={disabled ? Colors.light.textTertiary : Colors.light.text} />}
            label="Date"
            onPress={handleAddDate}
            isPremium={isPremium}
            disabled={disabled}
          />
          
          <ActionButton
            icon={<Type size={20} color={disabled ? Colors.light.textTertiary : Colors.light.text} />}
            label="Text"
            onPress={handleAddText}
            isPremium={isPremium}
            disabled={disabled}
          />
          
          <ActionButton
            icon={<ImageIcon size={20} color={disabled ? Colors.light.textTertiary : Colors.light.text} />}
            label="Logo"
            onPress={handleAddLogo}
            isPremium={isPremium}
            disabled={disabled}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginBottom: 12,
  },
  actionsRow: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  crownBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.light.surface,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.text,
  },
  actionLabelDisabled: {
    color: Colors.light.textTertiary,
  },
});

export default OverlayActionBar;
