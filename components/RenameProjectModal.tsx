import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import Colors from '@/constants/colors';
import { validateProjectName } from '@/utils/projectName';

interface RenameProjectModalProps {
  visible: boolean;
  currentName: string | null;
  onSave: (name: string | null) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Modal for renaming a project
 * 
 * Features:
 * - Pre-filled with current name (or empty)
 * - Max 50 character limit
 * - Save/Cancel buttons
 * - Auto-focus input on open
 */
export default function RenameProjectModal({
  visible,
  currentName,
  onSave,
  onCancel,
  isLoading = false,
}: RenameProjectModalProps) {
  const [name, setName] = useState(currentName || '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setName(currentName || '');
      setError(null);
      // Focus input after a brief delay to ensure modal is fully visible
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible, currentName]);

  const handleSave = () => {
    const trimmed = name.trim();
    const validation = validateProjectName(trimmed);
    
    if (!validation.isValid) {
      setError(validation.error || 'Invalid name');
      return;
    }
    
    // Save null if empty (will show date as fallback)
    onSave(trimmed.length > 0 ? trimmed : null);
  };

  const handleChangeText = (text: string) => {
    setName(text);
    // Clear error when user types
    if (error) {
      setError(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} />
        
        <View style={styles.content}>
          <Text style={styles.title}>Rename Project</Text>
          
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={[styles.input, error && styles.inputError]}
              value={name}
              onChangeText={handleChangeText}
              placeholder="Project name"
              placeholderTextColor={Colors.light.textTertiary}
              maxLength={50}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              editable={!isLoading}
            />
            <Text style={styles.charCount}>
              {name.length}/50
            </Text>
          </View>
          
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
          
          <Text style={styles.hint}>
            Leave empty to show the date instead
          </Text>
          
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.saveButton, isLoading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isLoading}
            >
              <Text style={styles.saveButtonText}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 50,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  inputError: {
    borderColor: Colors.light.error,
  },
  charCount: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -8 }],
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  errorText: {
    fontSize: 13,
    color: Colors.light.error,
    marginTop: 8,
  },
  hint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    backgroundColor: Colors.light.surfaceSecondary,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  saveButton: {
    backgroundColor: Colors.light.accent,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.surface,
  },
});
