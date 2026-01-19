import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * AI Enhance Edge Function
 * 
 * Routes AI image enhancement requests to individual N8N workflows.
 * Each feature has its own webhook URL for better concurrency handling.
 * 
 * Endpoints:
 * POST /ai-enhance - Process an image with AI enhancement
 * 
 * Request body:
 * {
 *   feature_key: 'auto_quality' | 'background_remove' | 'background_replace',
 *   image_url: string,  // URL of image to process
 *   draft_id?: string,  // Optional draft reference
 *   slot_id?: string,   // Optional slot reference
 *   preset_id?: string, // For background_replace: preset ID
 *   custom_prompt?: string, // For background_replace: custom prompt
 *   params?: object     // Optional parameter overrides
 * }
 * 
 * Architecture:
 * - Each feature has its own N8N workflow (stored in ai_model_config.endpoint_url)
 * - This prevents concurrent execution bottlenecks
 * - Allows granular control per feature
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnhanceRequest {
  feature_key: string;
  image_url: string;
  draft_id?: string;
  slot_id?: string;
  preset_id?: string;
  preset_name?: string;
  custom_prompt?: string;
  params?: Record<string, unknown>;
}

interface N8NResponse {
  success: boolean;
  output_url?: string;
  error?: string;
  error_code?: string;
  processing_time_ms?: number;
  estimated_cost_usd?: number;
  generation_id?: string;
  feature?: string;
  model_id?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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

    // Service client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: EnhanceRequest = await req.json();
    const { feature_key, image_url, draft_id, slot_id, preset_id, preset_name, custom_prompt, params } = body;

