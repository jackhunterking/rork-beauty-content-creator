import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * AI Enhance Edge Function - Direct Fal.AI Integration
 * 
 * Submits AI image enhancement requests directly to Fal.AI queue API.
 * Returns immediately with request_id for client-side polling.
 * 
 * Endpoints:
 * POST /ai-enhance - Submit enhancement request
 * 
 * Request body:
 * {
 *   feature_key: 'auto_quality' | 'background_remove' | 'background_replace',
 *   image_url: string,
 *   draft_id?: string,
 *   slot_id?: string,
 *   preset_id?: string,
 *   custom_prompt?: string,
 *   model_type?: 'General' | 'Portrait' | 'Product',
 *   params?: object
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   generation_id: string,
 *   request_id: string,
 *   fal_model: string,
 *   poll_url: string
 * }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fal.AI model configurations
const FAL_MODELS = {
  auto_quality: {
    model: 'fal-ai/creative-upscaler',
    defaultParams: {
      scale: 2,
      creativity: 0,
      detail: 5,
      shape_preservation: 3,
      prompt_suffix: 'high quality, highly detailed, high resolution, sharp',
      negative_prompt: 'blurry, low resolution, bad, ugly, low quality, pixelated, interpolated, compression artifacts, noisey, grainy',
      guidance_scale: 7.5,
      num_inference_steps: 20,
    },
    estimatedCostUsd: 0.015,
  },
  background_remove: {
    model: 'fal-ai/birefnet/v2',
    defaultParams: {
      model: 'General',
      operating_resolution: '1024x1024',
      output_format: 'png',
    },
    estimatedCostUsd: 0.005,
  },
  background_replace: {
    model: 'fal-ai/image-editing/background-change',
    defaultParams: {
      prompt: 'professional studio background, clean, neutral, soft lighting',
      negative_prompt: 'distracting elements, patterns, text, low quality, blurry',
      output_format: 'png',
    },
    estimatedCostUsd: 0.02,
  },
} as const;

interface EnhanceRequest {
  feature_key: keyof typeof FAL_MODELS;
  image_url: string;
  draft_id?: string;
  slot_id?: string;
  preset_id?: string;
  preset_name?: string;
  custom_prompt?: string;
  model_type?: 'General' | 'Portrait' | 'Product';
  params?: Record<string, unknown>;
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
    const falApiKey = Deno.env.get('FAL_API_KEY');

