# Superwall Paywall Build Guide: "Download Your Creation"

## Overview

You are building a paywall in Superwall's web-based paywall editor for a beauty content creator mobile app called "Resulta". This paywall appears when a free user tries to download their creation. The goal is to convert them to the Pro subscription.

**Paywall Name:** Download Your Creation
**Placement ID:** `pro_download`
**Target Tier:** Pro
**Pricing:** Weekly ($4.99) and Monthly ($14.99)

---

## Brand Design System

### Colors (Use These Exact Hex Values)

| Color Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| Gold Accent | `#C9A87C` | rgb(201, 168, 124) | Primary buttons, icons, highlights, selected states |
| Gold Light BG | `#C9A87C` at 15% opacity | rgba(201, 168, 124, 0.15) | Badge backgrounds, icon backgrounds |
| Gold Ultra Light | `#C9A87C` at 8% opacity | rgba(201, 168, 124, 0.08) | Benefit icon backgrounds |
| Background | `#FEFCF9` | rgb(254, 252, 249) | Main page background |
| Surface White | `#FFFFFF` | rgb(255, 255, 255) | Cards, selected option backgrounds |
| Surface Secondary | `#F7F4F0` | rgb(247, 244, 240) | Unselected options, secondary backgrounds |
| Text Primary | `#1A1614` | rgb(26, 22, 20) | Headlines, main text, prices |
| Text Secondary | `#6B635B` | rgb(107, 99, 91) | Subheads, descriptions, dismiss link |
| Text Tertiary | `#9C948C` | rgb(156, 148, 140) | Legal text, hints |
| Border | `#E8E4DF` | rgb(232, 228, 223) | Unselected radio button borders |
| White | `#FFFFFF` | rgb(255, 255, 255) | Button text |
| Black Overlay | `#000000` at 40% opacity | rgba(0, 0, 0, 0.4) | Dismiss button background on hero |

### Typography

| Element | Font Size | Font Weight | Line Height |
|---------|-----------|-------------|-------------|
| Headline | 28px | Bold (700) | 1.2 |
| Subhead | 15px | Regular (400) | 1.4 |
| Tier Badge Text | 11px | Bold (700) | 1.0 |
| Benefit Text | 15px | Medium (500) | 1.3 |
| Pricing Period Label | 15px | Semibold (600) | 1.3 |
| Pricing Amount | 18px | Bold (700) | 1.2 |
| Pricing Period Suffix | 13px | Regular (400) | 1.2 |
| Savings Label | 11px | Semibold (600) | 1.0 |
| CTA Button Text | 17px | Semibold (600) | 1.0 |
| Dismiss Link | 15px | Regular (400) | 1.0 |
| Legal Text | 11px | Regular (400) | 1.4 |

### Spacing & Sizing

| Element | Value |
|---------|-------|
| Content horizontal padding | 24px |
| Hero image height | 200px |
| Content card top corner radius | 24px |
| Content card negative margin (overlaps hero) | -24px |
| Icon badge size | 44px × 44px |
| Icon badge corner radius | 12px |
| Tier badge padding | 12px horizontal, 6px vertical |
| Tier badge corner radius | 8px |
| Gap between icon badge and tier badge | 12px |
| Gap below headline | 6px |
| Gap below subhead | 20px |
| Benefit icon size | 36px × 36px |
| Benefit icon corner radius | 10px |
| Gap between benefit items | 12px |
| Gap between benefit icon and text | 12px |
| Gap below benefits section | 24px |
| Gap between pricing options | 10px |
| Pricing option padding | 16px horizontal, 14px vertical |
| Pricing option corner radius | 14px |
| Pricing option border width (selected) | 2px |
| Radio button size | 20px × 20px |
| Radio button inner dot size | 10px |
| Gap below pricing section | 20px |
| CTA button padding | 16px vertical |
| CTA button corner radius | 14px |
| Gap below CTA button | 10px |
| Dismiss link padding | 10px vertical |
| Gap below dismiss link | 4px |

---

## Complete Paywall Structure

### Visual Layout (Top to Bottom)

