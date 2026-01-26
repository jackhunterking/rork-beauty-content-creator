import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Edge function to fetch Google Fonts catalog
 * Used by admin panel for font search/autocomplete
 * 
 * This proxies the request to use the valid API key from secrets
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Cache the fonts catalog in memory (edge functions have short lifetimes, so this is per-invocation)
let cachedFonts: any[] | null = null;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const googleFontsApiKey = Deno.env.get('GOOGLE_FONTS_API_KEY');
    if (!googleFontsApiKey) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_FONTS_API_KEY not configured in secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from Google Fonts API
    const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${googleFontsApiKey}`;
    
    console.log('[fetch-google-fonts] Fetching from Google Fonts API...');
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[fetch-google-fonts] API error: ${response.status}`, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Google Fonts API error: ${response.status}`,
          details: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const fonts = data.items || [];
    
    console.log(`[fetch-google-fonts] Successfully fetched ${fonts.length} fonts`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        fonts: fonts,
        count: fonts.length
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          // Cache for 1 hour since Google Fonts catalog rarely changes
          'Cache-Control': 'public, max-age=3600'
        } 
      }
    );

  } catch (error) {
    console.error('[fetch-google-fonts] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
