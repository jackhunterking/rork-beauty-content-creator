/**
 * Preset background colors for template customization
 * These are the 15 standard colors users can choose from
 * for client-side background color changes (zero API calls)
 */
export const BACKGROUND_COLORS = [
  '#FFFFFF', // White
  '#F5F5F5', // Light Gray
  '#E5E5E5', // Gray
  '#000000', // Black
  '#1A1A1A', // Near Black
  '#2C2C2C', // Charcoal
  '#FFF5F5', // Soft Pink
  '#FFF0F5', // Lavender Blush
  '#F0FFF4', // Honeydew
  '#F0F8FF', // Alice Blue
  '#FFFAF0', // Floral White
  '#F5F5DC', // Beige
  '#E6E6FA', // Lavender
  '#FFE4E1', // Misty Rose
  '#FDF5E6', // Old Lace
];

export default {
  light: {
    background: '#FEFCF9',
    surface: '#FFFFFF',
    surfaceSecondary: '#F7F4F0',
    text: '#1A1614',
    textSecondary: '#6B635B',
    textTertiary: '#9C948C',
    accent: '#C9A87C',
    accentDark: '#A88B5E',
    border: '#E8E4DF',
    borderLight: '#F0EDE9',
    success: '#5AAB61',
    error: '#D64545',
    warning: '#E5A43B',
    overlay: 'rgba(26, 22, 20, 0.5)',
    tint: '#C9A87C',
    tabIconDefault: '#9C948C',
    tabIconSelected: '#C9A87C',
    // Glass UI effects
    glassEdge: 'rgba(255, 255, 255, 0.5)',
    glassShadow: 'rgba(0, 0, 0, 0.04)',
    // AI Studio colors (brand-aligned)
    ai: {
      primary: '#C9A87C',
      primaryDark: '#A88B5E',
      lightBg: 'rgba(201, 168, 124, 0.1)',
      border: 'rgba(201, 168, 124, 0.3)',
      // Feature-specific gradients
      gradientQuality: ['#D4A574', '#E8C9A0'] as [string, string],
      gradientRemove: ['#9B8B7A', '#B5A696'] as [string, string],
      gradientReplace: ['#C9A87C', '#DFC7A0'] as [string, string],
    },
  },
};