    // Validate required fields
    if (!feature_key || !image_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: feature_key and image_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ai-enhance] Processing ${feature_key} for user ${user.id}`);

    // Step 1: Get feature config (includes the individual N8N webhook URL)
    const { data: config, error: configError } = await adminClient
      .from('ai_model_config')
      .select('*')
      .eq('feature_key', feature_key)
      .eq('is_enabled', true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: `Feature '${feature_key}' not found or disabled` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the webhook URL for this specific feature
    const webhookUrl = config.endpoint_url;
    if (!webhookUrl) {
      console.error(`[ai-enhance] No endpoint_url configured for feature: ${feature_key}`);
      return new Response(
        JSON.stringify({ error: `AI service not configured for ${feature_key}` }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Check if user has enough credits
    const { data: credits, error: creditsError } = await adminClient
      .rpc('check_and_reset_ai_credits', { p_user_id: user.id });

    if (creditsError) {
      console.error('[ai-enhance] Credits check error:', creditsError);
      return new Response(
        JSON.stringify({ error: 'Failed to check credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!credits || credits.credits_remaining < config.cost_credits) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient credits',
          credits_remaining: credits?.credits_remaining || 0,
          credits_required: config.cost_credits
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get background preset if needed
    let promptToUse = custom_prompt;
    let negativePrompt = config.default_params?.negative_prompt || '';
    
    if (feature_key === 'background_replace' && preset_id && !custom_prompt) {
      const { data: preset, error: presetError } = await adminClient
        .from('background_presets')
        .select('*')
        .eq('id', preset_id)
        .eq('is_active', true)
        .single();

      if (presetError || !preset) {
        return new Response(
          JSON.stringify({ error: 'Background preset not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      promptToUse = preset.prompt;
      negativePrompt = preset.negative_prompt || negativePrompt;
    }

    // Step 4: Deduct credits (will be refunded on failure)
    const { data: deductSuccess } = await adminClient
      .rpc('deduct_ai_credits', { p_user_id: user.id, p_amount: config.cost_credits });

    if (!deductSuccess) {
      return new Response(
        JSON.stringify({ error: 'Failed to deduct credits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Create generation record
    const { data: generation, error: genError } = await adminClient
      .from('ai_generations')
      .insert({
        user_id: user.id,
        draft_id: draft_id || null,
        slot_id: slot_id || null,
        feature_key: feature_key,
        model_id: config.model_id,
        provider: config.provider,
        input_image_url: image_url,
        input_params: { ...config.default_params, ...params, prompt: promptToUse, negative_prompt: negativePrompt },
        background_preset_id: preset_id || null,
        custom_prompt: custom_prompt || null,
        credits_charged: config.cost_credits,
        status: 'processing'
      })
      .select()
      .single();

    if (genError || !generation) {
      // Refund credits on failure
      await adminClient.rpc('refund_ai_credits', { p_user_id: user.id, p_amount: config.cost_credits });
      console.error('[ai-enhance] Generation creation error:', genError);
      return new Response(
        JSON.stringify({ error: 'Failed to create generation record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 6: Call feature-specific N8N webhook
    const startTime = Date.now();
    
    try {
      // Build payload for the individual N8N workflow
      const n8nPayload = {
        generation_id: generation.id,
        image_url: image_url,
        user_id: user.id,
        preset_id: preset_id || null,
        preset_name: preset_name || null,
        params: {
          ...config.default_params,
          ...params,
          prompt: promptToUse,
          negative_prompt: negativePrompt,
        },
      };

      console.log(`[ai-enhance] Calling ${feature_key} webhook: ${webhookUrl}`);
      console.log(`[ai-enhance] Generation ID: ${generation.id}`);
      
      const n8nResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(n8nPayload),
      });

      if (!n8nResponse.ok) {
        throw new Error(`N8N returned status ${n8nResponse.status}`);
      }

      const n8nResult: N8NResponse = await n8nResponse.json();
      const processingTime = Date.now() - startTime;

      if (!n8nResult.success || !n8nResult.output_url) {
        // Refund credits on N8N failure
        await adminClient.rpc('refund_ai_credits', { p_user_id: user.id, p_amount: config.cost_credits });
        
        // Update generation as failed
        await adminClient
          .from('ai_generations')
          .update({
            status: 'failed',
            error_message: n8nResult.error || 'AI processing failed',
            processing_time_ms: processingTime,
            completed_at: new Date().toISOString()
          })
          .eq('id', generation.id);

        return new Response(
          JSON.stringify({ 
            error: 'AI processing failed',
            details: n8nResult.error,
            generation_id: generation.id
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 7: Update generation as completed
      await adminClient
        .from('ai_generations')
        .update({
          status: 'completed',
          output_image_url: n8nResult.output_url,
          processing_time_ms: n8nResult.processing_time_ms || processingTime,
          estimated_cost_usd: n8nResult.estimated_cost_usd,
          completed_at: new Date().toISOString()
        })
        .eq('id', generation.id);

      // Get updated credits
      const { data: updatedCredits } = await adminClient
        .from('ai_credits')
        .select('credits_remaining')
        .eq('user_id', user.id)
        .single();

      console.log(`[ai-enhance] Success: generation ${generation.id} completed in ${processingTime}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          generation_id: generation.id,
          output_url: n8nResult.output_url,
          credits_charged: config.cost_credits,
          credits_remaining: updatedCredits?.credits_remaining || 0,
          processing_time_ms: processingTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (n8nError) {
      const processingTime = Date.now() - startTime;
      
      // Refund credits on N8N error
      await adminClient.rpc('refund_ai_credits', { p_user_id: user.id, p_amount: config.cost_credits });
      
      // Update generation as failed
      await adminClient
        .from('ai_generations')
        .update({
          status: 'failed',
          error_message: n8nError.message || 'N8N webhook error',
          error_code: 'N8N_ERROR',
          processing_time_ms: processingTime,
          completed_at: new Date().toISOString()
        })
        .eq('id', generation.id);

      console.error('[ai-enhance] N8N error:', n8nError);
      return new Response(
        JSON.stringify({ 
          error: 'AI service temporarily unavailable',
          generation_id: generation.id
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[ai-enhance] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
