# n8n Workflows for Beauty Content Creator

## Sync Template Workflow (Lean Architecture)

This workflow syncs templates from Templated.io to Supabase. It automatically generates:
- **Frame Preview**: Background elements only (slots hidden)
- **Overlay Preview**: Labels, arrows, decorations that appear ON TOP of user photos

### Architecture

```
Webhook → Validate → Templated (List Layers) → Transform → If Valid
                ↓                                            ↓
         [Validation Error]                           [Layer Error]
                                                           ↓
                                              ┌────────────┴────────────┐
                                              ↓                         ↓
                                    Render Frame Preview    Render Overlay Preview
                                              ↓                         ↓
                                              └────────────┬────────────┘
                                                           ↓
                                                    Merge Previews
                                                           ↓
                                                   Supabase Upsert
                                                           ↓
                                                    Respond Success
```

---

## Layer Naming Convention

The workflow uses **naming conventions** to identify different layer types:

### Slot Layers (User Photos)
Layers where users add their photos. Name must contain `slot`.

| Layer Name | Purpose |
|------------|---------|
| `slot-before` | Where the "before" photo goes |
| `slot-after` | Where the "after" photo goes |
| `slot-hero` | Single hero image slot |
| `slot-1`, `slot-2` | Numbered slots |

### Overlay Layers (ON TOP of Photos)
Layers that appear ON TOP of user photos. Name must contain `overlay`.

| Layer Name | Purpose |
|------------|---------|
| `overlay-before-text` | "Before" label text |
| `overlay-after-text` | "After" label text |
| `overlay-arrow-left` | Arrow icon pointing left |
| `overlay-arrow-right` | Arrow icon pointing right |
| `overlay-divider` | Decorative divider line |
| `overlay-badge` | Badge or stamp decoration |

### Background Layers
Everything else becomes part of the frame/background. These render BEHIND user photos.

| Layer Name | Purpose |
|------------|---------|
| `background` | Main background |
| `background-shape` | Decorative background shapes |
| `frame-border` | Border around the template |

---

## What Gets Generated

The workflow generates two preview images:

| Preview | Contains | Purpose |
|---------|----------|---------|
| `frame_preview_url` | Background + frame elements | Shown BEHIND user photos in editor |
| `overlay_preview_url` | Labels, arrows, decorations | Shown ON TOP of user photos in editor |

### Visual Layer Order in Editor

```
┌─────────────────────────────────────┐
│     Overlay (labels, arrows)        │  ← overlayPreviewUrl (TOP)
├─────────────────────────────────────┤
│     User Photos (Before/After)      │  ← SlotRegion components
├─────────────────────────────────────┤
│     Frame Background                │  ← framePreviewUrl (BOTTOM)
└─────────────────────────────────────┘
```

---

## Setup Instructions

### 1. Import the Workflow

1. Open your n8n instance
2. Go to **Workflows** → **Import from File**
3. Select `sync-template-lean.json`

### 2. Configure Templated.io Credentials

