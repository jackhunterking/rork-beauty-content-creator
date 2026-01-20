import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * Generate Frame Overlay Edge Function
 * 
 * Generates a transparent PNG frame overlay for a template by:
 * 1. Calling Templated.io with transparent=true and hiding slot layers
 * 2. Uploading the result to Supabase Storage
 * 3. Updating the template's frame_overlay_url
 * 
 * This enables client-side compositing for instant background color changes
 * without API calls.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATED_API_URL = 'https://api.templated.io/v1/render';

interface FrameOverlayRequest {
  templateId: string;
  templatedId: string;
  layersJson: Array<{ layer: string; [key: string]: unknown }>;
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
    // Get Templated.io API key from environment
    const templatedApiKey = Deno.env.get('TEMPLATED_API_KEY');
    if (!templatedApiKey) {
      console.error('[generate-frame-overlay] TEMPLATED_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Templated.io API key not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: FrameOverlayRequest = await req.json();
    const { templateId, templatedId, layersJson } = body;

    // Validate required fields
    if (!templateId || !templatedId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: templateId and templatedId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-frame-overlay] Processing template: ${templateId}, templated: ${templatedId}`);

    // Auto-detect slot layers (layers with "slot" in their name)
    const slotLayers = (layersJson || []).filter((layer) => {
      const layerName = (layer.layer || '').toLowerCase();
      return layerName.includes('slot');
    });

    console.log(`[generate-frame-overlay] Found ${slotLayers.length} slot layers to hide`);

    // Build layers object with hidden slots
    const hiddenLayers: { [key: string]: { hide: boolean } } = {};
    slotLayers.forEach((layer) => {
      hiddenLayers[layer.layer] = { hide: true };
    });

    // Call Templated.io API with transparent background and hidden slots
    console.log(`[generate-frame-overlay] Calling Templated.io API...`);
    const renderResponse = await fetch(TEMPLATED_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${templatedApiKey}`
      },
      body: JSON.stringify({
        template: templatedId,
        format: 'png',
        transparent: true,
        layers: hiddenLayers
      })
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error(`[generate-frame-overlay] Templated.io API error: ${renderResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Templated.io API error: ${renderResponse.status} - ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const renderResult = await renderResponse.json();
    const renderUrl = renderResult.render_url;

    if (!renderUrl) {
      console.error('[generate-frame-overlay] No render_url in Templated.io response');
      return new Response(
        JSON.stringify({ error: 'No render URL returned from Templated.io' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-frame-overlay] Render URL received: ${renderUrl}`);

    // Download the rendered PNG
    console.log(`[generate-frame-overlay] Downloading rendered PNG...`);
    const imageResponse = await fetch(renderUrl);
    if (!imageResponse.ok) {
      console.error(`[generate-frame-overlay] Failed to download image: ${imageResponse.status}`);
      return new Response(
        JSON.stringify({ error: 'Failed to download rendered image' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageData = new Uint8Array(imageArrayBuffer);

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Generate a unique filename
    const filename = `${templatedId}-frame-overlay.png`;

    // Upload to Supabase Storage (frame-overlays bucket)
    console.log(`[generate-frame-overlay] Uploading to Supabase Storage: ${filename}`);
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('frame-overlays')
      .upload(filename, imageData, {
        contentType: 'image/png',
        upsert: true
      });

    let finalOverlayUrl = renderUrl;
    let source = 'templated.io';

    if (uploadError) {
      console.warn(`[generate-frame-overlay] Storage upload failed, using Templated.io URL:`, uploadError.message);
    } else {
      // Get public URL
      const { data: publicUrlData } = adminClient.storage
        .from('frame-overlays')
        .getPublicUrl(filename);
      
      if (publicUrlData?.publicUrl) {
        finalOverlayUrl = publicUrlData.publicUrl;
        source = 'supabase-storage';
        console.log(`[generate-frame-overlay] Uploaded to Supabase Storage: ${finalOverlayUrl}`);
      }
    }

    // Update template with the final URL
    console.log(`[generate-frame-overlay] Updating template ${templateId} with frame_overlay_url`);
    const { error: updateError } = await adminClient
      .from('templates')
      .update({
        frame_overlay_url: finalOverlayUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId);

    if (updateError) {
      console.error(`[generate-frame-overlay] Failed to update template:`, updateError.message);
      return new Response(
        JSON.stringify({ error: `Failed to update template: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-frame-overlay] Success! Template ${templateId} updated with ${source} URL`);

    return new Response(
      JSON.stringify({ 
        frameOverlayUrl: finalOverlayUrl, 
        source,
        templateId,
        templatedId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-frame-overlay] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
