# Resulta AI - N8N Workflows

Production-ready N8N workflows for AI image processing. Designed with **individual workflows per feature** to handle concurrent execution and provide granular control.

## Why Individual Workflows?

- **No Concurrent Execution Bottlenecks**: Each feature runs independently
- **Better Scalability**: Load distributed across 3 workflows instead of 1
- **Easier Debugging**: Isolated execution logs per feature
- **Granular Control**: Enable/disable features independently
- **Cost Tracking**: Per-feature monetization tracking

---

## Workflow Files

### AI Processing Workflows

| File | Feature | Webhook Path | Avg. Processing | Est. Cost |
|------|---------|--------------|-----------------|-----------|
| `Resulta_AI_Auto_Quality.json` | Image upscaling & enhancement | `/webhook/resulta/auto-quality` | 15-60s | ~$0.015 |
| `Resulta_AI_Background_Remove.json` | Background removal (PNG) | `/webhook/resulta/background-remove` | 5-30s | ~$0.005 |
| `Resulta_AI_Background_Replace.json` | Background replacement | `/webhook/resulta/background-replace` | 15-60s | ~$0.02 |

---

## Import Instructions

### Step 1: Create Fal.AI Credential

1. In N8N, go to **Settings** → **Credentials**
2. Click **Add Credential** → **HTTP Header Auth**
3. Configure:
   - **Name**: `Fal.AI API Key`
   - **Header Name**: `Authorization`
   - **Header Value**: `Key YOUR_FAL_AI_KEY_HERE`
4. Save the credential

> Get your Fal.AI API key at: https://fal.ai/dashboard/keys

### Step 2: Import Each Workflow

1. Go to **Workflows** → **Import from File**
2. Select `Resulta_AI_Auto_Quality.json`
3. After import, click on each **HTTP Request** node:
   - Select your `Fal.AI API Key` credential
4. **Activate** the workflow (toggle ON)
5. Note the **Production Webhook URL**
6. Repeat for the other 2 workflows

### Step 3: Configure Supabase

Update your `ai_model_config` table with the N8N webhook URLs:

```sql
-- Run in Supabase SQL Editor
UPDATE ai_model_config 
SET endpoint_url = 'https://YOUR-N8N.app.n8n.cloud/webhook/resulta/auto-quality'
WHERE feature_key = 'auto_quality';

UPDATE ai_model_config 
SET endpoint_url = 'https://YOUR-N8N.app.n8n.cloud/webhook/resulta/background-remove'
WHERE feature_key = 'background_remove';

UPDATE ai_model_config 
SET endpoint_url = 'https://YOUR-N8N.app.n8n.cloud/webhook/resulta/background-replace'
WHERE feature_key = 'background_replace';
```

---

## Request Format

Each workflow expects this payload from the Edge Function:

```json
{
  "generation_id": "uuid-from-ai_generations-table",
  "image_url": "https://example.com/image.jpg",
  "user_id": "user-uuid",
  "params": {
    // Feature-specific parameters (see below)
  }
}
```

### Auto-Quality Parameters

```json
{
  "scale": 2,                    // 1-4, upscale factor
  "creativity": 0,               // 0-1, how creative the enhancement is
  "detail": 5,                   // 1-10, detail level
  "shape_preservation": 3,       // 0-5, how much to preserve shapes
  "guidance_scale": 7.5,         // AI guidance
  "num_inference_steps": 20      // Quality vs speed
}
```

### Background Remove Parameters

```json
{
  "model": "General",            // General, Portrait, or Product
  "operating_resolution": "1024x1024",
  "output_format": "png"
}
```

### Background Replace Parameters

```json
{
  "prompt": "professional studio background, clean, neutral",
  "negative_prompt": "distracting elements, patterns, text",
  "output_format": "png"
}
```

---

## Response Format

### Success Response (HTTP 200)

```json
{
  "success": true,
  "generation_id": "uuid",
  "output_url": "https://fal.media/files/...",
  "processing_time_ms": 15000,
  "estimated_cost_usd": 0.015,
  "feature": "auto_quality",
  "model_id": "fal-ai/creative-upscaler",
  "user_id": "user-uuid",
  "timestamp": "2026-01-19T12:00:00.000Z"
}
```

### Error Response (HTTP 500)

