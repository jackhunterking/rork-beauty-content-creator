import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * Generate Frame Overlay Edge Function
 * 
 * Clean, hierarchical layer processing with strict naming conventions:
 * 
 * ============================================================
 * LAYER RULES (3 Simple Patterns)
 * ============================================================
 * 
 * | Prefix/Type      | Behavior              | Where Rendered        | Hidden in PNG |
 * |------------------|----------------------|----------------------|---------------|
 * | `slot-*`         | Photo placeholder    | App (user photos)    | Yes           |
 * | `theme-*`        | Color customizable   | App (dynamic color)  | Yes           |
 * | `vector` type    | SVG icon/shape       | App (react-native-svg)| Yes          |
 * | Everything else  | Static as designed   | Frame Overlay PNG    | No            |
 * 
 * Background transparency is handled by Templated.io's `transparent: true` option.
 * NO hardcoded layer names - behavior determined purely by prefix.
 * ============================================================
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATED_API_URL = 'https://api.templated.io/v1/render';

// ============================================================
// TYPE DEFINITIONS - Hierarchical Structure
// ============================================================

interface FrameOverlayRequest {
  template_id?: string;
  templateId?: string;
}

/** Level 1: Raw layer from Templated.io API */
interface RawLayer {
  layer: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  border_radius?: number;
  opacity?: number | null;
  fill?: string | null;
  stroke?: string | null;
  color?: string | null;
  html?: string | null;
  text?: string;
  font_family?: string;
  font_size?: string;
  font_weight?: string;
  horizontal_align?: string;
  vertical_align?: string;
  letter_spacing?: string;
  [key: string]: unknown;
}

/** Level 2: Categorized layer with z-index */
type LayerCategory = 'slot' | 'theme' | 'vector' | 'static';

interface CategorizedLayer extends RawLayer {
  category: LayerCategory;
  zIndex: number;
}

/** Level 3: Extracted theme layer for client-side rendering */
interface ThemeLayerOutput {
  id: string;
  type: 'shape' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation?: number;
  opacity?: number;
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number;
  // Shape-specific
  borderRadius?: number;
  shapeType?: 'rectangle' | 'ellipse' | 'circle' | 'custom';
  viewBox?: string;
  pathData?: string;
  // Text-specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  letterSpacing?: number;
  color?: string | null;
}

/** Level 3: Extracted vector layer for SVG rendering */
interface VectorLayerOutput {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation?: number;
  opacity?: number;
  viewBox: string;
  pathData: string;
  fill: string;
  isThemed?: boolean;
}

// ============================================================
// HELPER FUNCTIONS - Parsing & Extraction
// ============================================================

/**
 * Categorize a layer by its name prefix or type
 * STRICT PREFIX MATCHING - no loose contains() checks
 */
function categorizeLayer(layer: RawLayer, index: number): CategorizedLayer {
  const name = layer.layer.toLowerCase();
  
  let category: LayerCategory;
  
  if (name.startsWith('slot-')) {
    // Rule 1: Photo placeholder (strict slot- prefix)
    category = 'slot';
  } else if (name.startsWith('theme-')) {
    // Rule 2: Color customizable (strict theme- prefix)
    category = 'theme';
  } else if (layer.type === 'vector') {
    // Rule 3: Vector type for SVG rendering
    category = 'vector';
  } else {
    // Rule 4: Everything else stays in PNG
    category = 'static';
  }
  
  return {
    ...layer,
    category,
    zIndex: index + 1, // Array position determines z-order (1-indexed)
  };
}

/**
 * Parse color string (hex, rgb, rgba) and extract opacity
 */
function parseColor(colorStr: string | null | undefined): { color: string | null; opacity: number } {
  if (!colorStr) return { color: null, opacity: 1.0 };
  
  // RGBA format: rgba(48,48,48,0.08)
  const rgbaMatch = colorStr.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    const hex = `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`.toUpperCase();
    return { color: hex, opacity: parseFloat(a) };
  }
  
  // RGB format: rgb(48, 48, 48)
  const rgbMatch = colorStr.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    const hex = `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`.toUpperCase();
    return { color: hex, opacity: 1.0 };
  }
  
  return { color: colorStr, opacity: 1.0 };
}

