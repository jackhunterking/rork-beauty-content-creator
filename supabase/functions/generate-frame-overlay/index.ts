import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * Generate Frame Overlay Edge Function
 * 
 * Generates a transparent PNG frame overlay for a template by:
 * 1. Calling Templated.io with transparent=true and hiding slot + theme layers
 * 2. Extracting theme layer geometries for client-side rendering
 * 3. Uploading the result to Supabase Storage
 * 4. Updating the template's frame_overlay_url and theme_layers
 * 
 * This enables client-side compositing for:
 * - Instant background color changes without API calls
 * - Theme color customization (layers prefixed with 'theme-')
 * 
 * Layer Naming Convention:
 * - 'slot-*': Photo placeholder layers (hidden, photos rendered by app)
 * - 'theme-*': Theme-colored layers (hidden, colored shapes rendered by app)
 * - Other layers: Rendered normally in frame overlay
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATED_API_URL = 'https://api.templated.io/v1/render';

interface FrameOverlayRequest {
  /** Template ID (UUID) - can use snake_case or camelCase */
  template_id?: string;
  templateId?: string;
  /** Generate for all templates without frame overlays */
  generate_all?: boolean;
}

// Theme layer geometry - supports both shapes and text
interface ThemeLayerGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  // Discriminator for layer type
  type: 'shape' | 'text';
  // Shape-specific properties
  borderRadius?: number;
  // Text-specific properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  letterSpacing?: number;
}

interface TemplatedLayer {
  layer: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  border_radius?: number;
  // Text layer properties from Templated.io
  text?: string;
  font_family?: string;
  font_size?: string; // e.g., "58px"
  font_weight?: string;
  horizontal_align?: string;
  vertical_align?: string;
  letter_spacing?: string;
  [key: string]: unknown;
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

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: FrameOverlayRequest = await req.json();
    const templateId = body.template_id || body.templateId;

