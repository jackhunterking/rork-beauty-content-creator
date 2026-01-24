# Superwall Paywall Design Specifications

This document provides exact specifications for recreating the Resulta paywall designs in Superwall's native UI builder.

---

## Table of Contents

1. [Design System](#design-system)
2. [Pro Tier Paywalls](#pro-tier-paywalls)
   - [Download](#1-download-paywall)
   - [Share](#2-share-paywall)
   - [Remove Watermark](#3-remove-watermark-paywall)
3. [Studio Tier Paywalls](#studio-tier-paywalls)
   - [AI Remove Background](#4-ai-remove-background-paywall)
   - [AI Auto Quality](#5-ai-auto-quality-paywall)
4. [Membership Comparison](#6-membership-comparison-paywall)
5. [Superwall Component Mapping](#superwall-component-mapping)

---

## Design System

### Colors

| Name | Hex Code | Usage |
|------|----------|-------|
| **Pro Accent (Gold)** | `#C9A87C` | Pro tier buttons, icons, highlights |
| **Studio Accent (Dark Gold)** | `#A88B5E` | Studio tier buttons, icons, highlights |
| **Background** | `#FEFCF9` | Page background |
| **Surface** | `#FFFFFF` | Cards, inputs |
| **Surface Secondary** | `#F7F4F0` | Unselected options, secondary backgrounds |
| **Text Primary** | `#1A1614` | Headlines, primary text |
| **Text Secondary** | `#6B635B` | Subheads, descriptions |
| **Text Tertiary** | `#9C948C` | Legal text, hints |
| **Border** | `#E8E4DF` | Borders, dividers |
| **White** | `#FFFFFF` | Button text on accent |

### Typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Headline | 28px (24px on small screens) | Bold (700) | Text Primary |
| Subhead | 15px | Regular (400) | Text Secondary |
| Tier Badge | 11px | Bold (700) | Accent color |
| Benefit Text | 15px | Medium (500) | Text Primary |
| Price Amount | 18px | Bold (700) | Text Primary |
| Price Period | 13px | Regular (400) | Text Secondary |
| CTA Button | 17px | Semibold (600) | White |
| Dismiss Link | 15px | Regular (400) | Text Secondary |
| Legal Text | 11px | Regular (400) | Text Tertiary |
| Savings Label | 11px | Semibold (600) | Accent color |

### Spacing

| Element | Value |
|---------|-------|
| Page horizontal padding | 24px |
| Section gaps | 20-24px |
| Benefit item gap | 12px |
| Pricing option gap | 10px |
| Button border radius | 14px |
| Card border radius | 24px |
| Icon badge size | 44x44px |
| Icon badge radius | 12px |
| Benefit icon size | 36x36px |
| Benefit icon radius | 10px |

---

## Pro Tier Paywalls

These three paywalls share the same structure, differing only in headline, subhead, and hero image.

### 1. Download Paywall

**Placement ID:** `pro_download`

**Trigger Context:** User taps Download button without Pro subscription

#### Hero Image
- **Source:** Beauty/makeup themed image
- **Height:** 200px (160px on small screens)
- **Overlay:** Semi-transparent black (15% opacity)
- **Dismiss button:** Top-right, 36x36px circle, dark semi-transparent background

#### Content

| Element | Value |
|---------|-------|
| **Icon** | Download icon (24px, Gold #C9A87C) |
| **Tier Badge** | "PRO" |
| **Tier Badge BG** | Gold at 15% opacity |
| **Headline** | "Download Your Creation" |
| **Subhead** | "Save high-quality images to your photos" |

#### Benefits (4 items)

| Icon | Text |
|------|------|
| Download | Unlimited downloads |
| Share | Share to all platforms |
| Sparkles | No watermarks |
| Headphones | Priority support |

#### Pricing

| Period | Price | Notes |
|--------|-------|-------|
| Weekly | $4.99/week | Radio button style |
| Monthly | $14.99/mo | Show "Save 25%" below label |

**Default selection:** Monthly

#### CTA
- **Text:** "Continue"
- **Background:** Gold (#C9A87C)
- **Text Color:** White

#### Dismiss
- **Text:** "Not now"
- **Style:** Plain text link, Text Secondary color

#### Legal
- **Text:** "Subscription automatically renews. Cancel anytime."

---

### 2. Share Paywall

**Placement ID:** `pro_share`

**Trigger Context:** User taps Share button without Pro subscription

#### Content (differs from Download)

| Element | Value |
|---------|-------|
| **Icon** | Share icon (24px, Gold #C9A87C) |
| **Headline** | "Share to Your Audience" |
| **Subhead** | "Post directly to Instagram, TikTok & more" |

#### Benefits (4 items, reordered)

| Icon | Text |
|------|------|
| Share | Share to all platforms |
| Download | Unlimited downloads |
| Sparkles | No watermarks |
| Headphones | Priority support |

*All other elements identical to Download paywall*

---

### 3. Remove Watermark Paywall

**Placement ID:** `pro_watermark`

**Trigger Context:** User taps "Upgrade to remove watermark" banner

#### Content (differs from Download)

| Element | Value |
|---------|-------|
| **Icon** | Sparkles icon (24px, Gold #C9A87C) |
| **Headline** | "Go Watermark-Free" |
| **Subhead** | "Export clean, professional content" |

#### Benefits (4 items, reordered)

| Icon | Text |
|------|------|
| Sparkles | No watermarks |
| Download | Unlimited downloads |
| Share | Share to all platforms |
| Headphones | Priority support |

*All other elements identical to Download paywall*

---

## Studio Tier Paywalls

These paywalls use the darker gold accent color and have AI-focused benefits.

### 4. AI Remove Background Paywall

**Placement ID:** `studio_ai_remove_bg`

**Trigger Context:** User taps AI Remove Background without Studio subscription

#### Content

| Element | Value |
|---------|-------|
| **Icon** | Image-minus icon (24px, Dark Gold #A88B5E) |
| **Tier Badge** | "STUDIO" |
| **Tier Badge BG** | Dark Gold at 15% opacity |
| **Headline** | "AI Background Removal" |
| **Subhead** | "Instantly remove backgrounds with one tap" |

#### Benefits (4 items)

| Icon | Text |
|------|------|
| Image-minus | AI Background Remove |
| Palette | AI Background Replace |
| Wand | AI Auto Quality |
| Crown | All Pro features included |

#### Pricing

| Period | Price | Notes |
|--------|-------|-------|
| Weekly | $7.99/week | Radio button style |
| Monthly | $24.99/mo | Show "Save 22%" below label |

**Default selection:** Monthly

#### CTA
- **Background:** Dark Gold (#A88B5E)

*All other styling identical to Pro paywalls*

---

### 5. AI Auto Quality Paywall

**Placement ID:** `studio_ai_auto_quality`

**Trigger Context:** User taps AI Auto Quality without Studio subscription

#### Content (differs from AI Remove BG)

| Element | Value |
|---------|-------|
| **Icon** | Wand icon (24px, Dark Gold #A88B5E) |
| **Headline** | "AI Auto Enhance" |
| **Subhead** | "Automatically perfect your photos" |

#### Benefits (4 items, reordered)

| Icon | Text |
|------|------|
| Wand | AI Auto Quality |
| Image-minus | AI Background Remove |
| Palette | AI Background Replace |
| Crown | All Pro features included |

*All other elements identical to AI Remove Background paywall*

---

## 6. Membership Comparison Paywall

**Placement ID:** `membership_upgrade` or `membership_manage`

**Trigger Context:** User opens Membership screen or wants to compare plans

This paywall includes a **toggle** to switch between Pro and Studio plans.

### Structure

```
[Hero Image]
[Icon + Tier Badge]
[Headline: "Choose Your Plan"]
[Subhead: "Unlock features and create without limits"]

[Pro Toggle] [Studio Toggle + POPULAR badge]

[Benefits List - changes based on toggle]
[Pricing - changes based on toggle]
[CTA Button]
[Dismiss Link]
[Legal Text]
```

### Toggle Component

Two side-by-side buttons:

#### Pro Toggle (Left)
| State | Background | Border | Text Color |
|-------|------------|--------|------------|
| Unselected | Surface Secondary (#F7F4F0) | None | Text Secondary |
| Selected | White | 2px Gold (#C9A87C) | Gold |

- **Icon:** Crown (18px)
- **Label:** "Pro"

#### Studio Toggle (Right)
| State | Background | Border | Text Color |
|-------|------------|--------|------------|
| Unselected | Surface Secondary (#F7F4F0) | None | Text Secondary |
| Selected | White | 2px Dark Gold (#A88B5E) | Dark Gold |

- **Icon:** Sparkles (18px)
- **Label:** "Studio"
- **Badge:** "POPULAR" (top-right corner, Dark Gold background, white text, 8px font)

### Pro Benefits (when Pro selected)

| Icon | Text |
|------|------|
| Download | Unlimited downloads |
| Share | Share to all platforms |
| Sparkles | No watermarks |
| Headphones | Priority support |

**Pricing:** $4.99/week or $14.99/month

### Studio Benefits (when Studio selected)

| Icon | Text |
|------|------|
| Crown | Everything in Pro |
| Wand | AI Auto Quality |
| Image-minus | AI Background Remove |
| Palette | AI Background Replace |

**Pricing:** $7.99/week or $24.99/month

---

## Superwall Component Mapping

Use this reference to map our design to Superwall's native components:

### Layout Structure

```
Superwall Template: Full Screen

├── Image (Hero)
│   ├── Height: 200px
│   ├── Content Mode: Cover
│   └── Overlay: Linear gradient or solid color overlay
│
├── Close Button (X)
│   ├── Position: Top-right on hero
│   ├── Style: Circle with semi-transparent background
│   └── Size: 36x36px
│
├── Container (Content Card)
│   ├── Background: #FEFCF9
│   ├── Corner Radius: 24px (top only)
│   ├── Padding: 24px horizontal
│   │
│   ├── HStack (Header Row)
│   │   ├── Icon Badge (44x44px, rounded 12px)
│   │   └── Tier Pill ("PRO" or "STUDIO")
│   │
│   ├── Text (Headline)
│   │   ├── Size: 28px
│   │   └── Weight: Bold
│   │
│   ├── Text (Subhead)
│   │   ├── Size: 15px
│   │   └── Color: Secondary
│   │
│   ├── VStack (Benefits)
│   │   └── 4x HStack (Icon + Text)
│   │
│   ├── VStack (Pricing Options)
│   │   ├── Product Card (Weekly)
│   │   └── Product Card (Monthly) - with savings badge
│   │
│   ├── Purchase Button
│   │   ├── Background: Accent color
│   │   ├── Text: "Continue"
│   │   └── Corner Radius: 14px
│   │
│   ├── Restore Button (styled as text link)
│   │   └── Text: "Not now"
│   │
│   └── Text (Legal/Terms)
│       └── Size: 11px, centered
```

### Superwall Product Cards

For the pricing section, use Superwall's native Product components:

```
Product Card Structure:
├── Selection Indicator (Radio button)
│   ├── Size: 20x20px
│   ├── Border: 2px
│   └── Inner dot when selected
│
├── Period Label
│   ├── "Weekly" or "Monthly"
│   └── Font: 15px Semibold
│
├── Savings Badge (Monthly only)
│   ├── Text: "Save XX%"
│   └── Color: Accent
│
└── Price
    ├── Amount: 18px Bold
    └── Period: 13px Regular
```

### Dynamic Variables

Use these Superwall variables for dynamic content:

| Variable | Usage |
|----------|-------|
| `{{ product.price }}` | Display price |
| `{{ product.period }}` | Weekly/Monthly |
| `{{ product.savings_percentage }}` | Calculate savings |
| `{{ user.current_tier }}` | Show current plan |
| `{{ placement.feature_requested }}` | Context-specific headline |

---

## Placement Summary

| Placement ID | Tier | Trigger |
|--------------|------|---------|
| `pro_download` | Pro | Download button (free user) |
| `pro_share` | Pro | Share button (free user) |
| `pro_watermark` | Pro | Watermark banner tap |
| `studio_ai_remove_bg` | Studio | AI Remove BG button |
| `studio_ai_auto_quality` | Studio | AI Auto Quality button |
| `membership_upgrade` | Both | Membership screen |
| `membership_manage` | Both | Existing subscriber management |

---

## Testing Checklist

- [ ] Hero image loads correctly
- [ ] Dismiss button works
- [ ] Tier badge shows correct tier
- [ ] Benefits icons display properly
- [ ] Pricing shows correct amounts
- [ ] Monthly savings percentage calculates correctly
- [ ] Radio selection works between Weekly/Monthly
- [ ] CTA button triggers purchase
- [ ] "Not now" dismisses paywall
- [ ] Legal text is visible
- [ ] Safe areas respected on all iPhone models
- [ ] Toggle works for membership comparison (if applicable)

---

## Notes

1. **No free trials** - Do not add trial messaging
2. **No yearly plans** - Only show Weekly and Monthly
3. **No purple** - Studio uses Dark Gold (#A88B5E), not purple
4. **No user preview images** - Keep focus on benefits, not their creation
5. **Default to Monthly** - Higher value, better retention
6. **Keep it lean** - Minimal text, clear hierarchy, single action focus
