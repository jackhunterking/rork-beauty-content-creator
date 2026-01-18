/**
 * EditorSubPanel Component
 * 
 * Reusable compact bottom panel wrapper for editor sub-menus.
 * Follows Canva's pattern: 25% height, rounded top corners, subtle shadow.
 * Used for Text Style, Logo, and other editing panels.
 */

import React, { useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import BottomSheet, { 
  BottomSheetView, 
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// iOS-native spring configuration
const IOS_SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

export interface EditorSubPanelProps {
  /** Panel title displayed in header */
  title: string;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Called when panel is closed */
  onClose?: () => void;
  /** Whether to use scrollable content */
  scrollable?: boolean;
  /** Custom snap points (default is ['25%']) */
  snapPoints?: string[];
  /** Whether to show backdrop */
  showBackdrop?: boolean;
  /** Whether to enable pan down to close */
  enablePanDownToClose?: boolean;
  /** Content to render inside the panel */
  children: React.ReactNode;
  /** Optional footer content (e.g., category tabs) */
  footer?: React.ReactNode;
  /** Whether the header is visible */
  showHeader?: boolean;
}

export interface EditorSubPanelRef {
  open: () => void;
  close: () => void;
  snapToIndex: (index: number) => void;
}

export const EditorSubPanel = forwardRef<EditorSubPanelRef, EditorSubPanelProps>(
  function EditorSubPanel(
    {
      title,
      showCloseButton = true,
      onClose,
      scrollable = false,
      snapPoints: customSnapPoints,
      showBackdrop = false,
      enablePanDownToClose = true,
      children,
      footer,
      showHeader = true,
    },
    ref
  ) {
    const bottomSheetRef = useRef<BottomSheet>(null);

    // Default snap points - 25% for compact panel
    const snapPoints = useMemo(
      () => customSnapPoints || ['25%'],
      [customSnapPoints]
    );

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      open: () => {
        bottomSheetRef.current?.snapToIndex(0);
      },
      close: () => {
        bottomSheetRef.current?.close();
        onClose?.();
      },
      snapToIndex: (index: number) => {
        bottomSheetRef.current?.snapToIndex(index);
      },
    }));

    // Handle close button press
    const handleClose = useCallback(() => {
      bottomSheetRef.current?.close();
      onClose?.();
    }, [onClose]);

    // Handle sheet changes
    const handleSheetChange = useCallback(
      (index: number) => {
        if (index === -1) {
          onClose?.();
        }
      },
      [onClose]
    );

    // Render backdrop (optional)
    const renderBackdrop = useCallback(
      (props: any) =>
        showBackdrop ? (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={0.3}
            pressBehavior="close"
          />
        ) : null,
      [showBackdrop]
    );

    // Content wrapper based on scrollable prop
    const ContentWrapper = scrollable ? BottomSheetScrollView : BottomSheetView;

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={enablePanDownToClose}
        backdropComponent={renderBackdrop}
        onChange={handleSheetChange}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
        style={styles.bottomSheet}
      >
        {/* Header */}
        {showHeader && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {showCloseButton && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Content */}
        <ContentWrapper
          style={styles.content}
          contentContainerStyle={scrollable ? styles.scrollContent : undefined}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ContentWrapper>

        {/* Footer (e.g., category tabs) */}
        {footer && <View style={styles.footer}>{footer}</View>}
      </BottomSheet>
    );
  }
);

/**
 * Category Tab component for use in panel footers
 */
interface CategoryTabProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

export function CategoryTab({ label, isActive, onPress }: CategoryTabProps) {
  return (
    <TouchableOpacity
      style={[styles.categoryTab, isActive && styles.categoryTabActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.categoryTabLabel,
          isActive && styles.categoryTabLabelActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Horizontal scrollable category tabs for panel footer
 */
interface CategoryTabsProps {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabPress: (id: string) => void;
}

export function CategoryTabs({ tabs, activeTab, onTabPress }: CategoryTabsProps) {
  return (
    <View style={styles.categoryTabsContainer}>
      {tabs.map((tab) => (
        <CategoryTab
          key={tab.id}
          label={tab.label}
          isActive={activeTab === tab.id}
          onPress={() => onTabPress(tab.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomSheet: {
    // iOS-style shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  background: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handleIndicator: {
    backgroundColor: 'rgba(60, 60, 67, 0.3)',
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    position: 'relative',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.borderLight,
  },
  // Category tabs styles
  categoryTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  categoryTabActive: {
    backgroundColor: Colors.light.surfaceSecondary,
  },
  categoryTabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  categoryTabLabelActive: {
    color: Colors.light.text,
    fontWeight: '600',
  },
});

export default EditorSubPanel;
