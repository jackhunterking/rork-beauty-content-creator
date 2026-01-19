# N8N AI Workflows Setup Guide

This document describes how to set up the N8N Cloud workflows for AI image enhancement features.

## Overview

The AI enhancement system uses N8N Cloud as an orchestration layer between the Supabase Edge Functions and Fal.AI. This architecture allows:
- Easy model swapping without code changes
- Centralized API key management
- Request queuing and rate limiting
- Error handling and retries

## Prerequisites

1. **N8N Cloud Account**: Sign up at [n8n.cloud](https://n8n.cloud)
2. **Fal.AI API Key**: Get from [fal.ai/dashboard](https://fal.ai/dashboard)

## Architecture

```
Supabase Edge Function → N8N Webhook → Feature Workflow → Fal.AI → Response
```

## Workflow 1: AI Orchestrator (Main Entry Point)

### Setup

1. Create a new workflow named `AI-Orchestrator`
2. Add a **Webhook** node as trigger:
   - HTTP Method: POST
   - Path: `ai-enhance` (will generate URL like `https://yourinstance.n8n.cloud/webhook/ai-enhance`)
   - Authentication: Header Auth (optional, for security)

### Input Schema

```json
{
  "generation_id": "uuid",
  "feature": "auto_quality | background_remove | background_replace",
  "model_id": "fal-ai/creative-upscaler",
  "image_url": "https://...",
  "params": {
    "scale": 2,
    "creativity": 0,
    "prompt": "...",
    "negative_prompt": "..."
  }
}
```

### Flow

1. **Webhook** → Receives request
2. **Switch** → Routes based on `feature` field:
   - `auto_quality` → Auto-Quality Sub-workflow
   - `background_remove` → Background Remove Sub-workflow
   - `background_replace` → Background Replace Sub-workflow
3. **Respond to Webhook** → Returns result

### Response Schema

```json
{
  "success": true,
  "output_url": "https://fal.ai/...",
  "processing_time_ms": 5230,
  "estimated_cost_usd": 0.002
}
```

---

## Workflow 2: Auto-Quality (Creative Upscaler)

### Fal.AI Endpoint
`fal-ai/creative-upscaler`

### Setup

1. Create workflow named `AI-AutoQuality`
2. This can be called as a sub-workflow from Orchestrator

### Nodes

1. **Start** (triggered by Orchestrator)
2. **HTTP Request** - Call Fal.AI:
   - Method: POST
   - URL: `https://queue.fal.run/fal-ai/creative-upscaler`
   - Headers:
     - `Authorization`: `Key YOUR_FAL_API_KEY`
     - `Content-Type`: `application/json`
   - Body:
```json
{
  "image_url": "{{ $json.image_url }}",
  "scale": {{ $json.params.scale || 2 }},
  "creativity": {{ $json.params.creativity || 0 }},
  "detail": {{ $json.params.detail || 5 }},
  "shape_preservation": {{ $json.params.shape_preservation || 3 }},
  "prompt_suffix": "{{ $json.params.prompt_suffix || 'high quality, highly detailed, high resolution, sharp' }}",
  "negative_prompt": "{{ $json.params.negative_prompt || 'blurry, low resolution, bad, ugly, low quality, pixelated' }}",
  "guidance_scale": {{ $json.params.guidance_scale || 7.5 }},
  "num_inference_steps": {{ $json.params.num_inference_steps || 20 }},
  "enable_safety_checker": true
}
```

3. **Wait** - Poll for completion (Fal uses queue system):
   - Check status every 2 seconds
   - Timeout after 120 seconds

4. **IF** - Check success:
   - If `status === 'COMPLETED'` → Extract output URL
   - Else → Return error

5. **Return** - Format response

### Output

```json
{
  "success": true,
  "output_url": "{{ $json.images[0].url }}",
  "processing_time_ms": "calculated",
  "estimated_cost_usd": 0.002
}
```

---

## Workflow 3: Background Remove (BiRefNet v2)

### Fal.AI Endpoint
`fal-ai/birefnet/v2`

### Setup

1. Create workflow named `AI-BackgroundRemove`

### Nodes

1. **Start**
2. **HTTP Request** - Call Fal.AI:
   - Method: POST
   - URL: `https://queue.fal.run/fal-ai/birefnet/v2`
   - Headers:
     - `Authorization`: `Key YOUR_FAL_API_KEY`
   - Body:
```json
{
  "image_url": "{{ $json.image_url }}",
  "model": "{{ $json.params.model || 'General' }}",
  "operating_resolution": "{{ $json.params.operating_resolution || '1024x1024' }}",
  "output_format": "png"
}
```

3. **Wait** - Poll for completion
4. **Return** - Format response

### Output

```json
{
  "success": true,
  "output_url": "{{ $json.image.url }}",
  "processing_time_ms": "calculated",
  "estimated_cost_usd": 0.001
}
```

---

## Workflow 4: Background Replace

### Fal.AI Endpoint
`fal-ai/image-editing/background-change`

### Setup

1. Create workflow named `AI-BackgroundReplace`

### Nodes

1. **Start**
2. **HTTP Request** - Call Fal.AI:
   - Method: POST
   - URL: `https://queue.fal.run/fal-ai/image-editing/background-change`
   - Headers:
     - `Authorization`: `Key YOUR_FAL_API_KEY`
   - Body:
```json
{
  "image_url": "{{ $json.image_url }}",
  "prompt": "{{ $json.params.prompt }}",
  "negative_prompt": "{{ $json.params.negative_prompt || 'blurry, distorted, low quality' }}"
}
```

3. **Wait** - Poll for completion
4. **Return** - Format response

### Output

```json
{
  "success": true,
  "output_url": "{{ $json.image.url }}",
  "processing_time_ms": "calculated",
  "estimated_cost_usd": 0.002
}
```

---

## Environment Variables

Set these in your N8N Cloud instance:

| Variable | Description |
|----------|-------------|
| `FAL_API_KEY` | Your Fal.AI API key |

---

## Supabase Configuration

After setting up workflows, add the webhook URL to Supabase:

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Add: `N8N_AI_WEBHOOK_URL` = `https://yourinstance.n8n.cloud/webhook/ai-enhance`

---

## Error Handling

Each workflow should handle:
- **Timeout**: Return error after 120 seconds
- **API Errors**: Return structured error response
- **Rate Limits**: Implement exponential backoff

### Error Response Schema

```json
{
  "success": false,
  "error": "Description of error",
  "error_code": "TIMEOUT | API_ERROR | RATE_LIMITED"
}
```

---

## Testing

1. Test each workflow independently using N8N's test feature
2. Use sample images from a public URL
3. Verify response structure matches expected schema
4. Test error scenarios (invalid URL, large images, etc.)

---

## Cost Tracking

Fal.AI costs vary by model. Approximate costs per operation:
- **Creative Upscaler**: ~$0.002 per image
- **BiRefNet v2**: ~$0.001 per image
- **Background Change**: ~$0.002 per image

Track costs by logging `estimated_cost_usd` in responses.

---

## Security Considerations

1. **API Key Protection**: Store Fal.AI key as N8N credential, not in workflow
2. **Webhook Auth**: Consider adding header authentication
3. **Input Validation**: Validate image URLs before processing
4. **Rate Limiting**: Implement per-user rate limits in Edge Function

---

## Monitoring

Set up N8N workflow monitoring:
1. Enable execution logging
2. Set up error notifications (Slack/Email)
3. Monitor execution times for performance issues
