import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { AlertCircle, Plus, RefreshCw, Check } from 'lucide-react-native';
import { Slot, SlotState } from '@/types';
import Colors from '@/constants/colors';

interface SlotRegionProps {
  slot: Slot;
  state: SlotState;
  capturedUri: string | null;
  renderedUri?: string | null;
  onPress: () => void;
  onRetry?: () => void;
  errorMessage?: string;
  progress?: number;
  /**
   * When true, the slot is completely transparent (invisible).
   * Used when Templated.io renders the full preview - slots become pure tap targets.
   * The template's placeholder design shows through.
   */
  isTransparent?: boolean;
}

/**
 * SlotRegion - Interactive slot area
 * 
 * Two modes:
 * 1. Normal mode (isTransparent=false): Shows UI for empty/loading/ready states
 * 2. Transparent mode (isTransparent=true): Invisible tap target, template shows through
 * 
 * States:
 * - empty: Ready to add photo
 * - capturing: User is taking photo
 * - processing: Local image processing
 * - uploading: Uploading to Supabase
 * - rendering: Waiting for Templated.io
 * - ready: Photo captured and processed
 * - error: Shows error with retry button
 */
export function SlotRegion({ 
  slot, 
  state, 
  capturedUri, 
  renderedUri,
  onPress, 
  onRetry,
  errorMessage,
  progress,
  isTransparent = false,
}: SlotRegionProps) {
  const isLoading = ['processing', 'uploading', 'rendering'].includes(state);
  const hasImage = capturedUri || renderedUri;
  const imageUri = renderedUri || capturedUri;
  
  // Get loading message based on state
  const getLoadingMessage = () => {
    switch (state) {
      case 'processing':
        return 'Processing...';
      case 'uploading':
        return progress ? `Uploading ${progress}%` : 'Uploading...';
      case 'rendering':
        return progress ? `Rendering ${progress}%` : 'Rendering...';
      default:
        return '';
    }
  };

  // Transparent mode - invisible tap target with small indicator
  if (isTransparent) {
    return (
      <TouchableOpacity
        onPress={state === 'error' && onRetry ? onRetry : onPress}
        activeOpacity={0.9}
        disabled={isLoading && state !== 'error'}
        style={[
          styles.transparentContainer,
          {
            left: slot.x,
            top: slot.y,
            width: slot.width,
            height: slot.height,
          },
        ]}
      >
        {/* Small filled indicator when photo exists */}
        {state === 'ready' && hasImage && (
          <View style={styles.filledIndicator}>
            <Check size={12} color="#FFFFFF" />
          </View>
        )}
        
        {/* Loading indicator (small, unobtrusive) */}
        {isLoading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
        
        {/* Error indicator */}
        {state === 'error' && (
          <View style={styles.errorIndicator}>
            <AlertCircle size={16} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Normal mode - full UI (used when no rendered preview)
  return (
    <TouchableOpacity
      onPress={state === 'error' && onRetry ? onRetry : onPress}
      activeOpacity={isLoading ? 1 : 0.8}
      disabled={isLoading && state !== 'error'}
      style={[
        styles.container,
        {
          left: slot.x,
          top: slot.y,
          width: slot.width,
          height: slot.height,
        },
        state === 'capturing' && styles.containerCapturing,
      ]}
    >
      {/* Empty State */}
      {state === 'empty' && (
        <View style={styles.emptyState}>
          <View style={styles.addButton}>
            <Plus size={24} color={Colors.light.textSecondary} />
          </View>
          <Text style={styles.emptyLabel}>{slot.label}</Text>
        </View>
      )}
      
      {/* Capturing State */}
      {state === 'capturing' && (
        <View style={styles.capturingState}>
          <View style={styles.capturingPulse} />
          <Text style={styles.capturingText}>Taking photo...</Text>
        </View>
      )}
      
      {/* Image with Loading Overlay */}
      {(isLoading || state === 'ready') && hasImage && (
        <>
          <Image
            source={imageUri ? { uri: imageUri } : undefined}
            style={styles.capturedImage}
            contentFit="cover"
            transition={200}
          />
          
          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.loadingText}>{getLoadingMessage()}</Text>
            </View>
          )}
          
          {/* Ready State - Tap to Replace indicator */}
          {state === 'ready' && (
            <View style={styles.readyOverlay}>
              <View style={styles.tapIndicator}>
                <RefreshCw size={12} color="#FFFFFF" />
                <Text style={styles.tapText}>Tap to replace</Text>
              </View>
            </View>
          )}
        </>
      )}
      
      {/* Loading without image (edge case) */}
      {isLoading && !hasImage && (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingStateText}>{getLoadingMessage()}</Text>
        </View>
      )}
      
      {/* Error State */}
      {state === 'error' && (
        <View style={styles.errorState}>
          {hasImage && (
            <Image
              source={imageUri ? { uri: imageUri } : undefined}
              style={[styles.capturedImage, styles.errorImage]}
              contentFit="cover"
            />
          )}
          <View style={styles.errorOverlay}>
            <AlertCircle size={24} color={Colors.light.error} />
            <Text style={styles.errorText} numberOfLines={2}>
              {errorMessage || 'Something went wrong'}
            </Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={onRetry}
              activeOpacity={0.8}
            >
              <RefreshCw size={14} color="#FFFFFF" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Slot Label Badge (always visible except in empty state) */}
      {state !== 'empty' && (
        <View style={[
          styles.labelBadge,
          state === 'error' && styles.labelBadgeError,
          isLoading && styles.labelBadgeLoading,
        ]}>
          <Text style={styles.labelText}>{slot.label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Transparent mode styles
  transparentContainer: {
    position: 'absolute',
    backgroundColor: 'transparent',
    // Slightly visible on press for feedback
  },
  filledIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(52, 199, 89, 0.9)', // Green success color
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  loadingIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.error,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Normal mode styles
  container: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  containerCapturing: {
    opacity: 0.7,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  
  // Capturing State
  capturingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  capturingPulse: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 8,
  },
  capturingText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  
  // Captured Image
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  
  // Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  
  // Loading State (no image)
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  loadingStateText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  
  // Ready State Overlay
  readyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
  },
  tapIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  tapText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  
  // Error State
  errorState: {
    flex: 1,
  },
  errorImage: {
    opacity: 0.4,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  retryText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  // Label Badge
  labelBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  labelBadgeError: {
    backgroundColor: Colors.light.error,
  },
  labelBadgeLoading: {
    backgroundColor: Colors.light.accent,
  },
  labelText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default SlotRegion;
