import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * AI Credits Edge Function
 * 
 * Manages user AI credit balances.
 * 
 * Endpoints:
 * GET /ai-credits - Get current credit balance
 * POST /ai-credits/check - Check if user has enough credits for a feature
 * 
 * GET Response:
 * {
 *   credits_remaining: number,
 *   credits_used_this_period: number,
 *   monthly_allocation: number,
 *   period_end: string (ISO date),
 *   days_until_reset: number
 * }
 * 
 * POST /check Request:
 * { feature_key: string }
 * 
 * POST /check Response:
 * {
 *   has_credits: boolean,
 *   credits_remaining: number,
 *   credits_required: number
 * }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Service client for credit operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // Handle GET /ai-credits - Get balance
    if (req.method === 'GET') {
      // Check and reset credits if period expired
      const { data: credits, error: creditsError } = await adminClient
        .rpc('check_and_reset_ai_credits', { p_user_id: user.id });

      if (creditsError) {
        console.error('[ai-credits] Error fetching credits:', creditsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch credits' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate days until reset
      const periodEnd = new Date(credits.period_end);
      const now = new Date();
      const daysUntilReset = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return new Response(
        JSON.stringify({
          credits_remaining: credits.credits_remaining,
          credits_used_this_period: credits.credits_used_this_period,
          monthly_allocation: credits.monthly_allocation,
          period_end: credits.period_end,
          days_until_reset: Math.max(0, daysUntilReset)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle POST /ai-credits/check - Check if user can afford a feature
    if (req.method === 'POST' && path === 'check') {
      const body = await req.json();
      const { feature_key } = body;

      if (!feature_key) {
        return new Response(
          JSON.stringify({ error: 'Missing feature_key' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get feature cost
      const { data: config, error: configError } = await adminClient
        .from('ai_model_config')
        .select('cost_credits, is_enabled')
        .eq('feature_key', feature_key)
        .single();

      if (configError || !config) {
        return new Response(
          JSON.stringify({ error: 'Feature not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!config.is_enabled) {
        return new Response(
          JSON.stringify({ error: 'Feature is currently disabled' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user credits
      const { data: credits, error: creditsError } = await adminClient
        .rpc('check_and_reset_ai_credits', { p_user_id: user.id });

      if (creditsError) {
        return new Response(
          JSON.stringify({ error: 'Failed to check credits' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const hasCredits = credits.credits_remaining >= config.cost_credits;

      return new Response(
        JSON.stringify({
          has_credits: hasCredits,
          credits_remaining: credits.credits_remaining,
          credits_required: config.cost_credits
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle POST /ai-credits/history - Get generation history
    if (req.method === 'POST' && path === 'history') {
      const body = await req.json();
      const limit = body.limit || 20;
      const offset = body.offset || 0;

      const { data: generations, error: genError } = await adminClient
        .from('ai_generations')
        .select('id, feature_key, status, credits_charged, output_image_url, processing_time_ms, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (genError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch history' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ generations }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed for other paths/methods
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ai-credits] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
