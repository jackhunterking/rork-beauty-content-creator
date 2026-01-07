import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { Download, Share2, Save, CheckCircle } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import Colors from '@/constants/colors';
import { saveToGallery } from '@/services/downloadService';
import { shareImage } from '@/services/shareService';
import { renderTemplate, RenderProgress } from '@/services/renderService';

interface EditorActionBarProps {
  // Whether all required slots are filled
  canDownload: boolean;
  
  // Current draft ID
  draftId: string | null;
  
  // Template info for rendering
  templateId: string;
  templatedId?: string;
  
  // Slot images for rendering
  slotImages: Record<string, string>;
  
  // Callback when save draft is pressed
  onSaveDraft: () => void;
  
  // Whether draft save is in progress
  isSavingDraft?: boolean;
  
  // Total and filled slot counts for helper text
  totalSlots: number;
  filledSlots: number;
  
  // Cached render path if available
  cachedRenderPath?: string | null;
  
  // Callback when render completes (to cache the result)
  onRenderComplete?: (localPath: string) => void;
}

type ActionState = 'idle' | 'rendering' | 'downloading' | 'sharing' | 'success' | 'error';

/**
 * EditorActionBar - Bottom action bar for editor screen
 * 
 * Actions:
 * - Download: Render and save to gallery
 * - Share: Render and open share sheet
 * - Save Draft: Save current progress (always available)
 */