```
┌─────────────────────────────────────────────┐
│                                             │
│            [HERO IMAGE]                     │
│                                         [X] │  ← Dismiss button (top-right)
│            200px height                     │
│                                             │
├─────────────────────────────────────────────┤  ← Card overlaps hero by 24px
│                                             │
│  [Download Icon]  [PRO badge]               │  ← Icon 44px, badge next to it
│                                             │
│  Download Your Creation                     │  ← 28px Bold
│  Save high-quality images to your photos    │  ← 15px Secondary color
│                                             │
│  ┌──────┐  Unlimited downloads              │
│  │  ↓   │                                   │  ← 4 benefit rows
│  └──────┘                                   │
│  ┌──────┐  Share to all platforms           │
│  │  ↗   │                                   │
│  └──────┘                                   │
│  ┌──────┐  No watermarks                    │
│  │  ✨  │                                   │
│  └──────┘                                   │
│  ┌──────┐  Priority support                 │
│  │  🎧  │                                   │
│  └──────┘                                   │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ○  Weekly              $4.99/week   │    │  ← Unselected state
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ●  Monthly             $14.99/mo    │    │  ← Selected state (gold border)
│  │    Save 25%                         │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │           Continue                  │    │  ← Gold background, white text
│  └─────────────────────────────────────┘    │
│                                             │
│              Not now                        │  ← Text link
│                                             │
│  Subscription automatically renews.         │  ← Legal text, centered
│  Cancel anytime.                            │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Step-by-Step Build Instructions for Superwall

### Step 1: Create New Paywall

1. Log into Superwall dashboard at https://superwall.com
2. Navigate to **Paywalls** in the left sidebar
3. Click **"Create Paywall"** or **"+ New Paywall"** button
4. Select **"Start from scratch"** or blank template
5. Name the paywall: `Download Your Creation`
6. Set the placement: `pro_download`

### Step 2: Set Up Canvas/Background

1. Click on the main canvas/background element
2. Set background color to: `#FEFCF9`
3. Set the paywall to full-screen mode if available

### Step 3: Add Hero Image Section

1. Add an **Image** component at the top
2. Set height to: `200px`
3. Set width to: `100%` (full width)
4. Set content mode/fit to: `Cover` or `Fill`
5. Upload or set image URL to a beauty/makeup themed image (example: professional makeup brushes, beauty products, or content creator setup)
6. Add an overlay on the image:
   - Color: `#000000` (black)
   - Opacity: `15%`

### Step 4: Add Dismiss/Close Button

1. Add a **Button** or **Icon Button** component
2. Position it in the top-right corner of the hero image
3. Set the icon to: **X** (close icon)
4. Set icon color to: `#FFFFFF` (white)
5. Set icon size to: `22px`
6. Set button background:
   - Color: `#000000`
   - Opacity: `40%`
   - Shape: Circle
   - Size: `36px × 36px`
7. Set the action to: **Dismiss paywall**

### Step 5: Create Content Card Container

1. Add a **Container** or **View** component below the hero
2. Set background color to: `#FEFCF9`
3. Set corner radius: `24px` (top-left and top-right only)
4. Set padding: `24px` on left and right
5. Set padding top: `24px`
6. Position it to overlap the hero by `24px` (negative margin or manual positioning)

### Step 6: Add Header Row (Icon + Tier Badge)

1. Inside the content card, add a **Horizontal Stack** or **Row**
2. Set alignment to: `center` (vertically)
3. Set gap/spacing to: `12px`

#### 6a: Add Icon Badge

1. Add a **View** or **Container** inside the row
2. Set size to: `44px × 44px`
3. Set corner radius to: `12px`
4. Set background color to: `rgba(201, 168, 124, 0.15)` or `#C9A87C` at 15% opacity
5. Center content inside
6. Add a **Download icon** inside:
   - Size: `24px`
   - Color: `#C9A87C`

#### 6b: Add Tier Badge

1. Add a **View** or **Container** next to the icon
2. Set padding: `12px` horizontal, `6px` vertical
3. Set corner radius: `8px`
4. Set background color to: `rgba(201, 168, 124, 0.15)` or `#C9A87C` at 15% opacity
5. Add **Text** inside:
   - Content: `PRO`
   - Font size: `11px`
   - Font weight: `Bold (700)`
   - Color: `#C9A87C`
   - Letter spacing: `0.5px`

### Step 7: Add Headline

