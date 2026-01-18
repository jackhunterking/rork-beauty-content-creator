/**
 * OverlayLayer Component
 * 
 * Container that renders all overlays on top of the template canvas.
 * Handles overlay selection, transforms, and deselection.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
// NOTE: GestureHandlerRootView is NOT used here - it exists at app root level (_layout.tsx)
// Nesting GestureHandlerRootView causes gesture state corruption and crashes on iOS
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
  /** Called when an overlay is duplicated */
  onDuplicateOverlay?: (id: string) => void;
}

export function OverlayLayer({
  overlays,
  selectedOverlayId,
  canvasWidth,
  canvasHeight,
  onSelectOverlay,
  onUpdateOverlayTransform,
  onDeleteOverlay,
  onDuplicateOverlay,
}: OverlayLayerProps) {
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

  // Handle overlay duplication
  const handleDuplicateOverlay = useCallback((id: string) => {
    onDuplicateOverlay?.(id);
  }, [onDuplicateOverlay]);

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

  // Use regular View instead of GestureHandlerRootView
  // GestureHandlerRootView already exists at app root level (_layout.tsx)
  // Nesting it causes gesture state corruption and iOS crashes after multiple operations
  return (
    <View style={styles.container}>
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
            onDuplicate={() => handleDuplicateOverlay(overlay.id)}
            minScale={scaleConstraints.minScale}
            maxScale={scaleConstraints.maxScale}
          >
            {renderOverlayContent(overlay)}
          </DraggableOverlay>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
});

export default OverlayLayer;
