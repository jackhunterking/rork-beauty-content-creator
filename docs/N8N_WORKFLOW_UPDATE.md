# N8N Workflow Update: Auto-Generate Preview URLs

## Overview

The "Admin Template Sync" workflow needs to be updated to automatically generate TWO preview URLs during template sync:

1. **Clean Preview** (`templated_preview_url`) - Watermark layer hidden, for Pro users
2. **Watermarked Preview** (`watermarked_preview_url`) - Watermark visible, for Free users

Since the watermark layer is already named properly in Templated.io (`watermark`, `watermark-text`, etc.), the workflow can automatically hide/show it.

## Current Workflow

```
Webhook → If (validate) → Get Template Info → List Layers → Aggregate → Build Record → Create Row → Respond
```

## Required Changes

### Step 1: Add Two Render Nodes

After "Get Template Info" node, add TWO "Templated" render nodes in parallel:

#### Node: "Render Clean Preview"
- Operation: `render`
- Template ID: `={{ $('Webhook').first().json.body.templated_id }}`
- Format: `jpeg`
- Layers: 
```json
{
  "watermark": { "hide": true }
}
```

#### Node: "Render Watermarked Preview"
- Operation: `render`
- Template ID: `={{ $('Webhook').first().json.body.templated_id }}`
- Format: `jpeg`
- Layers: `{}` (empty - watermark shows by default)

### Step 2: Merge the Render Results

Add a "Merge" node to combine the outputs:
- Mode: Combine
- Combine By: Position

### Step 3: Update "Build Template Record" Node

Add these fields to the assignments:

```javascript
// Clean preview (watermark hidden) - for Pro users and Create tab
templated_preview_url: "={{ $('Render Clean Preview').first().json.render_url }}"

// Watermarked preview - for Free users in Editor
watermarked_preview_url: "={{ $('Render Watermarked Preview').first().json.render_url }}"

// Thumbnail for catalog (use clean preview)
thumbnail: "={{ $('Render Clean Preview').first().json.render_url }}"
```

### Step 4: Update "Create a row" Node

Add new field mapping:
```javascript
watermarked_preview_url: "={{ $json.watermarked_preview_url }}"
```

## Updated Workflow Diagram

```
                                    ┌─── Render Clean Preview ───┐
Webhook → If → Get Template Info ──┤                             ├── Merge → Build Record → Create Row → Respond
                 │                  └─ Render Watermarked Preview┘
                 │
                 └── List Layers → Aggregate ─────────────────────────────┘
```

## Templated.io API Reference

### Render with Watermark Hidden
```bash
curl -X POST https://api.templated.io/v1/render \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "YOUR_TEMPLATE_ID",
    "format": "jpeg",
    "layers": {
      "watermark": { "hide": true }
    }
  }'
```

### Render with Watermark Visible (default)
```bash
curl -X POST https://api.templated.io/v1/render \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "YOUR_TEMPLATE_ID",
    "format": "jpeg",
    "layers": {}
  }'
```

## Testing

After updating the workflow:

1. Sync a new template from the admin panel
2. Check Supabase `templates` table for:
   - `templated_preview_url` should be a clean render URL
   - `watermarked_preview_url` should be a watermarked render URL
3. Verify in the app:
   - Create tab shows clean preview
   - Editor shows watermarked preview for free users
   - Editor shows clean preview for pro users
