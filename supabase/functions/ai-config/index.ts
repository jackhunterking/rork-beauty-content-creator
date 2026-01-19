import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * AI Config Edge Function
 * 
 * Fetches AI feature configurations and background presets.
 * Allows the app to dynamically update available features.
 * 
 * Endpoints:
 * GET /ai-config - Get all enabled AI features
 * GET /ai-config/presets - Get background presets for background_replace
 * 
 * GET Response:
 * {
 *   features: [
 *     {
 *       feature_key: string,
 *       display_name: string,
 *       description: string,
 *       icon: string,
 *       cost_credits: number,
 *       is_premium_only: boolean
 *     }
 *   ]
 * }
 * 
 * GET /presets Response:
 * {
 *   presets: [
 *     {
 *       id: string,
 *       name: string,
 *       category: string,
 *       preview_url: string | null,
 *       preview_color: string,
 *       is_premium: boolean
 *     }
 *   ]
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

  // Only allow GET
  if (req.method !== 'GET') {
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

    // User client for auth verification and data fetch
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

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

    // GET /ai-config/presets - Get background presets
    if (path === 'presets') {
      const { data: presets, error: presetsError } = await userClient
        .from('background_presets')
        .select('id, name, category, preview_url, preview_color, is_premium, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (presetsError) {
        console.error('[ai-config] Error fetching presets:', presetsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch presets' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Group by category for easier UI consumption
      const groupedPresets = {
        studio: presets?.filter(p => p.category === 'studio') || [],
        solid: presets?.filter(p => p.category === 'solid') || [],
        nature: presets?.filter(p => p.category === 'nature') || [],
        blur: presets?.filter(p => p.category === 'blur') || [],
        professional: presets?.filter(p => p.category === 'professional') || [],
      };

      return new Response(
        JSON.stringify({
          presets: presets || [],
          grouped: groupedPresets
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
          } 
        }
      );
    }

    // GET /ai-config - Get all enabled AI features
    const { data: features, error: configError } = await userClient
      .from('ai_model_config')
      .select('feature_key, display_name, description, icon, cost_credits, is_premium_only, sort_order')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (configError) {
      console.error('[ai-config] Error fetching config:', configError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        features: features || [],
        version: '1.0.0' // Can be used for cache invalidation
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        } 
      }
    );

  } catch (error) {
    console.error('[ai-config] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
