/**
 * OverlayActionBar Component
 * 
 * Action bar displayed above the Generate button in the Editor.
 * Contains compact horizontal buttons to add Date, Text, and Logo overlays.
 * Features premium gating via Superwall.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Calendar, Type, Image as ImageIcon, Crown } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { OverlayType } from '@/types/overlays';

interface OverlayActionBarProps {
  /** Whether the user has premium status */
  isPremium: boolean;
  /** Whether overlays are currently disabled (e.g., during rendering) */
  disabled?: boolean;
  /** Called when user wants to add an overlay */
  onAddOverlay: (type: OverlayType, imageData?: { uri: string; width: number; height: number }) => void;
  /** Called when premium feature is requested by free user. Includes callback to execute if premium is granted. */
  onRequestPremium: (featureName: string, onPremiumGranted?: () => void) => void;
  /** Called when user wants to open the logo picker modal */
  onRequestLogoModal: () => void;
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
  onRequestLogoModal,
}: OverlayActionBarProps) {
  // Handle Date overlay button press
  const handleAddDate = useCallback(() => {
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OverlayActionBar.tsx:handleAddDate',message:'Date button pressed',data:{isPremium,willRequestPremium:!isPremium},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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
  const handleAddLogo = useCallback(() => {
    if (!isPremium) {
      // Pass callback to open logo picker modal after subscription is granted
      onRequestPremium('add_logo_overlay', onRequestLogoModal);
      return;
    }

    // User is premium, request to open logo picker modal
    onRequestLogoModal();
  }, [isPremium, onRequestPremium, onRequestLogoModal]);

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
