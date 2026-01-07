#!/bin/bash
# Test script for the Lean Template Sync workflow
# Usage: ./test-sync.sh <WEBHOOK_URL> <TEMPLATED_ID> [NAME] [WIDTH] [HEIGHT]

set -e

WEBHOOK_URL="${1:-YOUR_N8N_WEBHOOK_URL/webhook/sync-template}"
TEMPLATED_ID="${2:-your-templated-template-id}"
TEMPLATE_NAME="${3:-Test Beauty Template}"
CANVAS_WIDTH="${4:-1080}"
CANVAS_HEIGHT="${5:-1080}"

echo "🔄 Testing Lean Template Sync..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Webhook:      $WEBHOOK_URL"
echo "Template ID:  $TEMPLATED_ID"
echo "Name:         $TEMPLATE_NAME"
echo "Canvas:       ${CANVAS_WIDTH}x${CANVAS_HEIGHT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"templated_id\": \"$TEMPLATED_ID\",
    \"name\": \"$TEMPLATE_NAME\",
    \"canvas_width\": $CANVAS_WIDTH,
    \"canvas_height\": $CANVAS_HEIGHT,
    \"preview_url\": \"https://placehold.co/400x400/1a1a1a/ffffff?text=Preview\",
    \"is_active\": true,
    \"supports\": [\"single\"]
  }" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📬 Response (HTTP $HTTP_CODE):"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Success! Template synced to Supabase."
elif [ "$HTTP_CODE" = "400" ]; then
  echo "⚠️  Validation Error - Check required fields"
elif [ "$HTTP_CODE" = "422" ]; then
  echo "⚠️  Layer Error - Template needs 'image-before' and 'image-after' layers"
else
  echo "❌ Error occurred (HTTP $HTTP_CODE)"
fi