    // Validate required fields
    if (!templateId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: template_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch template data from database
    console.log(`[generate-frame-overlay] Fetching template: ${templateId}`);
    const { data: template, error: fetchError } = await adminClient
      .from('templates')
      .select('id, templated_id, layers_json, customizable_background_layers')
      .eq('id', templateId)
      .single();

    if (fetchError || !template) {
      console.error('[generate-frame-overlay] Template not found:', fetchError?.message);
      return new Response(
        JSON.stringify({ error: `Template not found: ${templateId}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const templatedId = template.templated_id;
    let layersJson: TemplatedLayer[] = template.layers_json || [];

    if (!templatedId) {
      return new Response(
        JSON.stringify({ error: 'Template does not have a Templated.io ID configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-frame-overlay] Processing template: ${templateId}, templated: ${templatedId}`);
    console.log(`[generate-frame-overlay] Layers from database: ${layersJson.length}`);
    
    // IMPORTANT: Fetch template info from Templated.io to get ALL layers
    // This ensures we can hide background layers even if they're not in our database
    try {
      const templateInfoUrl = `https://api.templated.io/v1/template/${templatedId}`;
      console.log(`[generate-frame-overlay] Fetching template info from Templated.io: ${templateInfoUrl}`);
      
      const templateInfoResponse = await fetch(templateInfoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${templatedApiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (templateInfoResponse.ok) {
        const templateInfo = await templateInfoResponse.json();
        if (templateInfo.layers && Array.isArray(templateInfo.layers)) {
          console.log(`[generate-frame-overlay] Got ${templateInfo.layers.length} layers from Templated.io`);
          
          // Get canvas dimensions for detecting full-canvas background layers
          const canvasWidth = templateInfo.width || 1080;
          const canvasHeight = templateInfo.height || 1350;
          console.log(`[generate-frame-overlay] Canvas dimensions: ${canvasWidth}x${canvasHeight}`);
          
          // Identify layers that are likely backgrounds (cover entire canvas)
          const bgFromTemplated = templateInfo.layers.filter((l: TemplatedLayer) => {
            const isFullCanvas = l.x <= 0 && l.y <= 0 && 
              l.width >= canvasWidth * 0.95 && 
              l.height >= canvasHeight * 0.95;
            const isShape = l.type === 'shape' || l.type === 'rectangle';
            const isImage = l.type === 'image' && l.x <= 0 && l.y <= 0;
            
            return isFullCanvas && (isShape || isImage);
          });
          
          if (bgFromTemplated.length > 0) {
            console.log(`[generate-frame-overlay] Detected ${bgFromTemplated.length} full-canvas background layers:`, 
              bgFromTemplated.map((l: TemplatedLayer) => l.layer).join(', '));
            
            // Merge with our layers - add any background layers not in our database
            bgFromTemplated.forEach((bgLayer: TemplatedLayer) => {
              if (!layersJson.find(l => l.layer === bgLayer.layer)) {
                layersJson.push({ ...bgLayer, _autoDetectedBg: true } as TemplatedLayer);
                console.log(`[generate-frame-overlay] Added auto-detected bg layer: ${bgLayer.layer}`);
              }
            });
          }
        }
      } else {
        console.log(`[generate-frame-overlay] Could not fetch template info (${templateInfoResponse.status}), using database layers only`);
      }
    } catch (fetchErr) {
      console.log(`[generate-frame-overlay] Error fetching template info: ${fetchErr}, using database layers only`);
    }
    
    console.log(`[generate-frame-overlay] Total layers after merge: ${layersJson.length}`);

    // Categorize layers by naming convention
    const slotLayers: TemplatedLayer[] = [];
    const themeLayers: TemplatedLayer[] = [];
    const otherLayers: TemplatedLayer[] = [];

    // Background layers to hide (for transparent background support)
    const bgLayers: TemplatedLayer[] = [];
    
    for (const layer of layersJson) {
      const layerName = (layer.layer || '').toLowerCase();
      const isAutoDetectedBg = (layer as TemplatedLayer & { _autoDetectedBg?: boolean })._autoDetectedBg;
      
      if (isAutoDetectedBg) {
        // Auto-detected background layer from Templated.io
        bgLayers.push(layer);
      } else if (layerName.includes('slot')) {
        // Slot layers: photo placeholders (hidden, photos rendered by app)
        slotLayers.push(layer);
      } else if (layerName.includes('theme-')) {
        // Theme layers: customizable colored shapes (hidden, rendered by app)
        themeLayers.push(layer);
      } else if (layerName.includes('bg-') || layerName.includes('background')) {
        // Background layers: hidden to allow dynamic background colors
        bgLayers.push(layer);
      } else {
        // Other layers: rendered normally in frame overlay
        otherLayers.push(layer);
      }
    }

    // Count text vs shape theme layers
    const textThemeLayers = themeLayers.filter(l => l.type === 'text');
    const shapeThemeLayers = themeLayers.filter(l => l.type !== 'text');

    console.log(`[generate-frame-overlay] Layer categorization:`);
    console.log(`  - Slot layers (hidden, photos): ${slotLayers.length} - ${slotLayers.map(l => l.layer).join(', ')}`);
    console.log(`  - Theme layers (hidden, rendered by app): ${themeLayers.length}`);
    console.log(`    - Text layers: ${textThemeLayers.length} - ${textThemeLayers.map(l => l.layer).join(', ')}`);
    console.log(`    - Shape layers: ${shapeThemeLayers.length} - ${shapeThemeLayers.map(l => l.layer).join(', ')}`);
    console.log(`  - Background layers (hidden, transparent): ${bgLayers.length} - ${bgLayers.map(l => l.layer).join(', ')}`);
    console.log(`  - Other layers (in overlay): ${otherLayers.length} - ${otherLayers.map(l => l.layer).join(', ')}`);

    // Helper function to parse font size from "58px" format to number
    const parseFontSize = (fontSize: string | undefined): number => {
      if (!fontSize) return 16; // Default
      const match = fontSize.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 16;
    };

    // Helper function to parse letter spacing
    const parseLetterSpacing = (spacing: string | undefined): number | undefined => {
      if (!spacing) return undefined;
      const match = spacing.match(/(-?\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : undefined;
    };

    // Extract theme layer geometries for client-side rendering
    // Now supports both shape (rectangles) and text layers
    const themeLayerGeometries: ThemeLayerGeometry[] = themeLayers.map(layer => {
      // Base geometry shared by all layer types
      const base = {
        id: layer.layer,
        x: layer.x || 0,
        y: layer.y || 0,
        width: layer.width || 0,
        height: layer.height || 0,
        rotation: layer.rotation || 0,
      };
      
      // Check if this is a text layer
      if (layer.type === 'text') {
        console.log(`[generate-frame-overlay] Text layer found: ${layer.layer}, text: "${layer.text}", font: ${layer.font_family}`);
        return {
          ...base,
          type: 'text' as const,
          text: layer.text || '',
          fontFamily: layer.font_family || 'System',
          fontSize: parseFontSize(layer.font_size),
          fontWeight: layer.font_weight || 'normal',
          horizontalAlign: (layer.horizontal_align as 'left' | 'center' | 'right') || 'center',
          verticalAlign: (layer.vertical_align as 'top' | 'center' | 'bottom') || 'center',
          letterSpacing: parseLetterSpacing(layer.letter_spacing),
        };
      }
      
      // Default to shape layer
      console.log(`[generate-frame-overlay] Shape layer found: ${layer.layer}`);
      return {
        ...base,
        type: 'shape' as const,
        borderRadius: layer.border_radius || 0,
      };
    });

    console.log(`[generate-frame-overlay] Theme layer geometries:`, JSON.stringify(themeLayerGeometries, null, 2));

    // Build layers object - hide slot, theme, AND background layers
    const hiddenLayers: { [key: string]: { hide: boolean } } = {};
    
    // Hide slot layers (image placeholders - photos rendered by app)
    slotLayers.forEach((layer) => {
      hiddenLayers[layer.layer] = { hide: true };
    });
    
    // Hide theme layers (colored shapes - rendered by app with theme color)
    themeLayers.forEach((layer) => {
      hiddenLayers[layer.layer] = { hide: true };
    });
    
    // Hide background layers (allows dynamic background color changes)
    bgLayers.forEach((layer) => {
      hiddenLayers[layer.layer] = { hide: true };
    });
    
    // IMPORTANT: Always hide common background layer names, even if not in layers_json
    // This handles templates where the background layer wasn't explicitly synced
    const commonBgLayerNames = [
      'background', 'Background', 'BACKGROUND',
      'bg', 'BG', 'Bg',
      'bg-background', 'bg-main', 'bg-color', 'bg-fill',
      'background_rectangle', 'background_color', 'background_fill',
      'Rectangle', 'rectangle', // Often used for backgrounds
      'canvas_background', 'main_background',
    ];
    
    commonBgLayerNames.forEach((name) => {
      if (!hiddenLayers[name]) {
        hiddenLayers[name] = { hide: true };
      }
    });
    
    console.log(`[generate-frame-overlay] Layers to hide (including common bg names):`, Object.keys(hiddenLayers));

    // Call Templated.io API with transparent background and hidden layers
    // NOTE: Do NOT include "background" property - let transparent:true handle it
    // Including background: '' can cause Templated.io to use template's default background
    // IMPORTANT: Match exactly what Templated.io UI sends for transparent PNG
    // When "Transparent background" is checked, it sends BOTH parameters:
    // - "background": "" (empty string)
    // - "transparent": true
    const renderPayload = {
      template: templatedId,
      format: 'png',
      background: '',     // Empty background (required for transparency)
      transparent: true,  // Enable alpha channel transparency
      layers: hiddenLayers
    };
    
    console.log(`[generate-frame-overlay] API payload:`, JSON.stringify(renderPayload));
    
    const renderResponse = await fetch(TEMPLATED_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${templatedApiKey}`
      },
      body: JSON.stringify(renderPayload)
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

    // Update template with frame_overlay_url and theme_layers
    console.log(`[generate-frame-overlay] Updating template ${templateId} with frame_overlay_url and theme_layers`);
    const { error: updateError } = await adminClient
      .from('templates')
      .update({
        frame_overlay_url: finalOverlayUrl,
        theme_layers: themeLayerGeometries,
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
    console.log(`[generate-frame-overlay] Theme layers saved: ${themeLayerGeometries.length}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        url: finalOverlayUrl,
        frameOverlayUrl: finalOverlayUrl, 
        source,
        templateId,
        templatedId,
        themeLayers: themeLayerGeometries,
        themeLayerCount: themeLayerGeometries.length,
        slotLayerCount: slotLayers.length,
        otherLayerCount: otherLayers.length
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
