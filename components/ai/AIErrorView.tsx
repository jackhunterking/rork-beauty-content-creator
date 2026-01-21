/**
 * AI Error View
 * 
 * Friendly error state with retry option.
 * Shows human-readable messages based on error type.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/colors';

interface AIErrorViewProps {
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
}

// Map error messages to user-friendly versions
function getUserFriendlyMessage(error: string): { title: string; message: string; icon: keyof typeof Ionicons.glyphMap } {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('timeout') || lowerError.includes('took too long')) {
    return {
      title: 'Taking too long',
      message: 'The AI is experiencing high demand. Please try again in a moment.',
      icon: 'hourglass-outline',
    };
  }
  
  if (lowerError.includes('network') || lowerError.includes('connection') || lowerError.includes('fetch')) {
    return {
      title: 'Connection issue',
      message: 'Please check your internet connection and try again.',
      icon: 'wifi-outline',
    };
  }
  
  if (lowerError.includes('cancelled')) {
    return {
      title: 'Cancelled',
      message: 'Enhancement was cancelled.',
      icon: 'close-circle-outline',
    };
  }
  
  if (lowerError.includes('image') || lowerError.includes('format') || lowerError.includes('unsupported')) {
    return {
      title: 'Image issue',
      message: 'There was a problem with the image format. Try a different photo.',
      icon: 'image-outline',
    };
  }
  
  if (lowerError.includes('premium') || lowerError.includes('subscription')) {
    return {
      title: 'Premium required',
      message: 'This feature requires a premium subscription.',
      icon: 'star-outline',
    };
  }
  
  // Default error
  return {
    title: 'Something went wrong',
    message: 'We couldn\'t enhance your photo. Please try again.',
    icon: 'alert-circle-outline',
  };
}

export default function AIErrorView({
  error,
  onRetry,
  onDismiss,
}: AIErrorViewProps) {
  // Safety check for undefined error
  const safeError = error || 'An unexpected error occurred';
  const { title, message, icon } = getUserFriendlyMessage(safeError);
  
  return (
    <View style={styles.container}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={48} color={Colors.light.error} />
      </View>
      
      {/* Message */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      
      {/* Debug info (only shown in dev) */}
      {__DEV__ && error && (
        <Text style={styles.debugText}>{error}</Text>
      )}
      
      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${Colors.light.error}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  debugText: {
    fontSize: 11,
    color: Colors.light.textTertiary,
    fontFamily: 'monospace',
    marginBottom: 24,
    padding: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 8,
    maxWidth: '100%',
  },
  buttonContainer: {
    width: '100%',
    marginTop: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 12,
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
});
