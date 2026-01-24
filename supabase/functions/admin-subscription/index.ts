import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * Admin Subscription Management Edge Function
 * 
 * Allows admins to grant/revoke complimentary subscription access.
 * Protected by admin authentication (checks for admin email in authorized list)
 * 
 * Endpoints:
 * POST /admin-subscription { action: 'grant', email: '...', tier: 'pro'|'studio', expires_at?: '...', notes?: '...' }
 * POST /admin-subscription { action: 'revoke', email: '...' }
 * GET  /admin-subscription?email=... (view subscription status)
 * 
 * All actions are logged to subscription_history for audit trail.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Authorized admin emails (can be moved to env var or database config)
const ADMIN_EMAILS = [
  'metinokuyucu@gmail.com',
  'admin@resulta.app',
  // Add more admin emails as needed
];

type SubscriptionTier = 'free' | 'pro' | 'studio';

interface GrantRequest {
  action: 'grant';
  email: string;
  tier: 'pro' | 'studio';
  expires_at?: string; // ISO date string, null for indefinite
  notes?: string;
}

interface RevokeRequest {
  action: 'revoke';
  email: string;
}

type AdminRequest = GrantRequest | RevokeRequest;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'No authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Initialize Supabase clients
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // User client for auth verification
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Service client for admin operations (bypasses RLS)
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // Verify user is authenticated
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is an admin
  if (!ADMIN_EMAILS.includes(user.email || '')) {
    console.warn(`[admin-subscription] Unauthorized access attempt by ${user.email}`);
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const adminEmail = user.email!;
  console.log(`[admin-subscription] Admin access by ${adminEmail}`);

  try {
    // Handle GET request - view subscription status
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const targetEmail = url.searchParams.get('email');

      if (!targetEmail) {
        return new Response(
          JSON.stringify({ error: 'Missing email parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find user by email
      const { data: targetUser } = await adminClient
        .from('profiles')
        .select('id, email')
        .eq('email', targetEmail)
        .single();

      if (!targetUser) {
        return new Response(
          JSON.stringify({ error: 'User not found', email: targetEmail }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get subscription
      const { data: subscription } = await adminClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', targetUser.id)
        .single();

      // Get recent history
      const { data: history } = await adminClient
        .from('subscription_history')
        .select('*')
        .eq('user_id', targetUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

      return new Response(
        JSON.stringify({
          user: targetUser,
          subscription: subscription || { tier: 'free', source: 'none', status: 'active' },
          recent_history: history || [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle POST request - grant or revoke
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AdminRequest = await req.json();

    if (!body.email) {
      return new Response(
        JSON.stringify({ error: 'Missing email field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find target user by email
    const { data: targetUser } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', body.email)
      .single();

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: 'User not found', email: body.email }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current subscription state for history
    const { data: currentSub } = await adminClient
      .from('subscriptions')
      .select('id, tier, status')
      .eq('user_id', targetUser.id)
      .single();

    if (body.action === 'grant') {
      const grantRequest = body as GrantRequest;

      // Validate tier
      if (!['pro', 'studio'].includes(grantRequest.tier)) {
        return new Response(
          JSON.stringify({ error: 'Invalid tier. Must be "pro" or "studio"' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse expiration date if provided
      let expiresAt: string | null = null;
      if (grantRequest.expires_at) {
        const date = new Date(grantRequest.expires_at);
        if (isNaN(date.getTime())) {
          return new Response(
            JSON.stringify({ error: 'Invalid expires_at date format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        expiresAt = date.toISOString();
      }

      // Upsert subscription
      const { error: upsertError } = await adminClient
        .from('subscriptions')
        .upsert({
          user_id: targetUser.id,
          tier: grantRequest.tier,
          source: 'admin',
          status: 'active',
          admin_granted_by: adminEmail,
          admin_granted_at: new Date().toISOString(),
          admin_expires_at: expiresAt,
          admin_notes: grantRequest.notes || null,
          // Clear Superwall fields when granting admin access
          superwall_product_id: null,
          superwall_transaction_id: null,
          superwall_original_transaction_id: null,
          superwall_expires_at: null,
          superwall_purchased_at: null,
          superwall_environment: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (upsertError) {
        console.error('[admin-subscription] Grant error:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to grant access', details: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log to history
      await adminClient.from('subscription_history').insert({
        user_id: targetUser.id,
        subscription_id: currentSub?.id || null,
        event_type: 'admin_grant',
        event_source: 'admin_action',
        tier_before: currentSub?.tier || 'free',
        tier_after: grantRequest.tier,
        status_before: currentSub?.status || 'active',
        status_after: 'active',
        raw_payload: {
          granted_by: adminEmail,
          expires_at: expiresAt,
          notes: grantRequest.notes,
        },
        created_by: adminEmail,
      });

      console.log(`[admin-subscription] ✓ Granted ${grantRequest.tier} to ${body.email} by ${adminEmail}`);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'grant',
          email: body.email,
          tier: grantRequest.tier,
          expires_at: expiresAt,
          granted_by: adminEmail,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (body.action === 'revoke') {
      // Revoke access - set back to free
      const { error: revokeError } = await adminClient
        .from('subscriptions')
        .upsert({
          user_id: targetUser.id,
          tier: 'free',
          source: 'none',
          status: 'active',
          admin_granted_by: null,
          admin_granted_at: null,
          admin_expires_at: null,
          admin_notes: `Revoked by ${adminEmail} on ${new Date().toISOString()}`,
          // Clear Superwall fields
          superwall_product_id: null,
          superwall_transaction_id: null,
          superwall_original_transaction_id: null,
          superwall_expires_at: null,
          superwall_purchased_at: null,
          superwall_environment: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (revokeError) {
        console.error('[admin-subscription] Revoke error:', revokeError);
        return new Response(
          JSON.stringify({ error: 'Failed to revoke access', details: revokeError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log to history
      await adminClient.from('subscription_history').insert({
        user_id: targetUser.id,
        subscription_id: currentSub?.id || null,
        event_type: 'admin_revoke',
        event_source: 'admin_action',
        tier_before: currentSub?.tier || 'free',
        tier_after: 'free',
        status_before: currentSub?.status || 'active',
        status_after: 'active',
        raw_payload: {
          revoked_by: adminEmail,
        },
        created_by: adminEmail,
      });

      console.log(`[admin-subscription] ✓ Revoked access from ${body.email} by ${adminEmail}`);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'revoke',
          email: body.email,
          tier: 'free',
          revoked_by: adminEmail,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be "grant" or "revoke"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[admin-subscription] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