    if (!falApiKey) {
      console.error('[ai-enhance] FAL_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    const { feature_key, image_url, draft_id, slot_id, preset_id, preset_name, custom_prompt, model_type, params } = body;

    // Validate required fields
    if (!feature_key || !image_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: feature_key and image_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate feature key
    if (!(feature_key in FAL_MODELS)) {
      return new Response(
        JSON.stringify({ error: `Unknown feature: ${feature_key}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ai-enhance] Processing ${feature_key} for user ${user.id}`);

    const modelConfig = FAL_MODELS[feature_key];

    // Get feature config from database (for premium check and cost tracking)
    const { data: config } = await adminClient
      .from('ai_model_config')
      .select('*')
      .eq('feature_key', feature_key)
      .eq('is_enabled', true)
      .single();

    // Premium check (if feature requires premium)
    if (config?.is_premium_only) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .single();

      if (!profile?.is_premium) {
        return new Response(
          JSON.stringify({ error: 'Premium subscription required', code: 'PREMIUM_REQUIRED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get background preset prompt if needed
    let promptToUse = custom_prompt;
    let negativePrompt = modelConfig.defaultParams.negative_prompt || '';

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

    // Build Fal.AI request body based on feature
    let falRequestBody: Record<string, unknown> = { image_url };

    switch (feature_key) {
      case 'auto_quality':
        falRequestBody = {
          image_url,
          scale: params?.scale ?? modelConfig.defaultParams.scale,
          creativity: params?.creativity ?? modelConfig.defaultParams.creativity,
          detail: params?.detail ?? modelConfig.defaultParams.detail,
          shape_preservation: params?.shape_preservation ?? modelConfig.defaultParams.shape_preservation,
          prompt_suffix: params?.prompt_suffix ?? modelConfig.defaultParams.prompt_suffix,
          negative_prompt: params?.negative_prompt ?? modelConfig.defaultParams.negative_prompt,
          guidance_scale: params?.guidance_scale ?? modelConfig.defaultParams.guidance_scale,
          num_inference_steps: params?.num_inference_steps ?? modelConfig.defaultParams.num_inference_steps,
        };
        break;

      case 'background_remove':
        falRequestBody = {
          image_url,
          model: model_type ?? params?.model ?? modelConfig.defaultParams.model,
          operating_resolution: params?.operating_resolution ?? modelConfig.defaultParams.operating_resolution,
          output_format: params?.output_format ?? modelConfig.defaultParams.output_format,
        };
        break;

      case 'background_replace':
        falRequestBody = {
          image_url,
          prompt: promptToUse ?? modelConfig.defaultParams.prompt,
          negative_prompt: negativePrompt,
          output_format: params?.output_format ?? modelConfig.defaultParams.output_format,
        };
        break;
    }

    // Track credits for internal purposes (deduct from user's allocation)
    const costCredits = config?.cost_credits || 1;
    await adminClient.rpc('check_and_reset_ai_credits', { p_user_id: user.id });
    await adminClient.rpc('deduct_ai_credits', { p_user_id: user.id, p_amount: costCredits });

    // Create generation record
    const { data: generation, error: genError } = await adminClient
      .from('ai_generations')
      .insert({
        user_id: user.id,
        draft_id: draft_id || null,
        slot_id: slot_id || null,
        feature_key: feature_key,
        model_id: modelConfig.model,
        provider: 'fal-ai',
        input_image_url: image_url,
        input_params: falRequestBody,
        background_preset_id: preset_id || null,
        custom_prompt: custom_prompt || null,
        credits_charged: costCredits,
        status: 'processing'
      })
      .select()
      .single();

    if (genError || !generation) {
      // Refund credits on failure
      await adminClient.rpc('refund_ai_credits', { p_user_id: user.id, p_amount: costCredits });
      console.error('[ai-enhance] Generation creation error:', genError);
      return new Response(
        JSON.stringify({ error: 'Failed to create generation record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Submit to Fal.AI queue
    const falQueueUrl = `https://queue.fal.run/${modelConfig.model}`;
    console.log(`[ai-enhance] Submitting to Fal.AI: ${falQueueUrl}`);

    try {
      const falResponse = await fetch(falQueueUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${falApiKey}`,
        },
        body: JSON.stringify(falRequestBody),
      });

      if (!falResponse.ok) {
        const errorText = await falResponse.text();
        throw new Error(`Fal.AI error: ${falResponse.status} - ${errorText}`);
      }

      const falResult = await falResponse.json();
      const requestId = falResult.request_id;

      if (!requestId) {
        throw new Error('No request_id returned from Fal.AI');
      }

      // Update generation with request_id
      await adminClient
        .from('ai_generations')
        .update({ fal_request_id: requestId })
        .eq('id', generation.id);

      console.log(`[ai-enhance] Queued successfully: generation=${generation.id}, request_id=${requestId}`);

      // Return immediately for client-side polling
      return new Response(
        JSON.stringify({
          success: true,
          generation_id: generation.id,
          request_id: requestId,
          fal_model: modelConfig.model,
          poll_url: `https://queue.fal.run/${modelConfig.model}/requests/${requestId}`,
          estimated_time_seconds: feature_key === 'auto_quality' ? 30 : 15,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (falError) {
      // Refund credits on Fal.AI error
      await adminClient.rpc('refund_ai_credits', { p_user_id: user.id, p_amount: costCredits });
      
      // Update generation as failed
      await adminClient
        .from('ai_generations')
        .update({
          status: 'failed',
          error_message: falError.message || 'Fal.AI submission failed',
          error_code: 'FAL_SUBMIT_ERROR',
          completed_at: new Date().toISOString()
        })
        .eq('id', generation.id);

      console.error('[ai-enhance] Fal.AI submission error:', falError);
      return new Response(
        JSON.stringify({ 
          error: 'AI service temporarily unavailable',
          details: falError.message,
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
