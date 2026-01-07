#!/bin/bash

# =============================================================================
# Interactive Template Sync Script
# Prompts for all values - no editing required!
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

clear
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Interactive Template Sync for Beauty App             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# -----------------------------------------------------------------------------
# Get API credentials (one-time setup)
# -----------------------------------------------------------------------------

CONFIG_FILE="$HOME/.beauty-app-sync-config"

if [ -f "$CONFIG_FILE" ]; then
  echo -e "${GREEN}✓ Found saved configuration${NC}"
  source "$CONFIG_FILE"
  echo -e "  Templated API Key: ${CYAN}****${TEMPLATED_API_KEY: -4}${NC}"
  echo -e "  N8n Webhook: ${CYAN}$N8N_WEBHOOK_URL${NC}"
  echo ""
  read -p "Use saved config? (Y/n): " USE_SAVED
  if [[ "$USE_SAVED" =~ ^[Nn] ]]; then
    rm "$CONFIG_FILE"
  fi
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo -e "${YELLOW}━━━ First Time Setup ━━━${NC}"
  echo ""
  read -p "Templated.io API Key: " TEMPLATED_API_KEY
  read -p "N8n Webhook URL: " N8N_WEBHOOK_URL
  
  echo "TEMPLATED_API_KEY=\"$TEMPLATED_API_KEY\"" > "$CONFIG_FILE"
  echo "N8N_WEBHOOK_URL=\"$N8N_WEBHOOK_URL\"" >> "$CONFIG_FILE"
  echo -e "${GREEN}✓ Configuration saved to $CONFIG_FILE${NC}"
  echo ""
fi

# -----------------------------------------------------------------------------
# Get template details
# -----------------------------------------------------------------------------

echo -e "${YELLOW}━━━ Template Details ━━━${NC}"
echo ""

read -p "Template ID (from Templated.io URL): " TEMPLATE_ID
read -p "Template Name (displayed in app): " TEMPLATE_NAME

echo ""
echo "Canvas Size:"
echo "  1) Square (1080x1080)"
echo "  2) Story (1080x1920)"
echo "  3) Portrait (1080x1350)"
echo "  4) Custom"
read -p "Choose [1-4]: " SIZE_CHOICE

case $SIZE_CHOICE in
  1) CANVAS_WIDTH=1080; CANVAS_HEIGHT=1080 ;;
  2) CANVAS_WIDTH=1080; CANVAS_HEIGHT=1920 ;;
  3) CANVAS_WIDTH=1080; CANVAS_HEIGHT=1350 ;;
  4) 
    read -p "Width: " CANVAS_WIDTH
    read -p "Height: " CANVAS_HEIGHT
    ;;
  *) CANVAS_WIDTH=1080; CANVAS_HEIGHT=1080 ;;
esac

echo ""
echo -e "${GREEN}✓ Size: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}${NC}"

# -----------------------------------------------------------------------------
# Get layer names
# -----------------------------------------------------------------------------

echo ""
echo -e "${YELLOW}━━━ Layer Names ━━━${NC}"
echo -e "${CYAN}(Enter layer names separated by commas, or press Enter for defaults)${NC}"
echo ""

read -p "Slot layers [slot-before,slot-after]: " SLOT_INPUT
read -p "Overlay layers [overlay-before-text,overlay-after-text]: " OVERLAY_INPUT
read -p "Background layers [background]: " BG_INPUT

# Set defaults if empty
SLOT_INPUT=${SLOT_INPUT:-"slot-before,slot-after"}
OVERLAY_INPUT=${OVERLAY_INPUT:-"overlay-before-text,overlay-after-text"}
BG_INPUT=${BG_INPUT:-"background"}

# Convert to JSON format
build_json() {
  local input="$1"
  local result=""
  IFS=',' read -ra LAYERS <<< "$input"
  for layer in "${LAYERS[@]}"; do
    layer=$(echo "$layer" | xargs) # trim whitespace
    if [ -n "$result" ]; then
      result="$result,"
    fi
    result="$result\"$layer\": {\"hide\": true}"
  done
  echo "$result"
}

SLOT_JSON=$(build_json "$SLOT_INPUT")
OVERLAY_JSON=$(build_json "$OVERLAY_INPUT")
BG_JSON=$(build_json "$BG_INPUT")

echo ""
echo -e "${GREEN}✓ Layers configured${NC}"

# -----------------------------------------------------------------------------
# Generate previews
# -----------------------------------------------------------------------------

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🖼️  Generating Frame Preview...${NC}"

FRAME_RESPONSE=$(curl -s -X POST "https://api.templated.io/v1/render" \
  -H "Authorization: Bearer $TEMPLATED_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"template\": \"$TEMPLATE_ID\",
    \"format\": \"png\",
    \"layers\": { $SLOT_JSON, $OVERLAY_JSON }
  }")

FRAME_URL=$(echo "$FRAME_RESPONSE" | grep -o '"render_url":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$FRAME_URL" ]; then
  echo -e "${RED}❌ Failed to generate frame preview${NC}"
  echo "Response: $FRAME_RESPONSE"
  exit 1
fi
echo -e "${GREEN}✓ Frame URL generated${NC}"

echo -e "${YELLOW}🎨 Generating Overlay Preview...${NC}"

OVERLAY_RESPONSE=$(curl -s -X POST "https://api.templated.io/v1/render" \
  -H "Authorization: Bearer $TEMPLATED_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"template\": \"$TEMPLATE_ID\",
    \"format\": \"png\",
    \"layers\": { $SLOT_JSON, $BG_JSON }
  }")

OVERLAY_URL=$(echo "$OVERLAY_RESPONSE" | grep -o '"render_url":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$OVERLAY_URL" ]; then
  echo -e "${YELLOW}⚠️  No overlay (template may not have overlay layers)${NC}"
  OVERLAY_URL=""
else
  echo -e "${GREEN}✓ Overlay URL generated${NC}"
fi

# -----------------------------------------------------------------------------
# Sync to app
# -----------------------------------------------------------------------------

echo ""
echo -e "${YELLOW}📤 Syncing to App...${NC}"

SYNC_RESPONSE=$(curl -s -X POST "$N8N_WEBHOOK_URL" \
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
  }")

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ TEMPLATE SYNCED SUCCESSFULLY!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "📋 ${CYAN}$TEMPLATE_NAME${NC}"
echo -e "🆔 $TEMPLATE_ID"
echo -e "📐 ${CANVAS_WIDTH}x${CANVAS_HEIGHT}"
echo ""
echo -e "🖼️  Frame:   $FRAME_URL"
echo -e "🎨 Overlay: ${OVERLAY_URL:-"(none)"}"
echo ""
echo -e "${YELLOW}Next: Open the app and pull to refresh!${NC}"
echo ""

