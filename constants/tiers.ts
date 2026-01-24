/**
 * Subscription Tier Configuration
 * 
 * Centralized configuration for subscription tier display across the app.
 * Colors and naming match the paywall designs (see docs/SUPERWALL_PAYWALL_DESIGNS.md).
 * 
 * Tiers:
 * - free: Full app access, create unlimited content, preview everything
 * - pro: Download to Photos + Share to social media  
 * - studio: Pro features + All AI generation capabilities
 */

import { Crown, Sparkles, User } from 'lucide-react-native';
import Colors from './colors';
import type { SubscriptionTier, SubscriptionTierSource } from '@/types';

/**
 * Tier colors from paywall design system
 * NOTE: Studio uses Dark Gold (#A88B5E), NOT purple
 */
export const TIER_COLORS = {
  free: Colors.light.textSecondary,
  pro: Colors.light.accent,      // Gold #C9A87C
  studio: Colors.light.accentDark, // Dark Gold #A88B5E (NOT purple!)
} as const;

/**
 * Tier display names
 */
export const TIER_NAMES = {
  free: 'Free',
  pro: 'Pro',
  studio: 'Studio',
} as const;

/**
 * Tier icons (Lucide React Native components)
 */
export const TIER_ICONS = {
  free: User,
  pro: Crown,
  studio: Sparkles,
} as const;

/**
 * Get tier display information
 * Use this to ensure consistent naming, colors, and icons across the app
 */
export function getTierDisplayInfo(tier: SubscriptionTier, source?: SubscriptionTierSource | 'none') {
  const isComplimentary = source === 'complimentary';
  
  const baseInfo = {
    free: {
      name: 'Free',
      shortName: 'Free',
      description: 'Basic features',
      icon: User,
      color: TIER_COLORS.free,
      backgroundColor: Colors.light.surfaceSecondary,
    },
    pro: {
      name: isComplimentary ? 'Complimentary Pro' : 'Pro',
      shortName: 'Pro',
      description: 'All features unlocked',
      icon: Crown,
      color: TIER_COLORS.pro,
      backgroundColor: 'rgba(201, 168, 124, 0.12)', // Gold at 12% opacity
    },
    studio: {
      name: isComplimentary ? 'Complimentary Studio' : 'Studio',
      shortName: 'Studio',
      description: 'All features + AI tools',
      icon: Sparkles,
      color: TIER_COLORS.studio,
      backgroundColor: 'rgba(168, 139, 94, 0.12)', // Dark Gold at 12% opacity
    },
  };
  
  return baseInfo[tier] || baseInfo.free;
}

/**
 * Check if tier is a paid tier (Pro or Studio)
 */
export function isPaidTier(tier: SubscriptionTier): boolean {
  return tier === 'pro' || tier === 'studio';
}

/**
 * Get human-readable tier label for UI
 * Returns "Pro Member" or "Studio Member" instead of just "Pro" or "Studio"
 */
export function getTierMemberLabel(tier: SubscriptionTier): string {
  if (tier === 'pro') return 'Pro Member';
  if (tier === 'studio') return 'Studio Member';
  return 'Free Plan';
}
