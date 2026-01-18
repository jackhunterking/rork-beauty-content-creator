# Resulta - Monetization Strategy

> **Version:** 2.0  
> **Last Updated:** January 2026  
> **Status:** Active - Value-First, Delayed Paywall Model

---

## Executive Summary

Resulta targets individual beauty business owners (aestheticians, nail techs, hair stylists, lash artists) who need professional social media content quickly.

Our monetization strategy follows a **"Value-First, Delayed Paywall"** approach where users experience the full value of the app before being prompted to pay. This maximizes engagement and conversion by ensuring users are invested in their creation before the paywall.

### Core Principles

1. **Value First**: Let users create complete, polished content before asking them to pay
2. **Frictionless Experience**: No premium badges, no locked features during editing
3. **Clear Value Exchange**: Users pay when they want to save/download their finished work
4. **Two Paywall Triggers Only**: Download and AI Enhancements
5. **Simple & Direct**: No tiers during creation, just one premium subscription

---

## How It Works

### User Journey

```
1. SELECT TEMPLATE    → All templates available, no premium badges
       ↓
2. ADD PHOTOS        → Full editing capabilities
       ↓
3. CUSTOMIZE         → Text, date, logo overlays - ALL FREE
       ↓
4. PREVIEW           → See finished creation in full quality
       ↓
5. DOWNLOAD/SHARE    → PAYWALL (if not subscribed)
       ↓
6. AI ENHANCEMENT    → PAYWALL (if not subscribed)
```

### Key Benefits

- **Higher Engagement**: Users invest time creating content before seeing paywall
- **Better Conversion**: Users see exactly what they'll get before paying
- **Reduced Friction**: No "preview vs premium" confusion
- **Clear Value**: "Pay to save what you created" is intuitive

---

## Free vs Premium Features

### ALWAYS FREE (No Restrictions)

| Feature | Details |
|---------|---------|
| **All Templates** | Access to entire template library |
| **All Formats** | 1:1, 4:5, 9:16, and any future formats |
| **Text Overlays** | Add, edit, style text freely |
| **Date Overlays** | Add, edit, style dates freely |
| **Logo Overlays** | Upload and add custom logos |
| **Brand Kit** | Upload logo, set brand colors |
| **Drafts** | Unlimited draft saving |
| **Image Editing** | Position, crop, adjust all photos |
| **Preview** | See full-quality finished preview |

### PREMIUM ONLY (Requires Subscription)

| Feature | Trigger Location |
|---------|------------------|
| **Download/Save to Photos** | Publish screen - "Save to Photos" button |
| **Share** | Publish screen - "Share" button |
| **AI Enhancements** | Editor - AI Enhance panel (e.g., background removal) |

---

## Paywall Triggers (Superwall Placements)

| User Action | Placement Name | When Triggered |
|-------------|----------------|----------------|
| Save to Photos | `download_image` | Publish screen - tap "Save to Photos" |
| Share | `share_image` | Publish screen - tap "Share" |
| AI Enhancement | `ai_enhance` | Editor - tap any AI feature |
| Settings Upgrade | `settings_upgrade` | Settings - tap "Upgrade to Pro" |

### Paywall Behavior

1. User taps Download/Share/AI
2. Check premium status via `usePremiumStatus()` hook
3. If premium → Execute action immediately
4. If not premium → Show Superwall paywall
5. If user subscribes → Execute action automatically
6. If user dismisses → Return to previous state (no action)

---

## What Was Removed

The following features have been completely removed from the system:

| Removed Feature | Reason |
|-----------------|--------|
| **Watermarks** | No longer needed - users pay to download instead |
| **Premium Template Badges** | All templates are accessible to everyone |
| **PRO Badges on Tools** | All editing tools are free (except AI) |
| **Premium Gating on Overlays** | Text, date, logo overlays are all free |
| **Brand Kit Premium Lock** | Brand Kit is free for all users |

---

## Pricing Structure

**Managed via Superwall Dashboard:**

| Plan | Suggested Price | Notes |
|------|-----------------|-------|
| Monthly | $7.99 - $12.99 | Good for testing users |
| Annual | $59.99 - $99.99 | ~30-40% discount |
| Lifetime | $149 - $249 | Early adopter offer |

### Value Proposition

