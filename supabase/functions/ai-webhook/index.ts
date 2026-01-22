import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * AI Webhook Edge Function - Receives Fal.AI Completion Callbacks
 * 
 * This endpoint receives webhooks from Fal.AI when jobs complete.
 * It updates the database immediately, triggering Supabase Realtime
 * to notify the client instantly - no polling needed!
 * 
 * Endpoint: POST /ai-webhook
 * 
 * Fal.AI webhook payload format:
 * {
 *   request_id: string,
 *   status: 'OK' | 'ERROR',
 *   payload?: { image?: { url: string }, ... },
 *   error?: string
 * }
 * 
 * We pass generation_id in the webhook URL as a query parameter.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-fal-signature',
};

interface FalWebhookPayload {
  request_id: string;
  status: 'OK' | 'ERROR';
  payload?: {
    image?: { url: string };
    output?: { url: string };
    images?: Array<{ url: string }>;
    url?: string;
  };
  error?: string;
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
    // Get generation_id from query params
    const url = new URL(req.url);
    const generationId = url.searchParams.get('generation_id');

    if (!generationId) {
      console.error('[ai-webhook] Missing generation_id in query params');
      return new Response(
        JSON.stringify({ error: 'Missing generation_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse webhook payload
    const payload: FalWebhookPayload = await req.json();
    console.log(`[ai-webhook] Received for ${generationId}: status=${payload.status}, request_id=${payload.request_id}`);

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch generation to get created_at for processing time calculation
    const { data: generation, error: fetchError } = await adminClient
      .from('ai_generations')
      .select('created_at, status')
      .eq('id', generationId)
      .single();

    if (fetchError || !generation) {
      console.error(`[ai-webhook] Generation not found: ${generationId}`, fetchError);
      return new Response(
        JSON.stringify({ error: 'Generation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Don't process if already completed/failed (idempotency)
    if (generation.status === 'completed' || generation.status === 'failed') {
      console.log(`[ai-webhook] Generation ${generationId} already ${generation.status}, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate processing time
    const processingTime = generation.created_at
      ? Date.now() - new Date(generation.created_at).getTime()
      : null;

    // Handle error response
    if (payload.status === 'ERROR' || payload.error) {
      const errorMessage = payload.error || 'Fal AI processing failed';
      console.error(`[ai-webhook] Job failed: ${errorMessage}`);

      await adminClient
        .from('ai_generations')
        .update({
          status: 'failed',
          error_message: errorMessage,
          error_code: 'FAL_WEBHOOK_ERROR',
          processing_time_ms: processingTime,
          completed_at: new Date().toISOString(),
        })
        .eq('id', generationId);

      return new Response(
        JSON.stringify({ success: true, status: 'failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle success response - extract output URL
    const outputUrl = 
      payload.payload?.image?.url ||
      payload.payload?.output?.url ||
      payload.payload?.images?.[0]?.url ||
      payload.payload?.url;

    if (!outputUrl) {
      console.error(`[ai-webhook] No output URL in payload:`, JSON.stringify(payload).substring(0, 300));
      
      await adminClient
        .from('ai_generations')
        .update({
          status: 'failed',
          error_message: 'No output URL in Fal AI response',
          error_code: 'NO_OUTPUT_URL',
          processing_time_ms: processingTime,
          completed_at: new Date().toISOString(),
        })
        .eq('id', generationId);

      return new Response(
        JSON.stringify({ success: false, error: 'No output URL' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ai-webhook] Success! Output: ${outputUrl.substring(0, 60)}...`);

    // Update generation as completed
    // This triggers Supabase Realtime → Client gets instant notification!
    const { error: updateError } = await adminClient
      .from('ai_generations')
      .update({
        status: 'completed',
        output_image_url: outputUrl,
        processing_time_ms: processingTime,
        completed_at: new Date().toISOString(),
      })
      .eq('id', generationId);

    if (updateError) {
      console.error(`[ai-webhook] Failed to update generation:`, updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Database update failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'completed',
        output_url: outputUrl,
        processing_time_ms: processingTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ai-webhook] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
