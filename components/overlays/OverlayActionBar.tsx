/**
 * OverlayActionBar Component
 * 
 * Action bar displayed above the Generate button in the Editor.
 * Contains compact horizontal buttons to add Date, Text, and Logo overlays.
 * All overlay features are free - paywall is at download time.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Calendar, Type, Image as ImageIcon } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { OverlayType } from '@/types/overlays';

interface OverlayActionBarProps {
  /** Whether overlays are currently disabled (e.g., during rendering) */
  disabled?: boolean;
  /** Called when user wants to add an overlay */
  onAddOverlay: (type: OverlayType, imageData?: { uri: string; width: number; height: number }) => void;
  /** Called when user wants to open the logo picker modal */
  onRequestLogoModal: () => void;
}

interface OverlayButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

function OverlayButton({ icon, label, onPress, disabled }: OverlayButtonProps) {
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
  disabled = false,
  onAddOverlay,
  onRequestLogoModal,
}: OverlayActionBarProps) {
  // Handle Date overlay button press
  const handleAddDate = useCallback(() => {
    onAddOverlay('date');
  }, [onAddOverlay]);

  // Handle Text overlay button press
  const handleAddText = useCallback(() => {
    onAddOverlay('text');
  }, [onAddOverlay]);

  // Handle Logo overlay button press - opens logo picker modal
  const handleAddLogo = useCallback(() => {
    onRequestLogoModal();
  }, [onRequestLogoModal]);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Add Overlay</Text>
      </View>

      {/* Overlay Options as Horizontal Buttons */}
      <View style={styles.buttonsRow}>
        <OverlayButton
          icon={<Calendar size={20} color={disabled ? Colors.light.textTertiary : Colors.light.accent} />}
          label="Date"
          onPress={handleAddDate}
          disabled={disabled}
        />
        
        <OverlayButton
          icon={<Type size={20} color={disabled ? Colors.light.textTertiary : Colors.light.accent} />}
          label="Text"
          onPress={handleAddText}
          disabled={disabled}
        />
        
        <OverlayButton
          icon={<ImageIcon size={20} color={disabled ? Colors.light.textTertiary : Colors.light.accent} />}
          label="Logo"
          onPress={handleAddLogo}
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
