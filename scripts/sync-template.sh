#!/bin/bash

# =============================================================================
# Template Sync Script
# Generates frame & overlay previews from Templated.io and syncs to app
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# CONFIGURATION - Edit these values
# -----------------------------------------------------------------------------

# Your Templated.io API Key (get from https://app.templated.io/settings/api)
TEMPLATED_API_KEY="YOUR_TEMPLATED_API_KEY_HERE"

# Your N8n webhook URL
N8N_WEBHOOK_URL="https://jackhunterking.app.n8n.cloud/webhook/sync-template"

# -----------------------------------------------------------------------------
# TEMPLATE DETAILS - Edit for each template
# -----------------------------------------------------------------------------

# Template ID (from Templated.io URL: app.templated.io/editor/[THIS_PART])
TEMPLATE_ID=""

# Display name in the app
TEMPLATE_NAME=""

# Canvas dimensions
CANVAS_WIDTH=1080
CANVAS_HEIGHT=1080

# -----------------------------------------------------------------------------
# LAYER NAMES - Edit based on your template's layers
# -----------------------------------------------------------------------------

# Slot layer names (comma-separated JSON)
# These are image layers where user photos go
SLOT_LAYERS='
  "slot-before": {"hide": true},
  "slot-after": {"hide": true}
'

# Overlay layer names (comma-separated JSON)
# These are labels, arrows, etc. that appear ON TOP of photos
OVERLAY_LAYERS='
  "overlay-before-text": {"hide": true},
  "overlay-after-text": {"hide": true}
'

# Background layer names (comma-separated JSON)
# These are background shapes, colors, frames
BACKGROUND_LAYERS='
  "background": {"hide": true}
'

# =============================================================================
# SCRIPT - Don't edit below unless you know what you're doing
# =============================================================================

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Template Sync Script for Beauty App               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Validate configuration
if [ "$TEMPLATED_API_KEY" == "YOUR_TEMPLATED_API_KEY_HERE" ]; then
  echo -e "${RED}❌ Error: Please set your TEMPLATED_API_KEY${NC}"
  exit 1
fi

if [ "$N8N_WEBHOOK_URL" == "YOUR_N8N_WEBHOOK_URL_HERE" ]; then
  echo -e "${RED}❌ Error: Please set your N8N_WEBHOOK_URL${NC}"
  exit 1
fi

if [ -z "$TEMPLATE_ID" ]; then
  echo -e "${RED}❌ Error: Please set TEMPLATE_ID${NC}"
  exit 1
fi

if [ -z "$TEMPLATE_NAME" ]; then
  echo -e "${RED}❌ Error: Please set TEMPLATE_NAME${NC}"
  exit 1
fi

echo -e "${YELLOW}📋 Template: ${NC}$TEMPLATE_NAME"
echo -e "${YELLOW}📐 Size: ${NC}${CANVAS_WIDTH}x${CANVAS_HEIGHT}"
echo -e "${YELLOW}🆔 ID: ${NC}$TEMPLATE_ID"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Generate Frame Preview (background only)
# -----------------------------------------------------------------------------
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🖼️  Step 1: Generating Frame Preview...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

FRAME_PAYLOAD=$(cat <<EOF
{
  "template": "$TEMPLATE_ID",
  "format": "png",
  "layers": {
    $SLOT_LAYERS,
    $OVERLAY_LAYERS
  }
}
EOF
)

FRAME_RESPONSE=$(curl -s -X POST "https://api.templated.io/v1/render" \
  -H "Authorization: Bearer $TEMPLATED_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$FRAME_PAYLOAD")

FRAME_URL=$(echo "$FRAME_RESPONSE" | grep -o '"render_url":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$FRAME_URL" ]; then
  echo -e "${RED}❌ Failed to generate frame preview${NC}"
  echo "Response: $FRAME_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Frame URL: ${NC}$FRAME_URL"
echo ""

# -----------------------------------------------------------------------------
# Step 2: Generate Overlay Preview (overlays only)
# -----------------------------------------------------------------------------
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🎨 Step 2: Generating Overlay Preview...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

OVERLAY_PAYLOAD=$(cat <<EOF
{
  "template": "$TEMPLATE_ID",
  "format": "png",
  "layers": {
    $SLOT_LAYERS,
    $BACKGROUND_LAYERS
  }
}
EOF
)

OVERLAY_RESPONSE=$(curl -s -X POST "https://api.templated.io/v1/render" \
  -H "Authorization: Bearer $TEMPLATED_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$OVERLAY_PAYLOAD")

OVERLAY_URL=$(echo "$OVERLAY_RESPONSE" | grep -o '"render_url":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$OVERLAY_URL" ]; then
  echo -e "${YELLOW}⚠️  No overlay preview generated (may not have overlay layers)${NC}"
  OVERLAY_URL=""
else
  echo -e "${GREEN}✅ Overlay URL: ${NC}$OVERLAY_URL"
fi
echo ""

# -----------------------------------------------------------------------------
# Step 3: Sync to App via N8n Webhook
# -----------------------------------------------------------------------------
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📤 Step 3: Syncing to App...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

SYNC_PAYLOAD=$(cat <<EOF
{
  "templated_id": "$TEMPLATE_ID",
  "name": "$TEMPLATE_NAME",
  "canvas_width": $CANVAS_WIDTH,
  "canvas_height": $CANVAS_HEIGHT,
  "preview_url": "https://api.templated.io/v1/templates/$TEMPLATE_ID/preview",
  "frame_preview_url": "$FRAME_URL",
  "overlay_preview_url": "$OVERLAY_URL",
  "is_active": true,
  "supports": ["single"]
}
EOF
)

echo "Sending to webhook..."
SYNC_RESPONSE=$(curl -s -X POST "$N8N_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$SYNC_PAYLOAD")

echo ""
echo -e "${GREEN}Response:${NC}"
echo "$SYNC_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SYNC_RESPONSE"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Template sync complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Check Supabase to verify the template was saved"
echo -e "  2. Open the app and pull to refresh"
echo -e "  3. The template should appear in the Create tab"
echo ""

