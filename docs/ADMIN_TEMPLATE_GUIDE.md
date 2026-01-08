# Admin Template Guide

A complete guide for creating, naming, and syncing templates from Templated.io to the Resulta app.

---

## Table of Contents

1. [Overview](#overview)
2. [Layer Naming Convention](#layer-naming-convention)
3. [Creating a Template in Templated.io](#creating-a-template-in-templatedappio)
4. [Syncing Template to App](#syncing-template-to-app)
5. [Watermark Setup](#watermark-setup)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### How It Works

```
┌─────────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────┐
│  Templated.io   │ ──► │   N8n       │ ──► │   Supabase   │ ──► │   App   │
│  (Design)       │     │  (Webhook)  │     │  (Database)  │     │ (Users) │
└─────────────────┘     └─────────────┘     └──────────────┘     └─────────┘
```

1. **Design** template in Templated.io with correct layer names
2. **Sync** via webhook to save to Supabase
3. **Users** see the template in the app
4. **Rendering** happens at runtime via Templated.io API

### Key Concepts

- **No pre-rendered previews needed** - The app renders everything via Templated.io API
- **Slot layers** - Where user photos go (identified by `slot` in name)
- **Watermark layer** - "Made with Resulta" branding (hidden for premium users)
- **All other layers** - Labels, decorations, backgrounds (rendered automatically)

---

## Template Naming Convention

When syncing a template, you must follow this naming format for the **Template Name** field:

```
[Format]-[Type]-[Variant]
```

### Format Options
| Format | Canvas Size | Description |
|--------|-------------|-------------|
| `Square` | 1080 × 1080 | Instagram feed posts |
| `Vertical` | 1080 × 1920 | Stories, Reels, TikTok |
| `Portrait` | 1080 × 1350 | Instagram portrait posts |

### Type Options
| Type | Description |
|------|-------------|
| `BeforeAfter` | Standard 2-slot before/after layout |
| `ThreeSlot` | 3-photo progress layout |
| `FourSlot` | 4-photo grid layout |
| `Single` | Single hero image |
| `Carousel` | Multi-page carousel template |

### Variant
A descriptive PascalCase name for the specific design style.

### Examples

| Template Name | Description |
|---------------|-------------|
| `Square-BeforeAfter-Classic` | Basic square before/after |
| `Square-BeforeAfter-Minimal` | Clean minimal design |
| `Vertical-BeforeAfter-Labels` | Story with text labels |
| `Square-BeforeAfter-Nails` | Nail salon themed |
| `Vertical-BeforeAfter-Makeup` | Makeup transformation |
| `Square-ThreeSlot-Progress` | 3-photo progress |
| `Portrait-BeforeAfter-Elegant` | Elegant portrait style |

### Rules
1. **PascalCase** - Capitalize each word, no spaces
2. **Hyphens only** - Use hyphens between sections
3. **Unique names** - Each template name must be unique in the database
4. **5-50 characters** - Name length must be between 5 and 50 characters

---

## Layer Naming Convention

### Slot Layers (User Photo Placeholders)

These are image layers where users will add their before/after photos.

**Rule**: Layer name must contain `slot`

| Layer Name | Description |
|------------|-------------|
| `slot-before` | Before photo placeholder |
| `slot-after` | After photo placeholder |
| `slot-hero` | Single hero image |
| `slot-1`, `slot-2` | Numbered slots |

### Watermark Layer (Branding)

A text or image layer that shows "Made with Resulta" for free users.

**Rule**: Layer name must contain `watermark`

| Layer Name | Description |
|------------|-------------|
| `watermark` | Main watermark layer |
| `watermark-text` | Text-based watermark |
| `watermark-logo` | Logo-based watermark |

**Important**: 
- Position the watermark in a corner (designer's choice)
- Keep it small and subtle
- Premium users will have this hidden automatically

### All Other Layers

Everything else becomes part of the template design (labels, arrows, backgrounds).

| Layer Name | Description |
|------------|-------------|
| `background` | Main background color/image |
| `before-label` | "Before" text label |
| `after-label` | "After" text label |
| `arrow-left` | Decorative arrow |
| `frame-border` | Border decoration |
| `brand-logo` | Static branding (not watermark) |

---

## Creating a Template in Templated.io

### Step 1: Create New Template

1. Go to https://app.templated.io
2. Click **Create Template**
3. Set canvas size:
   - Square: `1080 x 1080`
   - Story: `1080 x 1920`
   - Portrait: `1080 x 1350`

### Step 2: Add Background Elements

1. Add your background color, shapes, or images
2. Name them descriptively (e.g., `background`, `frame-shape`)

### Step 3: Add Slot Layers

1. Add **Image** layers where user photos will go
2. **Rename each to include `slot`**:
   - Select the layer
   - Click on layer name
   - Rename to `slot-before`, `slot-after`, etc.
3. Add placeholder images that look like buttons:
   - Use a "+" icon
   - Add text like "Tap to add Before photo"
   - These will show in the app until user adds their photo

### Step 4: Add Labels and Decorations

1. Add text layers for "Before" and "After" labels
2. Add arrows, dividers, or other decorations
3. Position them ON TOP of the slot layers
4. Templated.io handles layer ordering automatically

### Step 5: Add Watermark Layer

1. Add a text layer in a corner (bottom-right recommended)
2. Set text to: `Made with Resulta`
3. **Rename layer to `watermark`**
4. Style it subtly:
   - Small font size (12-16px)
   - Semi-transparent (50-70% opacity)
   - Neutral color that works on most backgrounds

### Step 6: Verify Layer Order

In Templated.io, check the layer panel:
- Background layers at the bottom
- Slot layers in the middle  
- Labels and decorations above slots
- Watermark at the top (always visible)

### Step 7: Save Template

1. Click **Save**
2. Note the **Template ID** from the URL:
   ```
   app.templated.io/editor/[TEMPLATE_ID]
                           ▲
                           └── Copy this
   ```

---

## Syncing Template to App

### Admin Panel (Recommended)

Use the Resulta Admin Panel for easy template syncing:
```
https://resulta.app/admin
```

### Webhook URL (Alternative)

```
https://jackhunterking.app.n8n.cloud/webhook/sync-template
```

### Request Format

```json
{
  "templated_id": "clx1234567890",
  "name": "My Template Name",
  "canvas_width": 1080,
  "canvas_height": 1080,
  "preview_url": "https://api.templated.io/v1/templates/clx1234567890/preview",
  "is_active": true,
  "supports": ["single"]
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `templated_id` | Yes | Template ID from Templated.io URL |
| `name` | Yes | Display name in the app |
| `canvas_width` | Yes | Width in pixels (e.g., 1080) |
| `canvas_height` | Yes | Height in pixels (e.g., 1080) |
| `preview_url` | No | Thumbnail for template gallery |
| `is_active` | No | Show in app (default: true) |
| `supports` | No | Content types (default: ["single"]) |

### Example Sync Command

```bash
curl -X POST "https://jackhunterking.app.n8n.cloud/webhook/sync-template" \
  -H "Content-Type: application/json" \
  -d '{
    "templated_id": "clx1234567890",
    "name": "Square Before/After",
    "canvas_width": 1080,
    "canvas_height": 1080,
    "preview_url": "https://api.templated.io/v1/templates/clx1234567890/preview",
    "is_active": true,
    "supports": ["single"]
  }'
```

### What Happens After Sync

1. N8n receives the webhook
2. Fetches layer information from Templated.io
3. Validates slot layers exist
4. Saves template to Supabase with `layers_json`
5. Template appears in app (may need pull-to-refresh)

---

## Watermark Setup

### How Watermark Works

1. **Free users**: Watermark is visible on all rendered images
2. **Premium users**: Watermark layer is hidden via Templated.io API

### Setting Up Watermark in Template

1. Create a text layer with content: `Made with Resulta`
2. **Name the layer `watermark`** (this is important!)
3. Position in a corner:
   - Bottom-right (recommended)
   - Bottom-left
   - Top-right or top-left (less common)
4. Style guidelines:
   - Font size: 12-18px
   - Opacity: 50-80%
   - Color: White with shadow, or dark with light stroke
   - Avoid covering important parts of the image

### Example Watermark Styles

**Style 1: Simple Text**
```
Font: Inter or SF Pro
Size: 14px
Color: White
Opacity: 60%
Position: 20px from bottom-right corner
```

**Style 2: With Background**
```
Text: Made with Resulta
Background: Black pill shape, 40% opacity
Position: Bottom-right corner with 15px padding
```

### Technical Details

When rendering, the app sends:
```json
{
  "template": "template_id",
  "layers": {
    "slot-before": { "image_url": "user_photo_1.jpg" },
    "slot-after": { "image_url": "user_photo_2.jpg" },
    "watermark": { "hide": true }  // Only for premium users
  }
}
```

---

## Troubleshooting

### Template not appearing in app

| Check | Solution |
|-------|----------|
| `is_active` is false | Set to `true` in webhook request |
| Not in Supabase | Check N8n execution logs |
| App not refreshed | Pull down to refresh template list |

### Slots not detected

| Check | Solution |
|-------|----------|
| Layer names | Must contain `slot` (e.g., `slot-before`) |
| Layer type | Must be `image` type in Templated.io |

### Watermark not hiding for premium

| Check | Solution |
|-------|----------|
| Layer name | Must contain `watermark` |
| Premium status | Verify user subscription is active |

### Preview looks different than template

| Check | Solution |
|-------|----------|
| Layer order | Check layer stacking in Templated.io |
| Slot placeholders | Use placeholder images that match intended design |

### N8n webhook error

| Error | Solution |
|-------|----------|
| 404 Not Found | Check webhook URL is correct |
| No response | Verify workflow is Active |
| Missing fields | Include all required fields |

---

## Checklist: Adding a New Template

- [ ] Create template in Templated.io
- [ ] Name slot layers with `slot` in the name
- [ ] Add placeholder images to slots (button-style design)
- [ ] Add labels, decorations, background
- [ ] Add watermark layer named `watermark`
- [ ] Position watermark in corner
- [ ] Save template and copy ID
- [ ] Send webhook to sync
- [ ] Verify in Supabase
- [ ] Test in app:
  - [ ] Template appears in gallery
  - [ ] Slots are tappable
  - [ ] Photos replace placeholders correctly
  - [ ] Labels appear on top of photos
  - [ ] Watermark visible (free user)
  - [ ] Download works
  - [ ] Share works

---

## Quick Reference

### Layer Naming

| Type | Rule | Examples |
|------|------|----------|
| Slot | Contains `slot` | `slot-before`, `slot-after`, `slot-1` |
| Watermark | Contains `watermark` | `watermark`, `watermark-text` |
| Other | Any name | `background`, `before-label`, `arrow` |

### Webhook Fields

```json
{
  "templated_id": "required - from URL",
  "name": "required - display name",
  "canvas_width": "required - 1080",
  "canvas_height": "required - 1080 or 1920",
  "preview_url": "optional - thumbnail",
  "is_active": "optional - default true",
  "supports": "optional - default [\"single\"]"
}
```

---

## Support

- **Resulta Admin Panel**: https://resulta.app/admin
- **Templated.io Docs**: https://docs.templated.io
- **Supabase Dashboard**: https://supabase.com/dashboard/project/tmgjsrxdjbazrwvbdoed
- **N8n Workflow**: Check your N8n instance for "Admin Template Sync"
