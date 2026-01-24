# Superwall Webhook Integration Setup Guide

This guide explains how to configure Superwall webhooks to sync subscription data with the Supabase `subscriptions` table.

> **Reference**: [Official Superwall Webhooks Documentation](https://superwall.com/docs/integrations/webhooks)

## Prerequisites

- Superwall Dashboard access
- Supabase project access
- Edge Function deployed: `superwall-webhook`
- **Superwall SDK v4.5.2+** (required for `originalAppUserId` to be populated correctly)

## Step 1: Deploy the Edge Function

The webhook handler has been created at:
```
supabase/functions/superwall-webhook/index.ts
```

Deploy it using the Supabase CLI:
```bash
supabase functions deploy superwall-webhook --project-ref tmgjsrxdjbazrwvbdoed
```

Or deploy via GitHub integration if configured.

## Step 2: Get Your Webhook Endpoint URL

Your webhook endpoint URL is:
```
https://tmgjsrxdjbazrwvbdoed.supabase.co/functions/v1/superwall-webhook
```

## Step 3: Configure Superwall Dashboard

1. **Navigate to Superwall Dashboard**
   - Go to [superwall.com](https://superwall.com) and log in
   - Select your Resulta project

2. **Open Webhook Settings**
   - Go to **Settings** → **Integrations** → **Webhooks**
   - Click **Add Webhook** or **Create Webhook**

3. **Configure the Webhook**
   - **URL**: `https://tmgjsrxdjbazrwvbdoed.supabase.co/functions/v1/superwall-webhook`
   - **Environment**: Start with `Production` (can add `Sandbox` later for testing)
   - **Events**: Select ALL subscription events:
     - ✅ `initial_purchase` - First subscription purchase
     - ✅ `renewal` - Subscription renewed
     - ✅ `cancellation` - User cancelled (still active until expiry)
     - ✅ `expiration` - Subscription expired
     - ✅ `uncancellation` - User re-subscribed
     - ✅ `billing_issue` - Payment failed (grace period)
     - ✅ `refund` - Full refund processed
     - ✅ `product_change` - Changed subscription tier

4. **Copy the Signing Secret**
   - After creating the webhook, Superwall will display a **Signing Secret**
   - It looks like: `whsec_xxxxxxxxxxxxxxxxxxxxx`
   - **COPY THIS SECRET** - you'll need it in the next step

5. **Save and Enable**
   - Save the webhook configuration
   - Make sure it's enabled (toggle should be ON)

## Step 4: Add the Secret to Supabase

Add the webhook signing secret to Supabase Edge Function secrets:

**Option A: Via Supabase CLI**
```bash
supabase secrets set SUPERWALL_WEBHOOK_SECRET=whsec_your_secret_here --project-ref tmgjsrxdjbazrwvbdoed
```

**Option B: Via Supabase Dashboard**
1. Go to Supabase Dashboard → Edge Functions → superwall-webhook
2. Click "Manage secrets" or go to Settings → Secrets
3. Add a new secret:
   - Name: `SUPERWALL_WEBHOOK_SECRET`
   - Value: `whsec_your_secret_here`

## Step 5: Verify App Store Server Notifications

For webhooks to fire, Apple must send Server-to-Server notifications to Superwall:

1. **In App Store Connect**:
   - Go to your app → App Information → App Store Server Notifications
   - Add Production Server URL from Superwall Dashboard
   - Add Sandbox Server URL from Superwall Dashboard

2. **Get URLs from Superwall**:
   - Dashboard → Settings → App Store Connect Integration
   - Copy the Production and Sandbox notification URLs

## Step 6: Test the Integration

### ⚠️ Critical: Local StoreKit Testing Does NOT Work

> **iOS local StoreKit transactions (using a StoreKit Configuration file or StoreKitTest in Xcode) do NOT generate App Store Server Notifications. As a result, Superwall webhooks will NOT fire for these local test purchases.**
>
> — [Superwall Documentation](https://superwall.com/docs/integrations/webhooks)

This is a fundamental limitation of Apple's architecture, not Superwall or our implementation.

### Valid Testing Methods by Platform

| Platform | Method | Notes |
|----------|--------|-------|
| **iOS** | TestFlight + Sandbox Apple ID | Required for webhook testing |
| **Android** | License test accounts | Use Google Play sandbox purchases |
| **Stripe** | Stripe Test Mode | Create sandbox transactions |

**Note**: Superwall does NOT support sending arbitrary "test" webhooks.

### Testing with iOS Sandbox (The Only Way)

1. **Build and upload to TestFlight**
   - Archive your app with production Superwall keys
   - Upload to App Store Connect
   - Distribute via TestFlight (internal or external)

2. **Create a Sandbox Apple ID**
   - Go to App Store Connect → Users and Access → Sandbox Testers
   - Create a new sandbox tester account
   - Use a unique email (can be fake, e.g., `sandbox1@example.com`)

3. **Test on device**
   - Sign out of your real Apple ID in Settings → App Store
   - Install the TestFlight build
   - When prompted to purchase, use your Sandbox Apple ID
   - The purchase will be free (sandbox) but generate real webhooks

4. **Verify webhook delivery**
   - Check Edge Function logs: `supabase functions logs superwall-webhook`
   - Check `subscription_history` table for new records
   - Verify `subscriptions` table updated correctly

### Manual Endpoint Test (Deployment Verification Only)

```bash
# Test the endpoint responds (will fail signature but confirms deployment)
curl -X POST https://tmgjsrxdjbazrwvbdoed.supabase.co/functions/v1/superwall-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

Expected response: `{"error":"Missing signature headers"}` (400 status)

This confirms the function is deployed and responding, but does NOT test actual webhook processing.

## Step 7: Monitor Webhook Events

### Edge Function Logs
```bash
supabase functions logs superwall-webhook --project-ref tmgjsrxdjbazrwvbdoed
```

Or via Supabase Dashboard → Edge Functions → superwall-webhook → Logs

### Subscription History Table
Check the audit trail in Supabase:
```sql
SELECT * FROM subscription_history 
WHERE event_source = 'superwall_webhook' 
ORDER BY created_at DESC 
LIMIT 20;
```

## Webhook Best Practices

Based on [Superwall's official recommendations](https://superwall.com/docs/integrations/webhooks):

1. **Handle duplicate events** - Use `event.id` for idempotency (we store raw_payload)
2. **Process webhooks asynchronously** - Return 200 immediately, then process (our function does this)
3. **Store raw webhook data** - For debugging and reconciliation (stored in `subscription_history.raw_payload`)
4. **Handle all event types** - Even if you don't process them immediately
5. **Monitor webhook failures** - Check Edge Function logs regularly
6. **Use timestamps correctly** - All timestamps are in **milliseconds** since epoch

## Webhook Payload Structure

Every webhook from Superwall follows this structure:

```json
{
  "object": "event",
  "type": "renewal",
  "projectId": 3827,
  "applicationId": 1,
  "timestamp": 1754067715103,
  "data": {
    "id": "42fc6339-dc28-470b-a0fa-0d13c92d8b61:renewal",
    "name": "renewal",
    "originalAppUserId": "$SuperwallAlias:7152E89E-60A6-4B2E-9C67-D7ED8F5BE372",
    "originalTransactionId": "700002050981465",
    "transactionId": "700002054157982",
    "productId": "com.example.premium.monthly",
    "expirationAt": 1756659704000,
    "purchasedAt": 1754067704000,
    "environment": "PRODUCTION",
    "store": "APP_STORE",
    "periodType": "NORMAL",
    "price": 9.99,
    "proceeds": 6.99,
    "currencyCode": "USD",
    "isTrialConversion": false,
    "isFamilyShare": false,
    "cancelReason": null
  }
}
```

### Important Fields for Our Implementation

| Field | Description | Usage |
|-------|-------------|-------|
| `type` | Event type (see below) | Determines how to update subscription |
| `data.originalAppUserId` | User ID from `identify()` call | Maps to Supabase `user_id` |
| `data.productId` | Apple/Google product ID | Maps to subscription tier |
| `data.expirationAt` | When subscription expires (ms) | Stored as `superwall_expires_at` |
| `data.environment` | PRODUCTION or SANDBOX | Stored for filtering analytics |
| `data.store` | APP_STORE, PLAY_STORE, STRIPE | For future multi-platform |

### Event Types

| Event | Description | Our Action |
|-------|-------------|------------|
| `initial_purchase` | First subscription | Set tier, status=active |
| `renewal` | Subscription renewed | Update expiration, status=active |
| `cancellation` | User cancelled (still active) | Set status=cancelled |
| `expiration` | Subscription expired | Set tier=free, status=expired |
| `uncancellation` | User re-subscribed | Set status=active |
| `billing_issue` | Payment failed | Set status=grace_period |
| `refund` | Full refund | Set tier=free, status=expired |
| `product_change` | Changed tier (pro→studio) | Update tier |

### Understanding `originalAppUserId`

This field is **critical** for mapping webhooks to your users:

- **Requires SDK v4.5.2+** - Older SDK versions may not populate this field
- **Set by `identify()` call** - Must be called BEFORE user makes a purchase
- **UUIDv4 format recommended** - Supabase user IDs work perfectly
- **May have prefix** - Sometimes appears as `$SuperwallAlias:UUID` (our function handles this)

**When this field is null:**
- User on old SDK version
- Purchase made before integrating Superwall
- `identify()` was never called before purchase

### Timestamp Handling

All timestamps from Superwall are in **milliseconds** since epoch:

```typescript
// Convert to ISO string for Supabase
const expiresAt = event.data.expirationAt 
  ? new Date(event.data.expirationAt).toISOString()  // Already in ms
  : null;
```

**Note**: The webhook function already handles this conversion correctly.

## Troubleshooting

### Webhook Not Firing

**On iOS specifically:**
- ❌ **Local StoreKit purchases (Xcode simulator) will NEVER trigger webhooks**
- ✅ Use TestFlight + Sandbox Apple ID instead

**General checks:**
- Ensure App Store Server Notifications are configured in App Store Connect
- Verify webhook is enabled in Superwall Dashboard
- Check if using correct environment (Production vs Sandbox)
- Verify the webhook URL is exactly correct (no trailing slashes)

### Signature Verification Failing
- Verify `SUPERWALL_WEBHOOK_SECRET` is set correctly in Supabase Secrets
- Secret should start with `whsec_`
- Re-copy the secret from Superwall Dashboard (don't include any whitespace)
- Check that you're using the secret for the correct environment (Production vs Sandbox)

### User Not Found / originalAppUserId is null

**Common causes:**
1. **SDK version too old** - Requires Superwall SDK v4.5.2+ for `originalAppUserId`
2. **identify() not called** - Must call `identifySuperwallUser(userId)` BEFORE showing paywall
3. **Legacy purchase** - User purchased before integrating Superwall
4. **User ID format** - UUIDv4 format is recommended (Supabase IDs work perfectly)

**How to debug:**
- Check Superwall Dashboard → Users to see what user ID is associated
- If you see `$SuperwallAlias:UUID` prefix, our function handles this
- If completely null, the purchase was made without identification

### Webhook Returns 200 But Database Not Updated
- Check Edge Function logs for specific errors
- Verify user exists in `profiles` table (subscription trigger depends on profile)
- Check if `originalAppUserId` is present and valid UUID in webhook payload
- Look at `subscription_history` table for any logged errors

### Timestamps Seem Wrong
- Superwall sends timestamps in **milliseconds** (not seconds)
- If dates appear in year 50000+, you're accidentally multiplying by 1000
- Our function handles this correctly as of the latest update

### Family Sharing Events
- When `isFamilyShare: true` with `price > 0`: This is the family organizer (paying)
- When `isFamilyShare: true` with `price = 0`: This is a family member (not paying)
- Both get access, but only organizer transactions have revenue

## Product ID Mapping

The webhook handler maps these product IDs to tiers:

| Product ID | Tier |
|------------|------|
| `resulta_pro_weekly` | pro |
| `resulta_pro_monthly` | pro |
| `resulta_pro_yearly` | pro |
| `resulta_studio_weekly` | studio |
| `resulta_studio_monthly` | studio |
| `resulta_studio_yearly` | studio |

If you add new products, update the `PRODUCT_TIER_MAP` in the webhook function.

## Event Support by Store

Based on [Superwall's documentation](https://superwall.com/docs/integrations/webhooks), not all events are available on all stores:

| Event | APP_STORE | PLAY_STORE | STRIPE |
|-------|-----------|------------|--------|
| `initial_purchase` | ✅ | ✅ | ✅ |
| `renewal` | ✅ | ✅ | ✅ |
| `cancellation` | ✅ | ✅ | ✅ |
| `expiration` | ✅ | ✅ | ✅ |
| `uncancellation` | ✅ | ✅ | ✅ |
| `billing_issue` | ✅ | ✅ | ✅ |
| `product_change` | ✅ | ✅ | ❌ |
| `non_renewing_purchase` | ✅ | ✅ | ❌ |
| `subscription_paused` | ❌ | ✅ | ❌ |
| `refund` | ✅ | ✅ | ✅ |

Our webhook handler supports ALL of these events.

## Architecture Diagram

```
┌──────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│   App Store      │     │   Superwall     │     │     Supabase        │
│                  │     │                 │     │                     │
│  ┌────────────┐  │     │  ┌───────────┐  │     │  ┌───────────────┐  │
│  │ Purchase   │──┼────▶│  │ Webhook   │──┼────▶│  │ superwall-    │  │
│  │ Event      │  │     │  │ Engine    │  │     │  │ webhook fn    │  │
│  └────────────┘  │     │  └───────────┘  │     │  └───────┬───────┘  │
│                  │     │                 │     │          │          │
└──────────────────┘     └─────────────────┘     │  ┌───────▼───────┐  │
                                                 │  │ subscriptions │  │
                                                 │  │ table         │  │
                                                 │  └───────────────┘  │
                                                 │                     │
                                                 └─────────────────────┘
```

## Security Notes

- Webhook secret should never be committed to version control
- Use Supabase Secrets for storing the webhook secret
- All webhooks are verified using Svix HMAC-SHA256 signatures
- Service role key is used to bypass RLS (never expose to client)
