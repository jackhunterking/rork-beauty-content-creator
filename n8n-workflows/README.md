# n8n Workflows for Beauty Content Creator

## Sync Template Workflow (Lean Architecture)

This workflow syncs templates from Templated.io to Supabase with a **single API call**. You provide the metadata, and the workflow fetches only the layer positions.

### Architecture

```
Webhook → Validate → Templated (List Layers) → Transform → Supabase → Respond
                ↓                                    ↓
         [Validation Error]                   [Layer Error]
```

### Why This is Better

| Approach | API Calls | Complexity |
|----------|-----------|------------|
| Previous (2 calls) | Get Template + List Layers | More nodes, slower |
| **Lean (1 call)** | List Layers only | Simpler, faster |

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
2. Click on **"Templated: List Layers"** node
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
  "message": "Template synced successfully"
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
  "message": "Template must have layers: image-before, image-after (type: image)",
  "found_layers": ["background", "text-1"],
  "missing_layers": ["image-before", "image-after"]
}
```

---

## Templated.io Template Requirements

Your templates **MUST** have these layers:

| Layer Name | Type | Purpose |
|------------|------|---------|
| `image-before` | image | Where the "before" photo goes |
| `image-after` | image | Where the "after" photo goes |

### How to Name Layers in Templated.io

1. Open your template in Templated.io editor
2. Select the image placeholder for "before"
3. In the layer panel, rename it to `image-before`
4. Repeat for the "after" placeholder → name it `image-after`

Other layers (text, shapes, backgrounds) can have any names.

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

### "Template must have 'image-before' and 'image-after' layers"
- Check your Templated.io template has layers named exactly `image-before` and `image-after`
- Both must be of type `image` (not shape or text)

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
