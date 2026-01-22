import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * AI Poll Edge Function - Server-Side Fal.AI Status Polling
 * 
 * Polls Fal.AI for job status. Handles all response patterns including
 * transient errors (400, 405, 5xx) gracefully.
 * 
 * Note: This is a fallback for webhook failures. Primary delivery is via webhooks.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PollRequest {
  generation_id: string;
}

interface FalResultResponse {
  image?: { url: string };
  output?: { url: string };
  images?: Array<{ url: string }>;
  url?: string;
  status?: string;
  error?: { message: string };
}

// Transient HTTP status codes - keep polling (don't mark as failed)
const TRANSIENT_STATUS_CODES = [400, 405, 408, 429, 500, 502, 503, 504];

// Maximum processing time before timeout (2 minutes)
const MAX_PROCESSING_MS = 120000;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const falApiKey = Deno.env.get('FAL_API_KEY');

    if (!falApiKey) {
      console.error('[ai-poll] FAL_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: PollRequest = await req.json();
    const { generation_id } = body;

    if (!generation_id) {
      return new Response(
        JSON.stringify({ error: 'Missing generation_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch generation record (verify ownership)
    const { data: generation, error: genError } = await adminClient
      .from('ai_generations')
      .select('*')
      .eq('id', generation_id)
      .eq('user_id', user.id)
      .single();

    if (genError || !generation) {
      return new Response(
        JSON.stringify({ error: 'Generation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return cached result if already completed
    if (generation.status === 'completed' && generation.output_image_url) {
      return new Response(
        JSON.stringify({
          status: 'completed',
          output_url: generation.output_image_url,
          processing_time_ms: generation.processing_time_ms,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return cached error if already failed
    if (generation.status === 'failed') {
      return new Response(
        JSON.stringify({
          status: 'failed',
          error: generation.error_message || 'Processing failed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestId = generation.fal_request_id;
    const modelId = generation.model_id;

    if (!requestId || !modelId) {
      return new Response(
        JSON.stringify({ error: 'Missing Fal AI request info' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processingTime = generation.created_at
      ? Date.now() - new Date(generation.created_at).getTime()
      : null;

    // Check for timeout
    if (processingTime && processingTime > MAX_PROCESSING_MS) {
      console.error(`[ai-poll] Job ${generation_id} timed out after ${processingTime}ms`);
      
      await adminClient
        .from('ai_generations')
        .update({
          status: 'failed',
          error_message: 'Processing timeout - please try again',
          error_code: 'TIMEOUT',
          completed_at: new Date().toISOString(),
        })
        .eq('id', generation_id);

      return new Response(
        JSON.stringify({
          status: 'failed',
          error: 'Processing timeout - please try again',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Poll Fal AI RESULT endpoint
    const resultUrl = `https://queue.fal.run/${modelId}/requests/${requestId}`;
    console.log(`[ai-poll] Polling: ${resultUrl}`);

    const resultResponse = await fetch(resultUrl, {
      method: 'GET',
      headers: { 'Authorization': `Key ${falApiKey}` },
    });

    const statusCode = resultResponse.status;

    // Handle TRANSIENT errors (400, 405, 408, 429, 5xx) - keep polling
    if (TRANSIENT_STATUS_CODES.includes(statusCode)) {
      const errorText = await resultResponse.text();
      console.log(`[ai-poll] Transient ${statusCode}: ${errorText.substring(0, 100)}`);
      
      let message = 'Enhancing your photo...';
      let status: 'queued' | 'processing' = 'processing';
      
      if (errorText.includes('IN_QUEUE') || errorText.includes('queued')) {
        status = 'queued';
        message = 'Waiting in queue...';
      }
      
      return new Response(
        JSON.stringify({ status, message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle permanent 4xx errors (401, 403, 404)
    if (!resultResponse.ok) {
      const errorText = await resultResponse.text();
      console.error(`[ai-poll] Permanent error ${statusCode}: ${errorText}`);

      await adminClient
        .from('ai_generations')
        .update({
          status: 'failed',
          error_message: `Fal AI error: ${statusCode}`,
          error_code: 'FAL_ERROR',
          completed_at: new Date().toISOString(),
        })
        .eq('id', generation_id);

      return new Response(
        JSON.stringify({ status: 'failed', error: `Processing failed (${statusCode})` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success! Parse result
    const resultData: FalResultResponse = await resultResponse.json();
    
    // Handle status responses
    if (resultData.status === 'IN_QUEUE') {
      return new Response(
        JSON.stringify({ status: 'queued', message: 'Waiting in queue...' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (resultData.status === 'IN_PROGRESS') {
      return new Response(
        JSON.stringify({ status: 'processing', message: 'Enhancing your photo...' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (resultData.status === 'FAILED') {
      const errorMsg = resultData.error?.message || 'Processing failed';
      
      await adminClient
        .from('ai_generations')
        .update({
          status: 'failed',
          error_message: errorMsg,
          error_code: 'FAL_PROCESSING_ERROR',
          completed_at: new Date().toISOString(),
        })
        .eq('id', generation_id);

      return new Response(
        JSON.stringify({ status: 'failed', error: errorMsg }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract output URL
    const outputUrl = 
      resultData.image?.url ||
      resultData.output?.url ||
      resultData.images?.[0]?.url ||
      resultData.url;

    if (!outputUrl) {
      return new Response(
        JSON.stringify({ status: 'processing', message: 'Finalizing...' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ai-poll] Success: ${outputUrl.substring(0, 60)}...`);

    // Update generation as completed
    await adminClient
      .from('ai_generations')
      .update({
        status: 'completed',
        output_image_url: outputUrl,
        processing_time_ms: processingTime,
        completed_at: new Date().toISOString(),
      })
      .eq('id', generation_id);

    return new Response(
      JSON.stringify({
        status: 'completed',
        output_url: outputUrl,
        processing_time_ms: processingTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ai-poll] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