1. Add a **Text** component below the header row
2. Set content to: `Download Your Creation`
3. Set font size to: `28px`
4. Set font weight to: `Bold (700)`
5. Set color to: `#1A1614`
6. Set margin/spacing bottom: `6px`

### Step 8: Add Subhead

1. Add a **Text** component below the headline
2. Set content to: `Save high-quality images to your photos`
3. Set font size to: `15px`
4. Set font weight to: `Regular (400)`
5. Set color to: `#6B635B`
6. Set line height to: `1.4` or `21px`
7. Set margin/spacing bottom: `20px`

### Step 9: Add Benefits List

1. Add a **Vertical Stack** or **Column** container
2. Set gap/spacing between items: `12px`
3. Set margin/spacing bottom: `24px`

#### For each benefit, create a row:

**Benefit 1: Unlimited downloads**
1. Add a **Horizontal Stack** or **Row**
2. Set alignment: `center` (vertically)
3. Set gap: `12px`
4. Add icon container:
   - Size: `36px × 36px`
   - Corner radius: `10px`
   - Background: `rgba(201, 168, 124, 0.08)`
   - Icon: **Download** icon, `18px`, color `#C9A87C`
5. Add text:
   - Content: `Unlimited downloads`
   - Font size: `15px`
   - Font weight: `Medium (500)`
   - Color: `#1A1614`

**Benefit 2: Share to all platforms**
- Icon: **Share** icon (arrow pointing up-right)
- Text: `Share to all platforms`
- (Same styling as Benefit 1)

**Benefit 3: No watermarks**
- Icon: **Sparkles** icon (or stars)
- Text: `No watermarks`
- (Same styling as Benefit 1)

**Benefit 4: Priority support**
- Icon: **Headphones** icon
- Text: `Priority support`
- (Same styling as Benefit 1)

### Step 10: Add Pricing Section

1. Add a **Vertical Stack** container
2. Set gap: `10px`
3. Set margin bottom: `20px`

#### 10a: Weekly Option (Unselected by default)

1. Add a **Product Card** or custom **Touchable/Button** container
2. Set it to represent the **weekly** product
3. Styling for UNSELECTED state:
   - Background: `#F7F4F0`
   - Border: none or transparent
   - Corner radius: `14px`
   - Padding: `16px` horizontal, `14px` vertical
4. Inside, create a row with:
   - **Radio button** (left):
     - Size: `20px × 20px`
     - Border: `2px` solid `#E8E4DF`
     - Border radius: `50%` (circle)
     - No inner fill (unselected)
   - **Text** (middle):
     - Content: `Weekly`
     - Font size: `15px`
     - Font weight: `Semibold (600)`
     - Color: `#1A1614`
   - **Price** (right):
     - Content: `$4.99/week`
     - Amount (`$4.99`): `18px`, Bold, `#1A1614`
     - Period (`/week`): `13px`, Regular, `#6B635B`

#### 10b: Monthly Option (Selected by default)

1. Add another **Product Card** or container for **monthly** product
2. Styling for SELECTED state:
   - Background: `#FFFFFF`
   - Border: `2px` solid `#C9A87C`
   - Corner radius: `14px`
   - Padding: `16px` horizontal, `14px` vertical
3. Inside, create a row with:
   - **Radio button** (left):
     - Size: `20px × 20px`
     - Border: `2px` solid `#C9A87C`
     - Border radius: `50%` (circle)
     - Inner dot: `10px × 10px`, `#C9A87C`, centered
   - **Text column** (middle):
     - Label: `Monthly` - `15px`, Semibold, `#1A1614`
     - Savings: `Save 25%` - `11px`, Semibold, `#C9A87C`
   - **Price** (right):
     - Content: `$14.99/mo`
     - Amount (`$14.99`): `18px`, Bold, `#1A1614`
     - Period (`/mo`): `13px`, Regular, `#6B635B`

### Step 11: Add CTA Button

1. Add a **Purchase Button** component
2. Set it to trigger purchase of the selected product
3. Styling:
   - Background color: `#C9A87C`
   - Corner radius: `14px`
   - Padding: `16px` vertical
   - Width: `100%` (full width of container)
4. Button text:
   - Content: `Continue`
   - Font size: `17px`
   - Font weight: `Semibold (600)`
   - Color: `#FFFFFF`
   - Centered
5. Optional shadow:
   - Color: `#000000`
   - Opacity: `10%`
   - Offset Y: `2px`
   - Blur: `4px`

