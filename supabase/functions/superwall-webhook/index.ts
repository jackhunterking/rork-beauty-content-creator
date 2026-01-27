import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Webhook } from "https://esm.sh/svix@1.15.0";

/**
 * Superwall Webhook Handler
 * 
 * Receives subscription lifecycle events from Superwall and updates
 * the subscriptions table (single source of truth).
 * 
 * Security:
 * - Verifies Svix signature before processing
 * - Uses service_role to bypass RLS
 * - Logs all events to subscription_history for audit
 * 
 * Supported events:
 * - initial_purchase: First-time subscription purchase
 * - renewal: Subscription renewed
 * - cancellation: User cancelled (access until expiry)
 * - expiration: Subscription expired
 * - uncancellation: User re-subscribed after cancellation
 * - billing_issue: Payment failed (grace period)
 * - refund: Full refund processed
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

// Product ID to tier mapping
// Using the actual Resulta product IDs from App Store Connect
const PRODUCT_TIER_MAP: Record<string, 'pro' | 'studio'> = {
  // Pro tier products
  'resulta_pro_weekly': 'pro',
  'resulta_pro_monthly': 'pro',
  'resulta_pro_yearly': 'pro',
  // Studio tier products
  'resulta_studio_weekly': 'studio',
  'resulta_studio_monthly': 'studio',
  'resulta_studio_yearly': 'studio',
};

// ============================================
// Meta Conversion API (CAPI) Integration
// ============================================

/**
 * Convert ArrayBuffer to hex string for SHA256 hashing
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a string using SHA256 (required for Meta CAPI user data)
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToHex(hashBuffer);
}

/**
 * Send purchase event to Meta Conversion API
 * This provides server-side tracking for iOS 14.5+ users who denied ATT
 * 
 * @param supabase - Supabase client for fetching user email
 * @param userId - User ID to look up profile
 * @param event - Superwall webhook payload with purchase data
 */
async function sendToMetaConversionAPI(
  supabase: SupabaseClient,
  userId: string,
  event: WebhookPayload
): Promise<void> {
  const pixelId = Deno.env.get('META_PIXEL_ID');
  const accessToken = Deno.env.get('META_ACCESS_TOKEN');
  
  // Skip if Meta CAPI is not configured
  if (!pixelId || !accessToken) {
    console.log('[superwall-webhook] Meta CAPI not configured, skipping');
    return;
  }
  
  try {
    // Get user email from profiles table for better matching
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
    
    // Prepare user data with hashed identifiers
    const userData: Record<string, string[]> = {
      external_id: [await hashString(userId)],
    };
    
    // Add hashed email if available (improves matching rate by ~30%)
    if (profile?.email) {
      userData.em = [await hashString(profile.email)];
    }
    
    // Build the CAPI payload
    // Using action_source: 'other' for server-side events (works reliably)
    // Events are still tracked for attribution and appear in Events Manager
    const payload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(event.data.purchasedAt / 1000), // Convert ms to seconds
        event_id: event.data.transactionId, // For deduplication with client-side SDK
        action_source: 'other', // Server-generated events
        user_data: userData,
        custom_data: {
          currency: event.data.currencyCode || 'USD',
          value: event.data.price, // Actual purchase price from Superwall
          content_ids: [event.data.productId],
          content_type: 'product',
          content_name: event.data.productId,
        },
      }],
    };
    
    console.log('[superwall-webhook] Sending to Meta CAPI:', {
      event_name: 'Purchase',
      value: event.data.price,
      currency: event.data.currencyCode,
      productId: event.data.productId,
      hasEmail: !!profile?.email,
    });
    
    // Send to Meta Conversion API
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('[superwall-webhook] ✓ Meta CAPI event sent successfully:', result);
    } else {
      console.error('[superwall-webhook] Meta CAPI error:', result);
    }
  } catch (error) {
    // Don't fail the webhook if CAPI fails - subscription update is more important
    console.error('[superwall-webhook] Meta CAPI exception:', error);
  }
}

/**
 * Determine subscription tier from product ID
 */
function getTierFromProductId(productId: string): 'pro' | 'studio' | 'free' {
  // Direct match first
  if (PRODUCT_TIER_MAP[productId]) {
    return PRODUCT_TIER_MAP[productId];
  }
  
  // Pattern matching fallback for any variations
  const lowerProductId = productId.toLowerCase();
  if (lowerProductId.includes('studio')) return 'studio';
  if (lowerProductId.includes('pro') || lowerProductId.includes('premium')) return 'pro';
  
  console.warn(`[superwall-webhook] Unknown product ID: ${productId}, defaulting to free`);
  return 'free';
}

/**
 * Superwall webhook payload structure
 * Based on official Superwall documentation:
 * https://superwall.com/docs/integrations/webhooks
 * 
 * IMPORTANT: All timestamps are in MILLISECONDS since epoch
 */