```json
{
  "success": false,
  "generation_id": "uuid",
  "error": "Error message",
  "error_code": "PROCESSING_ERROR|FAL_AI_FAILED|TIMEOUT",
  "processing_time_ms": 5000,
  "feature": "auto_quality",
  "model_id": "fal-ai/creative-upscaler",
  "user_id": "user-uuid",
  "timestamp": "2026-01-19T12:00:00.000Z"
}
```

---

## Workflow Architecture

Each workflow follows this pattern:

```
┌─────────────┐    ┌────────────────┐    ┌───────────────────┐
│   Webhook   │───▶│ Set Parameters │───▶│ Submit to Fal.AI  │
└─────────────┘    └────────────────┘    └─────────┬─────────┘
                                                   │
                   ┌───────────────────────────────┼───────────────────────────────┐
                   │                               ▼                               │
                   │                    ┌─────────────────────┐                    │
                   │                    │ Queued Successfully? │                   │
                   │                    └──────────┬──────────┘                    │
                   │                               │                               │
                   │              ┌────────────────┴────────────────┐              │
                   │              ▼                                 ▼              │
                   │    ┌──────────────────┐              ┌─────────────────┐      │
                   │    │ Store Request ID │              │ Format Error    │──────┤
                   │    └────────┬─────────┘              └─────────────────┘      │
                   │             │                                                 │
                   │             ▼                                                 │
                   │    ┌─────────────────┐                                        │
                   │    │    Wait 2-3s    │◀───────────────┐                       │
                   │    └────────┬────────┘                │                       │
                   │             │                         │                       │
                   │             ▼                         │                       │
                   │    ┌─────────────────┐                │                       │
                   │    │  Poll Status    │                │                       │
                   │    └────────┬────────┘                │                       │
                   │             │                         │                       │
                   │    ┌────────┴────────┐                │                       │
                   │    ▼                 ▼                │                       │
                   │ COMPLETED         PENDING/IN_QUEUE    │                       │
                   │    │                 │                │                       │
                   │    ▼                 ▼                │                       │
                   │ ┌──────────┐   ┌────────────┐         │                       │
                   │ │ Format   │   │ Can Retry? │─────────┤                       │
                   │ │ Success  │   └─────┬──────┘    (retry < max)                │
                   │ └────┬─────┘         │                                        │
                   │      │               ▼                                        │
                   │      │         (max retries)                                  │
                   │      │               │                                        │
                   │      │               ▼                                        │
                   │      │        ┌────────────┐                                  │
                   │      │        │  Timeout   │──────────────────────────────────┤
                   │      │        └────────────┘                                  │
                   │      ▼                                                        │
                   │ ┌────────────────┐                          ┌──────────────┐  │
                   │ │ Respond (200)  │                          │ Respond (500)│◀─┘
                   │ └────────────────┘                          └──────────────┘
                   └───────────────────────────────────────────────────────────────┘
```

---

## Monetization Tracking

Each response includes tracking data for monetization:

| Field | Description |
|-------|-------------|
| `generation_id` | Links to `ai_generations` table |
| `user_id` | User who made the request |
| `estimated_cost_usd` | Approximate Fal.AI cost |
| `processing_time_ms` | Total processing time |
| `feature` | Feature key for analytics |
| `timestamp` | ISO timestamp |

The Edge Function uses this data to:
1. Update `ai_generations` table with results
2. Track costs in your analytics
3. Manage credit deduction/refunds

---

## Troubleshooting

### "Credential not found"
- Re-select the Fal.AI API Key credential in all HTTP Request nodes

### "Timeout" errors
- Processing may take up to 2 minutes for complex images
- Max retries: 30-40 attempts (60-120 seconds total)

### "FAL_AI_FAILED" errors
- Check your Fal.AI account has credits
- Image may be too large (resize before sending)
- Prompt may be inappropriate

### Workflow not triggering
- Ensure workflow is **Active** (green toggle)
- Check webhook URL is correct
- Look at N8N execution history

---

## Production Checklist

- [ ] All 3 AI workflows imported
- [ ] Fal.AI API Key credential configured in each workflow
- [ ] All 3 AI workflows activated
- [ ] Webhook URLs copied
- [ ] `ai_model_config` table updated with webhook URLs
- [ ] Test each AI feature end-to-end

---

## Cost Summary

| Feature | Fal.AI Cost | Credits Charged |
|---------|-------------|-----------------|
| Auto-Quality | ~$0.015/image | 2 |
| Background Remove | ~$0.005/image | 1 |
| Background Replace | ~$0.02/image | 2 |

**Monthly estimate**: 1000 AI generations ≈ $15-20 Fal.AI costs
