/**
 * LogoActionSheet Component
 * 
 * Bottom sheet for logo overlay actions.
 * Includes a scale slider for resizing and a delete button.
 */

import React, { useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import Slider from '@react-native-community/slider';
import { Trash2, ZoomIn, ZoomOut } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { LogoOverlay, LOGO_SIZE_CONSTRAINTS } from '@/types/overlays';

interface LogoActionSheetProps {
  /** Reference to the bottom sheet */
  bottomSheetRef: React.RefObject<BottomSheet>;
  /** Currently selected logo overlay */
  overlay: LogoOverlay | null;
  /** Current scale value */
  currentScale: number;
  /** Called when scale changes */
  onScaleChange: (scale: number) => void;
  /** Called when overlay is deleted */
  onDeleteOverlay: () => void;
}

export function LogoActionSheet({
  bottomSheetRef,
  overlay,
  currentScale,
  onScaleChange,
  onDeleteOverlay,
}: LogoActionSheetProps) {
  // Snap points for bottom sheet - compact height for simple controls
  const snapPoints = useMemo(() => ['25%'], []);

  // Render backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  // Handle slider change
  const handleSliderChange = useCallback((value: number) => {
    // Round to 2 decimal places for smooth but precise control
    const roundedValue = Math.round(value * 100) / 100;
    onScaleChange(roundedValue);
  }, [onScaleChange]);

  // Calculate percentage for display
  const scalePercentage = Math.round(currentScale * 100);

  if (!overlay) {
    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.emptyContent}>
          <Text style={styles.emptyText}>No logo selected</Text>
        </BottomSheetView>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Logo Settings</Text>
        </View>

        {/* Scale Slider Section */}
        <View style={styles.section}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sectionTitle}>Size</Text>
            <Text style={styles.scaleValue}>{scalePercentage}%</Text>
          </View>
          
          <View style={styles.sliderRow}>
            <ZoomOut size={18} color={Colors.light.textSecondary} />
            <View style={styles.sliderWrapper}>
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
            </View>
            <ZoomIn size={18} color={Colors.light.textSecondary} />
          </View>
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDeleteOverlay}
          activeOpacity={0.7}
        >
          <Trash2 size={20} color={Colors.light.surface} />
          <Text style={styles.deleteButtonText}>Delete Logo</Text>
        </TouchableOpacity>

        {/* Bottom safe area padding */}
        <View style={styles.bottomPadding} />
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  header: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  scaleValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
    minWidth: 50,
    textAlign: 'right',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderWrapper: {
    flex: 1,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.light.error,
    paddingVertical: 14,
    borderRadius: 12,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.surface,
  },
  bottomPadding: {
    height: 24,
  },
});

export default LogoActionSheet;