interface WebhookPayload {
  object: string;  // Always "event"
  type: string;    // Event type (initial_purchase, renewal, etc.)
  projectId: number;
  applicationId: number;
  timestamp: number;  // When webhook was created (ms)
  data: {
    id: string;  // Unique event ID - use for idempotency
    name: string;  // Same as type
    originalAppUserId: string | null;  // User ID from identify() - requires SDK v4.5.2+
    originalTransactionId: string;  // Subscription ID (persists across renewals)
    transactionId: string;  // This specific transaction's ID
    productId: string;  // Apple/Google product identifier
    expirationAt: number | null;  // Expiration timestamp in MILLISECONDS
    purchasedAt: number;  // Purchase timestamp in MILLISECONDS
    ts: number;  // When event occurred in MILLISECONDS
    environment: 'PRODUCTION' | 'SANDBOX';
    periodType: 'TRIAL' | 'INTRO' | 'NORMAL';
    cancelReason?: string | null;  // CUSTOMER_SUPPORT, UNSUBSCRIBE, BILLING_ERROR, UNKNOWN
    expirationReason?: string;  // For expiration events
    price: number;  // Price in USD (negative for refunds)
    proceeds: number;  // Net proceeds after fees
    priceInPurchasedCurrency: number;
    currencyCode: string;
    exchangeRate: number;
    commissionPercentage: number;
    taxPercentage: number | null;
    isTrialConversion?: boolean;  // Only true for renewal events
    isFamilyShare?: boolean;  // App Store only
    isSmallBusiness?: boolean;
    offerCode?: string | null;
    store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PADDLE';
    bundleId: string;
    countryCode?: string;
    newProductId?: string | null;  // For product_change events
    userAttributes?: Record<string, unknown>;  // Custom attributes from setUserAttributes()
    [key: string]: unknown;
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const webhookSecret = Deno.env.get('SUPERWALL_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[superwall-webhook] SUPERWALL_WEBHOOK_SECRET not configured');
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get raw payload for signature verification
    const payload = await req.text();
    
    // Get Svix headers for signature verification
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('[superwall-webhook] Missing Svix headers', {
        hasSvixId: !!svixId,
        hasSvixTimestamp: !!svixTimestamp,
        hasSvixSignature: !!svixSignature,
      });
      return new Response(JSON.stringify({ error: 'Missing signature headers' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature using Svix
    const wh = new Webhook(webhookSecret);
    let event: WebhookPayload;
    
    try {
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as WebhookPayload;
    } catch (err) {
      console.error('[superwall-webhook] Signature verification failed:', err);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[superwall-webhook] ✓ Verified event: ${event.type}`, {
      originalAppUserId: event.data.originalAppUserId,
      aliasId: event.data.aliasId,
      productId: event.data.productId,
      environment: event.data.environment,
      store: event.data.store,
    });

    // Extract user ID - prefer originalAppUserId (set by identify() call)
    // Fall back to aliasId if user wasn't identified before purchase
    let userId = event.data.originalAppUserId;
    
    if (!userId) {
      // Check if aliasId is actually a UUID (might be our user ID)
      const aliasId = event.data.aliasId;
      if (aliasId && !aliasId.startsWith('$SuperwallAlias:')) {
        userId = aliasId;
        console.log(`[superwall-webhook] Using aliasId as userId: ${userId}`);
      }
    }
    
    if (!userId) {
      console.warn('[superwall-webhook] No originalAppUserId - user was not identified before purchase');
      console.warn('[superwall-webhook] aliasId:', event.data.aliasId);
      
      // Still return 200 to acknowledge receipt (don't want Superwall retrying)
      // Log to history without user_id for manual investigation
      return new Response(JSON.stringify({ 
        success: true, 
        warning: 'No user ID - event acknowledged but cannot be processed',
        aliasId: event.data.aliasId,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean up user ID (remove Superwall prefix if present)
    const cleanUserId = userId.startsWith('$SuperwallAlias:') 
      ? userId.substring('$SuperwallAlias:'.length) 
      : userId;

    // Validate UUID format (Supabase user IDs are UUIDs)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanUserId)) {
      console.error('[superwall-webhook] Invalid user ID format:', cleanUserId);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid user ID format',
        receivedUserId: cleanUserId,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user exists in auth.users
    const { data: userExists } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', cleanUserId)
      .single();

    if (!userExists) {
      console.error('[superwall-webhook] User not found in database:', cleanUserId);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User not found',
        userId: cleanUserId,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current subscription state (for history tracking)
    const { data: currentSub } = await supabase
      .from('subscriptions')
      .select('id, tier, status')
      .eq('user_id', cleanUserId)
      .single();

    // Determine new tier and status based on event type
    let newTier: 'free' | 'pro' | 'studio' = 'free';
    let newStatus: 'active' | 'cancelled' | 'expired' | 'grace_period' = 'active';
    
    switch (event.type) {
      case 'initial_purchase':
      case 'renewal':
      case 'uncancellation':
        // Active subscription
        newTier = getTierFromProductId(event.data.productId);
        newStatus = 'active';
        break;
        
      case 'cancellation':
        // User cancelled but still has access until expiration
        newTier = getTierFromProductId(event.data.productId);
        newStatus = 'cancelled';
        break;
        
      case 'expiration':
        // Subscription expired - back to free
        newTier = 'free';
        newStatus = 'expired';
        break;
        
      case 'billing_issue':
        // Payment failed - grace period
        newTier = getTierFromProductId(event.data.productId);
        newStatus = 'grace_period';
        break;
        
      case 'refund':
        // Full refund - immediate downgrade
        newTier = 'free';
        newStatus = 'expired';
        break;
        
      case 'product_change':
        // User upgraded/downgraded their subscription
        // newProductId contains the new product, productId is the old one
        const newProductId = event.data.newProductId || event.data.productId;
        newTier = getTierFromProductId(newProductId);
        newStatus = 'active';
        console.log(`[superwall-webhook] Product change: ${event.data.productId} -> ${newProductId}`);
        break;
        
      case 'non_renewing_purchase':
        // One-time purchase (not a subscription)
        // Treat as active for now - would need business logic for how long
        newTier = getTierFromProductId(event.data.productId);
        newStatus = 'active';
        break;
        
      case 'subscription_paused':
        // Play Store only - subscription temporarily paused
        // Keep current tier but mark as paused (we use grace_period)
        newTier = getTierFromProductId(event.data.productId);
        newStatus = 'grace_period';
        break;
        
      default:
        console.log(`[superwall-webhook] Unhandled event type: ${event.type}`);
        // For unknown events, just log and acknowledge
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Event type '${event.type}' acknowledged but not processed`,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log(`[superwall-webhook] Processing: ${event.type} -> tier=${newTier}, status=${newStatus}`);

    // Upsert subscription record
    // NOTE: Superwall timestamps are already in MILLISECONDS (not seconds)
    // See: https://superwall.com/docs/integrations/webhooks
    const subscriptionData = {
      user_id: cleanUserId,
      tier: newTier,
      source: 'superwall' as const,
      status: newStatus,
      superwall_product_id: event.data.productId,
      superwall_transaction_id: event.data.transactionId,
      superwall_original_transaction_id: event.data.originalTransactionId,
      superwall_expires_at: event.data.expirationAt 
        ? new Date(event.data.expirationAt).toISOString()  // Already in ms
        : null,
      superwall_purchased_at: new Date(event.data.purchasedAt).toISOString(),  // Already in ms
      superwall_environment: event.data.environment,
      // Clear admin fields if this is a Superwall event (Superwall takes precedence)
      admin_granted_by: null,
      admin_granted_at: null,
      admin_expires_at: null,
      admin_notes: null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      console.error('[superwall-webhook] Failed to upsert subscription:', upsertError);
      return new Response(JSON.stringify({ error: 'Database error', details: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the subscription ID for history
    const { data: updatedSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', cleanUserId)
      .single();

    // Log to subscription_history for audit trail
    const { error: historyError } = await supabase
      .from('subscription_history')
      .insert({
        user_id: cleanUserId,
        subscription_id: updatedSub?.id || null,
        event_type: event.type,
        event_source: 'superwall_webhook',
        tier_before: currentSub?.tier || 'free',
        tier_after: newTier,
        status_before: currentSub?.status || 'active',
        status_after: newStatus,
        raw_payload: event.data,
        created_by: 'webhook',
      });

    if (historyError) {
      // Non-critical - log but don't fail
      console.warn('[superwall-webhook] Failed to log history:', historyError);
    }

    // Send purchase events to Meta Conversion API for better attribution
    // Only for revenue-generating events (not cancellations/expirations/refunds)
    const purchaseEvents = ['initial_purchase', 'renewal', 'non_renewing_purchase', 'uncancellation'];
    if (purchaseEvents.includes(event.type) && event.data.price > 0) {
      await sendToMetaConversionAPI(supabase, cleanUserId, event);
    }

    console.log(`[superwall-webhook] ✓ Successfully processed ${event.type} for user ${cleanUserId}`);
    console.log(`[superwall-webhook] Tier: ${currentSub?.tier || 'free'} -> ${newTier}`);
    console.log(`[superwall-webhook] Status: ${currentSub?.status || 'active'} -> ${newStatus}`);

    return new Response(JSON.stringify({ 
      success: true,
      event_type: event.type,
      user_id: cleanUserId,
      tier: newTier,
      status: newStatus,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[superwall-webhook] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
