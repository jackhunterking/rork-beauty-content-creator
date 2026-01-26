import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Edge function to fetch template layers from Templated.io
 * Used by admin panel to preview fonts before syncing
 * 
 * This proxies the request to avoid CORS issues in the browser
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { templated_id } = await req.json();
    
    if (!templated_id) {
      return new Response(
        JSON.stringify({ error: 'templated_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const templatedApiKey = Deno.env.get('TEMPLATED_API_KEY');
    if (!templatedApiKey) {
      return new Response(
        JSON.stringify({ error: 'TEMPLATED_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch layers from Templated.io
    const layersUrl = `https://api.templated.io/v1/template/${templated_id}/layers?includeLockedLayers=true&_t=${Date.now()}`;
    
    const response = await fetch(layersUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${templatedApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Templated.io API error: ${response.status}`, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Templated.io API error: ${response.status}`,
          details: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const layers = await response.json();
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        layers: Array.isArray(layers) ? layers : layers.layers || [] 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching template layers:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