/**
 * Parse font size from "58px" format to number
 */
function parseFontSize(fontSize: string | undefined): number {
  if (!fontSize) return 16;
  const match = fontSize.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 16;
}

/**
 * Parse letter spacing from string to number
 */
function parseLetterSpacing(spacing: string | undefined): number | undefined {
  if (!spacing) return undefined;
  const match = spacing.match(/(-?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : undefined;
}

/**
 * Extract border radius from HTML SVG content
 */
function extractBorderRadius(html: string | null | undefined, borderRadius?: number): number {
  if (borderRadius) return borderRadius;
  if (!html) return 0;
  
  const rxMatch = html.match(/rx\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
  return rxMatch ? parseFloat(rxMatch[1]) : 0;
}

/**
 * Detect shape type from HTML SVG content
 */
function detectShapeType(html: string | null | undefined): 'rectangle' | 'ellipse' | 'circle' | 'custom' {
  if (!html) return 'rectangle';
  
  if (html.includes('<ellipse')) {
    const rxMatch = html.match(/rx\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
    const ryMatch = html.match(/ry\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
    if (rxMatch && ryMatch && rxMatch[1] === ryMatch[1]) return 'circle';
    return 'ellipse';
  }
  if (html.includes('<rect')) return 'rectangle';
  if (html.includes('<path')) return 'custom';
  
  return 'rectangle';
}

/**
 * Extract SVG viewBox from HTML
 */
function extractViewBox(html: string | null | undefined): string {
  if (!html) return '0 0 24 24';
  const match = html.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  return match ? match[1] : '0 0 24 24';
}

/**
 * Extract SVG path data from HTML
 */
function extractPathData(html: string | null | undefined): string {
  if (!html) return '';
  const match = html.match(/<path[^>]*\sd\s*=\s*["']([^"']+)["']/i);
  return match ? match[1] : '';
}

/**
 * Extract fill color from SVG HTML
 */
function extractSvgFill(html: string | null | undefined): string {
  if (!html) return '#FFFFFF';
  
  const fillMatch = html.match(/fill\s*=\s*["']([^"']+)["']/i);
  if (fillMatch) {
    const fillValue = fillMatch[1];
    const rgbMatch = fillValue.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      return `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`.toUpperCase();
    }
    return fillValue;
  }
  return '#FFFFFF';
}

/**
 * Extract stroke width from SVG HTML
 * Looks for stroke-width="3" pattern
 */
function extractStrokeWidth(html: string | null | undefined): number {
  if (!html) return 0;
  
  const strokeWidthMatch = html.match(/stroke-width\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
  return strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 0;
}

// ============================================================
// LAYER EXTRACTION FUNCTIONS
// ============================================================

/**
 * Extract theme layer data for client-side rendering
 */
function extractThemeLayer(layer: CategorizedLayer): ThemeLayerOutput {
  const fillParsed = parseColor(layer.fill);
  const strokeParsed = parseColor(layer.stroke);
  const borderRadius = extractBorderRadius(layer.html, layer.border_radius);
  const shapeType = detectShapeType(layer.html);
  const finalOpacity = layer.opacity ?? fillParsed.opacity ?? 1.0;
  
  // Extract stroke width from HTML or default to 1 if stroke is present
  const strokeWidth = extractStrokeWidth(layer.html) || (layer.stroke ? 1 : 0);
  
  const base: ThemeLayerOutput = {
    id: layer.layer,
    type: layer.type === 'text' ? 'text' : 'shape',
    x: layer.x || 0,
    y: layer.y || 0,
    width: layer.width || 0,
    height: layer.height || 0,
    zIndex: layer.zIndex,
    rotation: layer.rotation || 0,
    opacity: finalOpacity,
    fill: fillParsed.color,
    stroke: strokeParsed.color,
    strokeWidth: strokeWidth > 0 ? strokeWidth : undefined,
  };
  
  if (layer.type === 'text') {
    const textColorParsed = parseColor(layer.color);
    return {
      ...base,
      type: 'text',
      text: layer.text || '',
      fontFamily: layer.font_family || 'System',
      fontSize: parseFontSize(layer.font_size),
      fontWeight: layer.font_weight || 'normal',
      horizontalAlign: (layer.horizontal_align as 'left' | 'center' | 'right') || 'center',
      verticalAlign: (layer.vertical_align as 'top' | 'center' | 'bottom') || 'center',
      letterSpacing: parseLetterSpacing(layer.letter_spacing),
      color: textColorParsed.color,
    };
  }
  
  // Shape layer
  const result: ThemeLayerOutput = {
    ...base,
    type: 'shape',
    borderRadius,
    shapeType,
  };
  
  // Extract SVG data for custom shapes
  if (shapeType === 'custom' && layer.html) {
    const viewBox = extractViewBox(layer.html);
    const pathData = extractPathData(layer.html);
    if (viewBox && pathData) {
      result.viewBox = viewBox;
      result.pathData = pathData;
    }
  }
  
  return result;
}

/**
 * Extract vector layer data for SVG rendering
 */
function extractVectorLayer(layer: CategorizedLayer): VectorLayerOutput {
  return {
    id: layer.layer,
    x: layer.x || 0,
    y: layer.y || 0,
    width: layer.width || 0,
    height: layer.height || 0,
    zIndex: layer.zIndex,
    rotation: layer.rotation || 0,
    opacity: layer.opacity ?? 1.0,
    viewBox: extractViewBox(layer.html),
    pathData: extractPathData(layer.html),
    fill: extractSvgFill(layer.html),
    isThemed: false,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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
    const templatedApiKey = Deno.env.get('TEMPLATED_API_KEY');
    if (!templatedApiKey) {
      console.error('[generate-frame-overlay] TEMPLATED_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Templated.io API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body: FrameOverlayRequest = await req.json();
    const templateId = body.template_id || body.templateId;

    if (!templateId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: template_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // STEP 1: Fetch Template from Database
    // ============================================================
    console.log(`[generate-frame-overlay] Fetching template: ${templateId}`);
    const { data: template, error: fetchError } = await adminClient
      .from('templates')
      .select('id, templated_id, layers_json')
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
    if (!templatedId) {
      return new Response(
        JSON.stringify({ error: 'Template does not have a Templated.io ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // STEP 2: Fetch Fresh Layers from Templated.io API
    // ============================================================
    let rawLayers: RawLayer[] = template.layers_json || [];
    
    try {
      const layersUrl = `https://api.templated.io/v1/template/${templatedId}/layers?includeLockedLayers=true&_t=${Date.now()}`;
      console.log(`[generate-frame-overlay] Fetching layers from Templated.io`);
      
      const layersResponse = await fetch(layersUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${templatedApiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (layersResponse.ok) {
        const layersData = await layersResponse.json();
        const freshLayers = Array.isArray(layersData) ? layersData : layersData.layers || [];
        
        if (freshLayers.length > 0) {
          rawLayers = freshLayers;
          console.log(`[generate-frame-overlay] Got ${rawLayers.length} layers from API`);
        }
      }
    } catch (err) {
      console.log(`[generate-frame-overlay] Using database layers (API fetch failed)`);
    }

    // ============================================================
    // STEP 3: Categorize Layers (Hierarchical Processing)
    // ============================================================
    console.log(`[generate-frame-overlay] Processing ${rawLayers.length} layers`);
    
    const categorizedLayers = rawLayers.map(categorizeLayer);
    
    // Group by category
    const slotLayers = categorizedLayers.filter(l => l.category === 'slot');
    const themeLayers = categorizedLayers.filter(l => l.category === 'theme');
    const vectorLayers = categorizedLayers.filter(l => l.category === 'vector');
    const staticLayers = categorizedLayers.filter(l => l.category === 'static');

    console.log(`[generate-frame-overlay] Layer categorization:`);
    console.log(`  - Slot (slot-*): ${slotLayers.length} - ${slotLayers.map(l => l.layer).join(', ') || 'none'}`);
    console.log(`  - Theme (theme-*): ${themeLayers.length} - ${themeLayers.map(l => l.layer).join(', ') || 'none'}`);
    console.log(`  - Vector: ${vectorLayers.length} - ${vectorLayers.map(l => l.layer).join(', ') || 'none'}`);
    console.log(`  - Static (in PNG): ${staticLayers.length} - ${staticLayers.map(l => l.layer).join(', ') || 'none'}`);

    // ============================================================
    // STEP 4: Extract Layer Data for Client-Side Rendering
    // ============================================================
    const themeLayerOutputs = themeLayers.map(extractThemeLayer);
    const vectorLayerOutputs = vectorLayers.map(extractVectorLayer);

    console.log(`[generate-frame-overlay] Extracted ${themeLayerOutputs.length} theme layers`);
    console.log(`[generate-frame-overlay] Extracted ${vectorLayerOutputs.length} vector layers`);

    // ============================================================
    // STEP 4.5: Extract and Register Fonts
    // ============================================================
    const fontFamilies = new Set<string>();
    const systemFonts = new Set(['system', 'san francisco', 'helvetica', 'helvetica neue', 'arial', 'roboto', 'sans-serif', 'serif', 'monospace']);
    
    // Collect all font families from layers
    rawLayers.forEach(layer => {
      if (layer.font_family && layer.font_family.trim()) {
        const fontName = layer.font_family.trim();
        // Skip system fonts
        if (!systemFonts.has(fontName.toLowerCase())) {
          fontFamilies.add(fontName);
        }
      }
    });
    
    console.log(`[generate-frame-overlay] Found ${fontFamilies.size} unique fonts: ${Array.from(fontFamilies).join(', ') || 'none'}`);
    
    // Check each font against Google Fonts API and register in custom_fonts table
    const fontResults: { font: string; source: string; isNew: boolean }[] = [];
    
    if (fontFamilies.size > 0) {
      const googleFontsApiKey = Deno.env.get('GOOGLE_FONTS_API_KEY');
      let googleFontsList = new Set<string>();
      
      // Fetch Google Fonts catalog
      if (googleFontsApiKey) {
        try {
          const gfResponse = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${googleFontsApiKey}`);
          if (gfResponse.ok) {
            const gfData = await gfResponse.json();
            googleFontsList = new Set((gfData.items || []).map((f: { family: string }) => f.family.toLowerCase()));
            console.log(`[generate-frame-overlay] Google Fonts catalog loaded: ${googleFontsList.size} fonts`);
          }
        } catch (e) {
          console.log(`[generate-frame-overlay] Could not fetch Google Fonts catalog, will mark unknown fonts as custom`);
        }
      } else {
        console.log(`[generate-frame-overlay] GOOGLE_FONTS_API_KEY not set, will mark unknown fonts as custom`);
      }
      
      // Register each font in custom_fonts table
      for (const fontFamily of fontFamilies) {
        const isGoogleFont = googleFontsList.has(fontFamily.toLowerCase());
        const source = isGoogleFont ? 'google' : 'supabase';
        
        // Check if font already exists
        const { data: existingFont } = await adminClient
          .from('custom_fonts')
          .select('id, source, is_active')
          .eq('font_family', fontFamily)
          .single();
        
        if (existingFont) {
          // Font already exists, don't change it
          fontResults.push({ font: fontFamily, source: existingFont.source, isNew: false });
          console.log(`[generate-frame-overlay] Font "${fontFamily}" already registered (${existingFont.source}, active: ${existingFont.is_active})`);
        } else {
          // New font - register it
          const { error: insertError } = await adminClient
            .from('custom_fonts')
            .insert({
              font_family: fontFamily,
              display_name: fontFamily,
              source: source,
              is_active: isGoogleFont, // Google fonts active immediately, custom need upload
              weights: ['400', '700'],
            });
          
          if (insertError) {
            console.error(`[generate-frame-overlay] Failed to register font "${fontFamily}":`, insertError.message);
          } else {
            fontResults.push({ font: fontFamily, source, isNew: true });
            console.log(`[generate-frame-overlay] Registered new font "${fontFamily}" (${source}, active: ${isGoogleFont})`);
          }
        }
      }
    }

    // ============================================================
    // STEP 5: Build Hidden Layers for Templated.io API
    // ============================================================
    const hiddenLayers: Record<string, { hide: true }> = {};
    
    // Hide slot, theme, and vector layers
    [...slotLayers, ...themeLayers, ...vectorLayers].forEach(layer => {
      hiddenLayers[layer.layer] = { hide: true };
    });

    console.log(`[generate-frame-overlay] Hiding ${Object.keys(hiddenLayers).length} layers in PNG`);

    // ============================================================
    // STEP 6: Call Templated.io Render API
    // ============================================================
    const renderPayload = {
      template: templatedId,
      format: 'png',
      transparent: true,  // Background transparency via API option
      layers: hiddenLayers,
    };
    
    console.log(`[generate-frame-overlay] Calling Templated.io render API`);
    
    const renderResponse = await fetch(TEMPLATED_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${templatedApiKey}`,
      },
      body: JSON.stringify(renderPayload),
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error(`[generate-frame-overlay] Templated.io error: ${renderResponse.status}`);
      return new Response(
        JSON.stringify({ error: `Templated.io API error: ${renderResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const renderResult = await renderResponse.json();
    const renderUrl = renderResult.render_url;

    if (!renderUrl) {
      return new Response(
        JSON.stringify({ error: 'No render URL returned' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // STEP 7: Download and Upload to Supabase Storage
    // ============================================================
    console.log(`[generate-frame-overlay] Downloading rendered PNG`);
    const imageResponse = await fetch(renderUrl);
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to download rendered image' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageData = new Uint8Array(await imageResponse.arrayBuffer());
    const filename = `${templatedId}-frame-overlay.png`;

    console.log(`[generate-frame-overlay] Uploading to storage: ${filename}`);
    const { error: uploadError } = await adminClient.storage
      .from('frame-overlays')
      .upload(filename, imageData, {
        contentType: 'image/png',
        upsert: true,
      });

    let finalOverlayUrl = renderUrl;
    let source = 'templated.io';

    if (!uploadError) {
      const { data: publicUrlData } = adminClient.storage
        .from('frame-overlays')
        .getPublicUrl(filename);
      
      if (publicUrlData?.publicUrl) {
        finalOverlayUrl = publicUrlData.publicUrl;
        source = 'supabase-storage';
      }
    }

    // ============================================================
    // STEP 8: Update Template in Database
    // ============================================================
    console.log(`[generate-frame-overlay] Updating template in database`);
    const { error: updateError } = await adminClient
      .from('templates')
      .update({
        frame_overlay_url: finalOverlayUrl,
        theme_layers: themeLayerOutputs,
        vector_layers: vectorLayerOutputs,
        layers_json: rawLayers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId);

    if (updateError) {
      console.error(`[generate-frame-overlay] Database update failed:`, updateError.message);
      return new Response(
        JSON.stringify({ error: `Database update failed: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // STEP 9: Return Success Response
    // ============================================================
    console.log(`[generate-frame-overlay] Success!`);
    
    // Separate fonts by status for response
    const googleFonts = fontResults.filter(f => f.source === 'google').map(f => f.font);
    const customFontsNeedingUpload = fontResults.filter(f => f.source === 'supabase' && f.isNew).map(f => f.font);
    
    return new Response(
      JSON.stringify({
        success: true,
        frameOverlayUrl: finalOverlayUrl,
        source,
        templateId,
        templatedId,
        stats: {
          slotLayers: slotLayers.length,
          themeLayers: themeLayerOutputs.length,
          vectorLayers: vectorLayerOutputs.length,
          staticLayers: staticLayers.length,
        },
        fonts: {
          total: fontFamilies.size,
          googleFonts,
          customFontsNeedingUpload,
          allFonts: fontResults,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-frame-overlay] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