### Step 12: Add Dismiss Link

1. Add a **Button** or **Touchable Text** component
2. Set action to: **Dismiss paywall**
3. Styling:
   - Background: transparent/none
   - Padding: `10px` vertical
   - Width: centered or auto
4. Text:
   - Content: `Not now`
   - Font size: `15px`
   - Font weight: `Regular (400)`
   - Color: `#6B635B`
   - Centered

### Step 13: Add Legal Text

1. Add a **Text** component at the bottom
2. Set content to: `Subscription automatically renews. Cancel anytime.`
3. Styling:
   - Font size: `11px`
   - Font weight: `Regular (400)`
   - Color: `#9C948C`
   - Text align: `center`
   - Margin top: `4px`

### Step 14: Configure Products

1. Go to paywall settings or product configuration
2. Link the **Weekly** option to your weekly Pro subscription product
3. Link the **Monthly** option to your monthly Pro subscription product
4. Set **Monthly** as the default selected option

### Step 15: Preview and Test

1. Click **Preview** to see the paywall on device mockup
2. Test on both iPhone SE (small) and iPhone 14 Pro (large) sizes
3. Verify:
   - [ ] Hero image displays correctly
   - [ ] Dismiss button is visible and clickable
   - [ ] All text is readable
   - [ ] Benefits icons display correctly
   - [ ] Radio buttons toggle between options
   - [ ] Monthly is selected by default
   - [ ] CTA button is tappable
   - [ ] "Not now" dismisses the paywall
   - [ ] Legal text is visible at bottom

### Step 16: Save and Publish

1. Click **Save** to save your changes
2. Review all settings
3. Click **Publish** when ready to make it live

---

## Quick Reference: All Text Content

| Element | Content |
|---------|---------|
| Headline | Download Your Creation |
| Subhead | Save high-quality images to your photos |
| Tier Badge | PRO |
| Benefit 1 | Unlimited downloads |
| Benefit 2 | Share to all platforms |
| Benefit 3 | No watermarks |
| Benefit 4 | Priority support |
| Weekly Label | Weekly |
| Weekly Price | $4.99/week |
| Monthly Label | Monthly |
| Monthly Savings | Save 25% |
| Monthly Price | $14.99/mo |
| CTA Button | Continue |
| Dismiss Link | Not now |
| Legal Text | Subscription automatically renews. Cancel anytime. |

---

## Quick Reference: All Colors

| Element | Color |
|---------|-------|
| Page background | `#FEFCF9` |
| Hero overlay | `rgba(0, 0, 0, 0.15)` |
| Dismiss button BG | `rgba(0, 0, 0, 0.4)` |
| Dismiss button icon | `#FFFFFF` |
| Content card BG | `#FEFCF9` |
| Icon badge BG | `rgba(201, 168, 124, 0.15)` |
| Icon color | `#C9A87C` |
| Tier badge BG | `rgba(201, 168, 124, 0.15)` |
| Tier badge text | `#C9A87C` |
| Headline | `#1A1614` |
| Subhead | `#6B635B` |
| Benefit icon BG | `rgba(201, 168, 124, 0.08)` |
| Benefit icon | `#C9A87C` |
| Benefit text | `#1A1614` |
| Unselected option BG | `#F7F4F0` |
| Unselected radio border | `#E8E4DF` |
| Selected option BG | `#FFFFFF` |
| Selected option border | `#C9A87C` |
| Selected radio fill | `#C9A87C` |
| Price text | `#1A1614` |
| Price period | `#6B635B` |
| Savings text | `#C9A87C` |
| CTA button BG | `#C9A87C` |
| CTA button text | `#FFFFFF` |
| Dismiss link | `#6B635B` |
| Legal text | `#9C948C` |

---

## Important Notes

1. **No free trials** - Do not add any trial messaging or "Start free trial" buttons
2. **No yearly option** - Only show Weekly and Monthly
3. **Monthly is default** - The monthly option should be pre-selected when the paywall opens
4. **Gold accent only** - Use `#C9A87C` for all accent colors, no purple or other colors
5. **Keep it lean** - Do not add extra sections, testimonials, or additional content
6. **Mobile-first** - This is for iOS, ensure it looks good on all iPhone sizes
