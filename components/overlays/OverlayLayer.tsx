/**
 * OverlayLayer Component
 * 
 * Container that renders all overlays on top of the template canvas.
 * Handles overlay selection, transforms, and deselection.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, TouchableWithoutFeedback } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DraggableOverlay } from './DraggableOverlay';
import { TextOverlayContent } from './TextOverlayContent';
import { LogoOverlayContent } from './LogoOverlayContent';
import {
  Overlay,
  OverlayTransform,
  TextOverlay,
  DateOverlay,
  LogoOverlay,
  isTextBasedOverlay,
  isLogoOverlay,
  LOGO_SIZE_CONSTRAINTS,
} from '@/types/overlays';

interface OverlayLayerProps {
  /** Array of overlays to render */
  overlays: Overlay[];
  /** ID of the currently selected overlay */
  selectedOverlayId: string | null;
  /** Canvas dimensions */
  canvasWidth: number;
  canvasHeight: number;
  /** Called when an overlay is selected */
  onSelectOverlay: (id: string | null) => void;
  /** Called when an overlay's transform changes */
  onUpdateOverlayTransform: (id: string, transform: OverlayTransform) => void;
  /** Called when an overlay is deleted */
  onDeleteOverlay: (id: string) => void;
}

export function OverlayLayer({
  overlays,
  selectedOverlayId,
  canvasWidth,
  canvasHeight,
  onSelectOverlay,
  onUpdateOverlayTransform,
  onDeleteOverlay,
}: OverlayLayerProps) {
  // Handle tap on empty space to deselect
  const handleBackgroundPress = useCallback(() => {
    onSelectOverlay(null);
  }, [onSelectOverlay]);

  // Handle overlay selection
  const handleSelectOverlay = useCallback((id: string) => {
    onSelectOverlay(id);
  }, [onSelectOverlay]);

  // Handle transform change
  const handleTransformChange = useCallback((id: string, transform: OverlayTransform) => {
    onUpdateOverlayTransform(id, transform);
  }, [onUpdateOverlayTransform]);

  // Handle overlay deletion
  const handleDeleteOverlay = useCallback((id: string) => {
    onDeleteOverlay(id);
    onSelectOverlay(null);
  }, [onDeleteOverlay, onSelectOverlay]);

  // Render overlay content based on type
  const renderOverlayContent = useCallback((overlay: Overlay) => {
    if (isTextBasedOverlay(overlay)) {
      return <TextOverlayContent overlay={overlay as TextOverlay | DateOverlay} />;
    }
    
    if (isLogoOverlay(overlay)) {
      const logoOverlay = overlay as LogoOverlay;
      // Calculate base size based on canvas size
      const baseSize = Math.min(canvasWidth, canvasHeight) * 0.25;
      return <LogoOverlayContent overlay={logoOverlay} baseSize={baseSize} />;
    }
    
    return null;
  }, [canvasWidth, canvasHeight]);

  // Get scale constraints based on overlay type
  const getScaleConstraints = useCallback((overlay: Overlay) => {
    if (isLogoOverlay(overlay)) {
      return {
        minScale: LOGO_SIZE_CONSTRAINTS.minScale,
        maxScale: LOGO_SIZE_CONSTRAINTS.maxScale,
      };
    }
    // Text overlays have different constraints
    return {
      minScale: 0.5,
      maxScale: 2.5,
    };
  }, []);

  if (overlays.length === 0) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Background touchable to deselect overlays */}
      <TouchableWithoutFeedback onPress={handleBackgroundPress}>
        <View style={[styles.touchableArea, { width: canvasWidth, height: canvasHeight }]} />
      </TouchableWithoutFeedback>

      {/* Render each overlay */}
      {overlays.map((overlay) => {
        const isSelected = overlay.id === selectedOverlayId;
        const scaleConstraints = getScaleConstraints(overlay);

        return (
          <DraggableOverlay
            key={overlay.id}
            id={overlay.id}
            transform={overlay.transform}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            isSelected={isSelected}
            onSelect={() => handleSelectOverlay(overlay.id)}
            onTransformChange={(transform) => handleTransformChange(overlay.id, transform)}
            onDelete={() => handleDeleteOverlay(overlay.id)}
            minScale={scaleConstraints.minScale}
            maxScale={scaleConstraints.maxScale}
          >
            {renderOverlayContent(overlay)}
          </DraggableOverlay>
        );
      })}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
  touchableArea: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default OverlayLayer;