- "Save your beautiful creation" - Pay when you're ready to keep your work
- "Unlimited downloads" - One subscription, export as many images as you want
- "AI-powered enhancements" - Professional-level features like background removal

---

## Analytics & ROAS Tracking

### Facebook Standard Events

Events use Facebook's official naming convention for proper attribution and optimization.
See `services/metaAnalyticsService.ts` for implementation.

| Facebook Event | When Triggered | Purpose |
|----------------|----------------|---------|
| `fb_mobile_activate_app` | App opened (automatic) | Track installs and opens |
| `fb_mobile_complete_registration` | User signs up | Track account creation |
| `fb_mobile_subscribe` | User subscribes | Subscription attribution |
| `fb_mobile_purchase` | User pays | Revenue tracking for ROAS |
| `fb_mobile_start_trial` | User starts trial | Trial-to-paid funnel |
| `fb_mobile_content_view` | User views template | Engagement tracking |
| `fb_mobile_initiated_checkout` | User views paywall | Conversion funnel |

### Standard Parameters Used

| Parameter | Description |
|-----------|-------------|
| `fb_content_id` | Product/template identifier |
| `fb_content_type` | Type of content (e.g., 'subscription', 'template') |
| `fb_currency` | Currency code (USD) |
| `fb_registration_method` | Sign-up method (apple, google, email) |
| `_valueToSum` | Revenue value for purchases |

### Funnel Metrics

| Stage | Metric | Target |
|-------|--------|--------|
| Install → Create | Content creation rate | >60% |
| Create → Download Attempt | Publish intent rate | >40% |
| Download Attempt → Subscribe | Conversion rate | 8-15% |
| Subscribe → Retain | Monthly retention | >75% |

---

## Settings Upgrade Path

Users can also upgrade directly from Settings:

```
Settings Screen
├── Account Section
├── Brand Kit Section (FREE)
├── ...
└── "Upgrade to Pro" button
    └── Triggers Superwall paywall (placement: settings_upgrade)
```

This provides an alternative conversion path for users who want to subscribe before hitting the download paywall.

---

## Implementation Details

### Premium Check Hook

```typescript
// hooks/usePremiumStatus.ts
const { isPremium, isLoading } = usePremiumStatus();
const { requestPremiumAccess, paywallState } = usePremiumFeature();

// Usage in publish.tsx
if (isPremium) {
  await executeDownload();
} else {
  await requestPremiumAccess('download_image', async () => {
    // Only called if user subscribes
    await executeDownload();
  });
}
```

### Files Modified for This Strategy

- `app/publish.tsx` - Added download/share paywall
- `app/editor-v2.tsx` - Removed premium gating on overlays
- `app/editor.tsx` - Removed watermark toggle
- `app/(tabs)/index.tsx` - Removed premium badges on templates
- `components/editor-v2/ToolDock.tsx` - Removed PRO badges (except AI)
- `components/editor-v2/AIEnhancePanel.tsx` - Maintains AI paywall
- `components/overlays/OverlayActionBar.tsx` - Removed premium gating
- `components/overlays/LogoPickerModal.tsx` - Removed premium check
- `app/(tabs)/settings.tsx` - Removed Brand Kit PRO badge
- `types/index.ts` - Removed watermark fields
- `services/renderService.ts` - Removed hideWatermark option
- `services/templateService.ts` - Removed watermarkedPreviewUrl
- `services/portfolioService.ts` - Removed hasWatermark field

---

## Success Metrics

### Primary KPIs

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Content Completion Rate | >50% | Users reaching publish screen |
| Download Attempt Rate | >40% | Users trying to save |
| Conversion Rate | 8-15% | Download attempt → Subscribe |
| ROAS | >1.5x | Return on ad spend |

### Monitoring

Track paywall performance via Superwall dashboard:
- Paywall view rate
- Conversion by placement
- Revenue by acquisition source

---

## Future Considerations

### Potential Enhancements

- **Free Download Quota**: First 1-3 downloads free to reduce friction
- **Social Sharing Bonus**: Free download for sharing app
- **Referral Program**: Premium access for successful referrals

### Features On Hold

- Video generation
- Multi-account support
- Direct social media posting

---

*Document maintained by Product Team. Configure pricing and A/B tests in Superwall dashboard.*
