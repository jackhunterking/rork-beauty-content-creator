# n8n Workflows for Beauty Content Creator

## Sync Template Workflow (Simplified)

This workflow syncs templates from Templated.io to Supabase. All rendering is handled at runtime by the app.

### Architecture

```
Webhook → Validate → Templated (List Layers) → Transform → If Valid
                ↓                                            ↓
         [Validation Error]                           [Layer Error]
                                                          ↓
                                                  Supabase Upsert
                                                          ↓
                                                   Respond Success
```

**Key Simplification**: No render steps in the workflow. The app calls Templated.io API at runtime for:
- Preview rendering (after user adds photos)
- Final rendering (for download/share)
- Watermark control (hidden for premium users)

---

## Layer Naming Convention

The workflow identifies layer types by naming convention:

### Slot Layers (User Photos)
Layers where users add their photos. Name must contain `slot`.

| Layer Name | Purpose |
|------------|---------|
| `slot-before` | Where the "before" photo goes |
| `slot-after` | Where the "after" photo goes |
| `slot-hero` | Single hero image slot |
| `slot-1`, `slot-2` | Numbered slots |

### Watermark Layer
Layer showing "Made with BeautyApp" for free users. Name must contain `watermark`.

| Layer Name | Purpose |
|------------|---------|
| `watermark` | Branding text/logo |
| `watermark-text` | Text-based watermark |

Premium users have the watermark hidden automatically.

### All Other Layers
Everything else (labels, arrows, backgrounds) renders as part of the template.

| Layer Name | Purpose |
|------------|---------|
| `background` | Main background |
| `before-label` | "Before" text |
| `after-label` | "After" text |
| `arrow-left` | Decorative arrow |

---

## How Rendering Works

### In the App

1. **Empty State**: Shows `templatedPreviewUrl` (template with placeholder buttons)
2. **After Photo Added**: Calls Templated.io API to render preview
3. **Download/Share**: Calls Templated.io API to render final image

### Watermark Logic

```typescript
// When rendering
const layers = {
  "slot-before": { image_url: "user_photo_1.jpg" },
  "slot-after": { image_url: "user_photo_2.jpg" },
  "watermark": { hide: isPremiumUser }  // Hidden for premium
};
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
2. Click on the **Templated: List Layers** node
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
  "slot_count": 2,
  "has_watermark": true,
  "message": "Template synced successfully. Rendering handled at runtime."
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

### Step 2: Add Watermark Layer

1. Add a text layer in a corner (bottom-right recommended)
2. Set text to: `Made with BeautyApp`
3. Rename layer to `watermark`
4. Style it subtly (small, semi-transparent)

### Step 3: Other Layers

Add labels, arrows, decorations with any names. These will render automatically with correct layer ordering.

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

### Watermark not hiding for premium users
- Ensure watermark layer name contains `watermark`
- Check user's premium status in app

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
| `README.md` | This documentation |
