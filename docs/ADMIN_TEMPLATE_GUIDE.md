# Admin Template Guide

A complete guide for creating, naming, and syncing templates from Templated.io to the Beauty Content Creator app.

---

## Table of Contents

1. [Overview](#overview)
2. [Layer Naming Convention](#layer-naming-convention)
3. [Creating a Template in Templated.io](#creating-a-template-in-templatedappio)
4. [Generating Preview URLs](#generating-preview-urls)
5. [Syncing Template to App](#syncing-template-to-app)
6. [Quick Sync Script](#quick-sync-script)
7. [Troubleshooting](#troubleshooting)

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
2. **Generate** frame and overlay preview images
3. **Sync** via webhook to save to Supabase
4. **Users** see the template in the app

### Three Layer Types

| Type | Purpose | Naming | Example |
|------|---------|--------|---------|
| **Slot** | Where user photos go | Contains `slot` | `slot-before`, `slot-after` |
| **Overlay** | Elements ON TOP of photos | Contains `overlay` | `overlay-label`, `overlay-arrow` |
| **Background** | Everything else | Any other name | `background`, `frame`, `divider` |

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

### Overlay Layers (ON TOP of Photos)

These elements appear over the user's photos (labels, arrows, badges).

**Rule**: Layer name must contain `overlay`

| Layer Name | Description |
|------------|-------------|
| `overlay-before-text` | "Before" label text |
| `overlay-after-text` | "After" label text |
| `overlay-arrow-left` | Left-pointing arrow |
| `overlay-arrow-right` | Right-pointing arrow |
| `overlay-badge` | Decorative badge/stamp |
| `overlay-divider` | Line between photos |

### Background Layers (Behind Photos)

Everything else becomes part of the background frame.

**Rule**: Any name without `slot` or `overlay`

| Layer Name | Description |
|------------|-------------|
| `background` | Main background color/image |
| `frame-border` | Border decoration |
| `shape-corner` | Corner decorations |
| `brand-logo` | Static logo |

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
3. These will appear BEHIND user photos

### Step 3: Add Slot Layers

1. Add **Image** layers where user photos will go
2. **Rename each to include `slot`**:
   - Select the layer
   - Click on layer name
   - Rename to `slot-before`, `slot-after`, etc.
3. Add placeholder images (optional)

### Step 4: Add Overlay Layers

1. Add text, shapes, or icons that should appear ON TOP of photos
2. **Rename each to include `overlay`**:
   - `overlay-before-text` for "Before" label
   - `overlay-after-text` for "After" label
   - `overlay-arrow` for arrow icons

### Step 5: Verify Layer Order

In Templated.io, layers are stacked. Verify:
- Background layers at the bottom
- Slot layers in the middle
- Overlay layers at the top

### Step 6: Save Template

1. Click **Save**
2. Note the **Template ID** from the URL:
   ```
   app.templated.io/editor/[TEMPLATE_ID]
                           ▲
                           └── Copy this
   ```

---

## Generating Preview URLs

You need to generate 2 preview images using the Templated.io API.

### Get Your API Key

1. Go to https://app.templated.io/settings/api
2. Copy your API key

### Generate Frame Preview

This shows the background only (no slots, no overlays).

**Hide**: All `slot-*` layers AND all `overlay-*` layers

```bash
curl -X POST "https://api.templated.io/v1/render" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "YOUR_TEMPLATE_ID",
    "format": "png",
    "layers": {
      "slot-before": { "hide": true },
      "slot-after": { "hide": true },
      "overlay-before-text": { "hide": true },
      "overlay-after-text": { "hide": true },
      "overlay-arrow-left": { "hide": true },
      "overlay-arrow-right": { "hide": true }
    }
  }'
```

**Response:**
```json
{
  "render_url": "https://api.templated.io/renders/abc123.png"
}
```
Save this as `frame_preview_url`

### Generate Overlay Preview

This shows only the overlay elements (transparent background).

**Hide**: All `slot-*` layers AND all background layers

```bash
curl -X POST "https://api.templated.io/v1/render" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "YOUR_TEMPLATE_ID",
    "format": "png",
    "layers": {
      "slot-before": { "hide": true },
      "slot-after": { "hide": true },
      "background": { "hide": true },
      "frame-shape": { "hide": true }
    }
  }'
```

Save the response URL as `overlay_preview_url`

---

## Syncing Template to App

### Webhook URL

```
https://your-n8n-instance.com/webhook/sync-template
```

### Request Format

```json
{
  "templated_id": "clx1234567890",
  "name": "My Template Name",
  "canvas_width": 1080,
  "canvas_height": 1080,
  "preview_url": "https://api.templated.io/v1/templates/clx1234567890/preview",
  "frame_preview_url": "https://api.templated.io/renders/frame123.png",
  "overlay_preview_url": "https://api.templated.io/renders/overlay456.png",
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
| `frame_preview_url` | No | Background-only render URL |
| `overlay_preview_url` | No | Overlay-only render URL |
| `is_active` | No | Show in app (default: true) |
| `supports` | No | Content types (default: ["single"]) |

### Example Sync Command

```bash
curl -X POST "https://your-n8n.com/webhook/sync-template" \
  -H "Content-Type: application/json" \
  -d '{
    "templated_id": "clx1234567890",
    "name": "Square Before/After",
    "canvas_width": 1080,
    "canvas_height": 1080,
    "preview_url": "https://api.templated.io/v1/templates/clx1234567890/preview",
    "frame_preview_url": "https://api.templated.io/renders/abc.png",
    "overlay_preview_url": "https://api.templated.io/renders/xyz.png",
    "is_active": true,
    "supports": ["single"]
  }'
```

---

## Quick Sync Script

Save this script to quickly sync templates.

### sync-template.sh

```bash
#!/bin/bash

# Configuration
TEMPLATED_API_KEY="your-templated-api-key"
N8N_WEBHOOK_URL="https://your-n8n.com/webhook/sync-template"

# Template details (edit these)
TEMPLATE_ID="clx1234567890"
TEMPLATE_NAME="My Template"
CANVAS_WIDTH=1080
CANVAS_HEIGHT=1080

# Layer names to hide (edit based on your template)
SLOT_LAYERS='"slot-before": {"hide": true}, "slot-after": {"hide": true}'
OVERLAY_LAYERS='"overlay-before-text": {"hide": true}, "overlay-after-text": {"hide": true}'
BACKGROUND_LAYERS='"background": {"hide": true}'

echo "🎨 Generating Frame Preview..."
FRAME_RESPONSE=$(curl -s -X POST "https://api.templated.io/v1/render" \
  -H "Authorization: Bearer $TEMPLATED_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"template\": \"$TEMPLATE_ID\",
    \"format\": \"png\",
    \"layers\": { $SLOT_LAYERS, $OVERLAY_LAYERS }
  }")
FRAME_URL=$(echo $FRAME_RESPONSE | grep -o '"render_url":"[^"]*"' | cut -d'"' -f4)
echo "✅ Frame URL: $FRAME_URL"

echo "🎨 Generating Overlay Preview..."
OVERLAY_RESPONSE=$(curl -s -X POST "https://api.templated.io/v1/render" \
  -H "Authorization: Bearer $TEMPLATED_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"template\": \"$TEMPLATE_ID\",
    \"format\": \"png\",
    \"layers\": { $SLOT_LAYERS, $BACKGROUND_LAYERS }
  }")
OVERLAY_URL=$(echo $OVERLAY_RESPONSE | grep -o '"render_url":"[^"]*"' | cut -d'"' -f4)
echo "✅ Overlay URL: $OVERLAY_URL"

echo "📤 Syncing to App..."
curl -X POST "$N8N_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"templated_id\": \"$TEMPLATE_ID\",
    \"name\": \"$TEMPLATE_NAME\",
    \"canvas_width\": $CANVAS_WIDTH,
    \"canvas_height\": $CANVAS_HEIGHT,
    \"preview_url\": \"https://api.templated.io/v1/templates/$TEMPLATE_ID/preview\",
    \"frame_preview_url\": \"$FRAME_URL\",
    \"overlay_preview_url\": \"$OVERLAY_URL\",
    \"is_active\": true,
    \"supports\": [\"single\"]
  }"

echo ""
echo "✅ Template synced!"
```

### Usage

```bash
chmod +x sync-template.sh
./sync-template.sh
```

---

## Troubleshooting

### Template not appearing in app

| Check | Solution |
|-------|----------|
| `is_active` is false | Set to `true` in webhook request |
| Not in Supabase | Check N8n execution logs |
| App not refreshed | Pull down to refresh template list |

### Overlay not showing in editor

| Check | Solution |
|-------|----------|
| `overlay_preview_url` is null | Generate and include in webhook |
| No overlay layers | Rename layers to include `overlay` |
| Wrong layers hidden | Verify you're hiding background, not overlay |

### Slots not detected

| Check | Solution |
|-------|----------|
| Layer names | Must contain `slot` (e.g., `slot-before`) |
| Layer type | Must be `image` type in Templated.io |

### N8n webhook error

| Error | Solution |
|-------|----------|
| 404 Not Found | Check webhook URL is correct |
| No response | Verify workflow is Active |
| Missing fields | Include all required fields |

---

## Checklist: Adding a New Template

- [ ] Create template in Templated.io
- [ ] Name slot layers with `slot-` prefix
- [ ] Name overlay layers with `overlay-` prefix
- [ ] Generate frame preview URL (hide slots + overlays)
- [ ] Generate overlay preview URL (hide slots + background)
- [ ] Send webhook with all URLs
- [ ] Verify in Supabase
- [ ] Test in app

---

## Support

- **Templated.io Docs**: https://docs.templated.io
- **Supabase Dashboard**: https://supabase.com/dashboard/project/tmgjsrxdjbazrwvbdoed
- **N8n Workflow**: Check your N8n instance for "Admin Template Sync"