export function EditorActionBar({
  canDownload,
  draftId,
  templateId,
  templatedId,
  slotImages,
  onSaveDraft,
  isSavingDraft = false,
  totalSlots,
  filledSlots,
  cachedRenderPath,
  onRenderComplete,
}: EditorActionBarProps) {
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  
  // Get or create rendered image
  const getRenderedImage = useCallback(async (): Promise<string | null> => {
    // If we have a cached render, use it
    if (cachedRenderPath) {
      return cachedRenderPath;
    }
    
    // Need to render via Templated.io
    if (!templatedId) {
      Alert.alert(
        'Not Available',
        'This template is not configured for rendering yet. Please try a different template.',
      );
      return null;
    }
    
    if (!draftId) {
      // Create a temporary draft ID for rendering
      const tempDraftId = `temp_${Date.now()}`;
      
      const result = await renderTemplate(
        {
          draftId: tempDraftId,
          templateId: templatedId,
          slotImages,
        },
        setRenderProgress
      );
      
      if (result.success && result.localPath) {
        onRenderComplete?.(result.localPath);
        return result.localPath;
      } else {
        throw new Error(result.error || 'Render failed');
      }
    }
    
    // Render with draft ID for caching
    const result = await renderTemplate(
      {
        draftId,
        templateId: templatedId,
        slotImages,
      },
      setRenderProgress
    );
    
    if (result.success && result.localPath) {
      onRenderComplete?.(result.localPath);
      return result.localPath;
    } else {
      throw new Error(result.error || 'Render failed');
    }
  }, [cachedRenderPath, templatedId, draftId, slotImages, onRenderComplete]);
  
  // Handle download
  const handleDownload = useCallback(async () => {
    if (!canDownload) return;
    
    try {
      setActionState('rendering');
      
      const imagePath = await getRenderedImage();
      if (!imagePath) {
        setActionState('idle');
        return;
      }
      
      setActionState('downloading');
      
      const result = await saveToGallery(imagePath);
      
      if (result.success) {
        setActionState('success');
        Toast.show({
          type: 'success',
          text1: 'Saved to gallery',
          text2: 'Your image has been saved to Photos',
          position: 'top',
          visibilityTime: 2000,
        });
        
        // Reset after showing success
        setTimeout(() => setActionState('idle'), 2000);
      } else {
        throw new Error(result.error || 'Save failed');
      }
      
    } catch (error) {
      console.error('Download failed:', error);
      setActionState('error');
      Toast.show({
        type: 'error',
        text1: 'Download failed',
        text2: error instanceof Error ? error.message : 'Please try again',
        position: 'top',
      });
      
      setTimeout(() => setActionState('idle'), 2000);
    }
  }, [canDownload, getRenderedImage]);
  
  // Handle share
  const handleShare = useCallback(async () => {
    if (!canDownload) return;
    
    try {
      setActionState('rendering');
      
      const imagePath = await getRenderedImage();
      if (!imagePath) {
        setActionState('idle');
        return;
      }
      
      setActionState('sharing');
      
      const result = await shareImage(imagePath, {
        dialogTitle: 'Share your creation',
      });
      
      if (result.success) {
        setActionState('idle');
        // Don't show toast for share as user sees the share sheet
      } else {
        throw new Error(result.error || 'Share failed');
      }
      
    } catch (error) {
      console.error('Share failed:', error);
      setActionState('error');
      Toast.show({
        type: 'error',
        text1: 'Share failed',
        text2: error instanceof Error ? error.message : 'Please try again',
        position: 'top',
      });
      
      setTimeout(() => setActionState('idle'), 2000);
    }
  }, [canDownload, getRenderedImage]);
  
  const isLoading = ['rendering', 'downloading', 'sharing'].includes(actionState);
  const showSuccess = actionState === 'success';
  
  // Get button state text
  const getDownloadButtonText = () => {
    switch (actionState) {
      case 'rendering':
        return renderProgress?.message || 'Rendering...';
      case 'downloading':
        return 'Saving...';
      case 'success':
        return 'Saved!';
      default:
        return 'Download';
    }
  };
  
  const getShareButtonText = () => {
    switch (actionState) {
      case 'rendering':
        return 'Rendering...';
      case 'sharing':
        return 'Opening...';
      default:
        return 'Share';
    }
  };

  return (
    <View style={styles.container}>
      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        {/* Download Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.primaryButton,
            (!canDownload || isLoading) && styles.buttonDisabled,
            showSuccess && styles.buttonSuccess,
          ]}
          onPress={handleDownload}
          disabled={!canDownload || isLoading}
          activeOpacity={0.8}
        >
          {isLoading && actionState !== 'sharing' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : showSuccess ? (
            <CheckCircle size={20} color="#FFFFFF" />
          ) : (
            <Download 
              size={20} 
              color={canDownload ? Colors.light.surface : Colors.light.textTertiary} 
            />
          )}
          <Text style={[
            styles.buttonText,
            styles.primaryButtonText,
            (!canDownload || isLoading) && styles.buttonTextDisabled,
          ]}>
            {getDownloadButtonText()}
          </Text>
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.secondaryButton,
            (!canDownload || isLoading) && styles.buttonDisabled,
          ]}
          onPress={handleShare}
          disabled={!canDownload || isLoading}
          activeOpacity={0.8}
        >
          {isLoading && actionState === 'sharing' ? (
            <ActivityIndicator size="small" color={Colors.light.text} />
          ) : (
            <Share2 
              size={20} 
              color={canDownload ? Colors.light.text : Colors.light.textTertiary} 
            />
          )}
          <Text style={[
            styles.buttonText,
            styles.secondaryButtonText,
            (!canDownload || isLoading) && styles.buttonTextDisabled,
          ]}>
            {getShareButtonText()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Helper Text */}
      {!canDownload && (
        <Text style={styles.helperText}>
          Add all {totalSlots} images to download or share ({filledSlots}/{totalSlots} added)
        </Text>
      )}
      
      {/* Render Progress */}
      {isLoading && renderProgress && renderProgress.progress !== undefined && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${renderProgress.progress}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{renderProgress.message}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryButton: {
    backgroundColor: Colors.light.text,
  },
  secondaryButton: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  buttonDisabled: {
    backgroundColor: Colors.light.border,
    borderColor: Colors.light.border,
  },
  buttonSuccess: {
    backgroundColor: Colors.light.success,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: Colors.light.surface,
  },
  secondaryButtonText: {
    color: Colors.light.text,
  },
  buttonTextDisabled: {
    color: Colors.light.textTertiary,
  },
  helperText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 12,
  },
  progressContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.light.accent,
    borderRadius: 2,
  },
  progressText: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
});

export default EditorActionBar;