1. In n8n, go to **Credentials** → **Add Credential**
2. Search for **"Templated"** and select it
3. Enter your Templated.io API Key (from https://app.templated.io/settings/api)
4. Save the credential

### 3. Link Credentials to Workflow

1. Open the imported workflow
2. Click on each **Templated** node (List Layers, Render Frame, Render Overlay)
3. Select your Templated.io credential from the dropdown
4. Save the workflow

### 4. Activate the Workflow

1. Click the **Active** toggle in the top right
2. Note your webhook URL: `https://your-n8n.com/webhook/sync-template`

---

## Webhook API

### Request Schema

```json
{
  "templated_id": "string (required) - Your Templated.io template ID",
  "name": "string (required) - Display name for the app",
  "canvas_width": "number (required) - Template width in pixels",
  "canvas_height": "number (required) - Template height in pixels",
  "preview_url": "string (optional) - Templated.io preview image URL",
  "is_active": "boolean (optional, default: true)",
  "supports": "array (optional, default: ['single'])"
}
```

### Example Request

```bash
curl -X POST https://your-n8n.com/webhook/sync-template \
  -H "Content-Type: application/json" \
  -d '{
    "templated_id": "clx1234567890",
    "name": "Beauty Side-by-Side",
    "canvas_width": 1080,
    "canvas_height": 1080,
    "preview_url": "https://templated.io/api/templates/clx1234567890/preview",
    "is_active": true
  }'
```

### Response Examples

**Success (200):**
```json
{
  "success": true,
  "template_id": "uuid-from-supabase",
  "templated_id": "clx1234567890",
  "frame_preview_url": "https://...",
  "overlay_preview_url": "https://...",
  "slot_count": 2,
  "overlay_layer_count": 4,
  "message": "Template synced successfully with frame and overlay previews"
}
```

**Validation Error (400):**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "canvas_width: MISSING",
  "details": {
    "templated_id": "OK",
    "name": "OK",
    "canvas_width": "MISSING",
    "canvas_height": "OK"
  }
}
```

**Layer Error (422):**
```json
{
  "success": false,
  "error": "LAYER_ERROR",
  "message": "Template must have at least one slot layer (layer name must contain \"slot\", type: image)",
  "found_layers": ["background", "text-1"],
  "hint": "Rename your image layers to include \"slot\" (e.g., slot-before, slot-after, slot-hero)"
}
```

---

## How to Set Up Layers in Templated.io

### Step 1: Rename Slot Layers

1. Open your template in Templated.io editor
2. Select each image placeholder where users will add photos
3. Rename them to include `slot`:
   - `slot-before` for the before image
   - `slot-after` for the after image

### Step 2: Rename Overlay Layers

1. Select any text, shape, or icon that should appear ON TOP of user photos
2. Rename them to include `overlay`:
   - `overlay-before-text` for "Before" label
   - `overlay-after-text` for "After" label
   - `overlay-arrow` for arrow icons

### Step 3: Background Layers

Leave background elements with any name (without `slot` or `overlay`).

---

## Getting Template Metadata

When you design a template in Templated.io, note these values:

| Value | Where to Find It |
|-------|------------------|
| `templated_id` | In the URL: `app.templated.io/editor/TEMPLATE_ID` |
| `canvas_width` | Template settings (e.g., 1080) |
| `canvas_height` | Template settings (e.g., 1080 for square, 1920 for story) |
| `preview_url` | Template dashboard → Preview image URL |

---

## Supabase Connection Info

- **Project URL**: `https://tmgjsrxdjbazrwvbdoed.supabase.co`
- **API Endpoint**: `https://tmgjsrxdjbazrwvbdoed.supabase.co/rest/v1/templates`
- **Upsert Key**: `templated_id` (updates existing template if ID matches)

---

## Troubleshooting

### "Template must have at least one slot layer"
- Check your Templated.io template has layers with names containing `slot`
- Slot layers must be of type `image`
- Example: `slot-before`, `slot-after`, `slot-hero`

### Overlay not showing in app
- Ensure overlay layers have names containing `overlay`
- Check the `overlay_preview_url` is populated in Supabase
- Verify the template was re-synced after renaming layers

### "canvas_width must be a positive number"
- Ensure you're sending numbers, not strings: `"canvas_width": 1080` ✓
- Not: `"canvas_width": "1080"` ✗

### Workflow not responding
- Check the workflow is **Active** (toggle in top right)
- Verify the webhook URL is correct

### Template not appearing in app
- Check `is_active` is `true`
- Verify the template was created in Supabase (check the database)
- Pull to refresh in the app

---

## Files

| File | Description |
|------|-------------|
| `sync-template-lean.json` | The n8n workflow to import |
| `test-sync.sh` | Test script for the webhook |
| `README.md` | This documentation |
