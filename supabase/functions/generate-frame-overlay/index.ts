import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * Generate Frame Overlay Edge Function
 * 
 * Generates a transparent PNG frame overlay for a template by:
 * 1. Calling Templated.io with transparent=true
 * 2. Extracting ALL shape/text/vector layers for client-side rendering with z-index
 * 3. Uploading the result to Supabase Storage
 * 4. Updating the template's frame_overlay_url and theme_layers
 * 
 * This enables client-side compositing for:
 * - Instant background color changes without API calls
 * - Theme color customization (layers prefixed with 'theme-')
 * - Correct z-index layering between photos and other elements
 * 
 * ============================================================
 * LAYER NAMING CONVENTION (Only TWO patterns matter!)
 * ============================================================
 * 
 * 1. 'slot-*': Photo placeholder (hidden, app renders user photo)
 *    Examples: slot-before, slot-after-image
 * 
 * 2. 'theme-*': Color customizable (extracted, theme color applied)
 *    Examples: theme-before-label, theme-arrow-circle
 * 
 * All other layers are handled automatically by TYPE:
 * - shape/text/vector → Extracted with original colors + z-index
 * - image → Stays in frame overlay PNG (blur shadows, etc.)
 * 
 * NO hardcoded layer names! Any shape/text/vector layer automatically
 * gets correct z-index without special naming conventions.
 * ============================================================
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
  // Opacity from 0.0 to 1.0 (preserves original layer opacity from Templated.io)
  opacity?: number;
  // Fill color from Templated.io (can include RGBA with embedded opacity)
  fill?: string;
  // Stroke/border color
  stroke?: string;
  // Stroke width for borders
  strokeWidth?: number;
  // Discriminator for layer type
  type: 'shape' | 'text';
  // Shape-specific properties
  borderRadius?: number;
  // Shape variant (rectangle, ellipse, circle, custom)
  shapeType?: 'rectangle' | 'ellipse' | 'circle' | 'custom';
  // Text-specific properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  letterSpacing?: number;
  // Text color (separate from fill for text layers)
  color?: string;
}

// Vector layer geometry - for rendering icons/shapes with SVG
interface VectorLayerGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  // SVG viewBox (e.g., "0 0 448 512")
  viewBox: string;
  // SVG path 'd' attribute
  pathData: string;
  // Fill color (hex or rgb format)
  fill: string;
  // Whether this vector should change with theme color
  isThemed?: boolean;
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
  // Opacity from Templated.io (0.0 to 1.0, or null if not set)
  opacity?: number | null;
  // Fill color - can be hex, rgb(), or rgba() format
  fill?: string | null;
  // Stroke/border color
  stroke?: string | null;
  // Color property (used for text color)
  color?: string | null;
  // HTML SVG content (contains border radius, shape type info)
  html?: string | null;
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
    
    // IMPORTANT: Fetch layers directly from Templated.io /layers endpoint to get ALL layers with CURRENT names
    // This ensures we always use the latest layer names from Templated.io, not stale database data
    // MUST use /layers endpoint (not /template/{id}) to get fresh layer data with all properties
    // Include locked layers to ensure we get everything
    try {
      const templateInfoUrl = `https://api.templated.io/v1/template/${templatedId}/layers?includeLockedLayers=true&_t=${Date.now()}`;
      console.log(`[generate-frame-overlay] Fetching layers from Templated.io /layers endpoint: ${templateInfoUrl}`);
      
      const templateInfoResponse = await fetch(templateInfoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${templatedApiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (templateInfoResponse.ok) {
        const templateInfo = await templateInfoResponse.json();
        
        // /layers endpoint may return layers directly as array or nested inside object
        let freshLayers: TemplatedLayer[] = [];
        if (Array.isArray(templateInfo)) {
          // Direct array response
          freshLayers = templateInfo;
        } else if (templateInfo.layers && Array.isArray(templateInfo.layers)) {
          // Nested in "layers" property
          freshLayers = templateInfo.layers;
        }
        
        if (freshLayers.length > 0) {
          console.log(`[generate-frame-overlay] Got ${freshLayers.length} fresh layers from Templated.io /layers endpoint`);
          console.log(`[generate-frame-overlay] Layer names from API: ${freshLayers.map((l: TemplatedLayer) => l.layer).join(', ')}`);
          
          // Log specific properties for debugging
          const slotLayers = freshLayers.filter(l => l.layer.toLowerCase().includes('slot'));
          const themeLayers = freshLayers.filter(l => l.layer.toLowerCase().startsWith('theme-'));
          console.log(`[generate-frame-overlay] Detected ${slotLayers.length} slot layers: ${slotLayers.map(l => l.layer).join(', ')}`);
          console.log(`[generate-frame-overlay] Detected ${themeLayers.length} theme layers`);
          
          // Log opacity values for theme layers
          themeLayers.forEach(l => {
            console.log(`[generate-frame-overlay]   ${l.layer}: fill=${l.fill}, opacity=${l.opacity}`);
          });
          
          // IMPORTANT: Use fresh layers from Templated.io API instead of potentially stale database data
          // This ensures renamed layers (e.g., "before-image" → "slot-before-image") are detected correctly
          // AND ensures opacity property is correctly captured (not just RGBA embedded opacity)
          layersJson = freshLayers;
          console.log(`[generate-frame-overlay] Using ${layersJson.length} fresh layers from Templated.io API`);
          
          // Get canvas dimensions for detecting full-canvas background layers
          // Note: /layers endpoint doesn't return canvas dimensions, use defaults or fetch from main endpoint
          const canvasWidth = 1080;
          const canvasHeight = 1920;
          console.log(`[generate-frame-overlay] Canvas dimensions: ${canvasWidth}x${canvasHeight}`);
          
          // Identify layers that are likely backgrounds (cover entire canvas)
          const bgFromTemplated = freshLayers.filter((l: TemplatedLayer) => {
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
            
            // Mark auto-detected background layers
            bgFromTemplated.forEach((bgLayer: TemplatedLayer) => {
              const idx = layersJson.findIndex(l => l.layer === bgLayer.layer);
              if (idx >= 0) {
                (layersJson[idx] as TemplatedLayer & { _autoDetectedBg?: boolean })._autoDetectedBg = true;
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
    // IMPORTANT: Preserve original index for z-order (higher index = in front)
    type LayerWithIndex = TemplatedLayer & { _originalIndex: number };
    
    const slotLayers: LayerWithIndex[] = [];
    const themeLayers: LayerWithIndex[] = [];
    const vectorLayers: LayerWithIndex[] = [];
    const otherLayers: LayerWithIndex[] = [];

    // Background layers to hide (for transparent background support)
    const bgLayers: LayerWithIndex[] = [];
    
    for (let i = 0; i < layersJson.length; i++) {
      const layer = layersJson[i];
      const layerWithIndex: LayerWithIndex = { ...layer, _originalIndex: i };
      const layerName = (layer.layer || '').toLowerCase();
      const isAutoDetectedBg = (layer as TemplatedLayer & { _autoDetectedBg?: boolean })._autoDetectedBg;
      
      // ========================================================
      // LAYER CATEGORIZATION - TYPE-BASED (NO HARDCODED NAMES)
      // ========================================================
      // Only TWO naming conventions matter:
      //   1. 'slot-*' → Photo placeholder (hidden, app renders user photo)
      //   2. 'theme-*' → Color customizable (extracted, theme color applied)
      // All other shape/text/vector layers → Extracted with original colors + z-index
      // Image layers → Stay in frame overlay (blur shadows, etc.)
      // ========================================================
      
      if (isAutoDetectedBg || layerName.startsWith('bg-') || 
          layerName.startsWith('background-') || layerName === 'background') {
        // Background layers: hidden to allow dynamic background colors
        bgLayers.push(layerWithIndex);
      } 
      else if (layerName.includes('slot')) {
        // Slot layers: photo placeholders (hidden, app renders user photos)
        slotLayers.push(layerWithIndex);
      } 
      else if (layerName.startsWith('theme-')) {
        // Theme layers: color-customizable shapes/text (theme color applied)
        themeLayers.push(layerWithIndex);
      } 
      else if (layer.type === 'shape' || layer.type === 'text' || layer.type === 'vector') {
        // ALL shape/text/vector layers get extracted for z-index control
        // These keep their original colors and respect layer order
        // This automatically handles: card backgrounds, decorations, icons, labels, etc.
        themeLayers.push(layerWithIndex);
      } 
      else {
        // Only image-type layers (blur shadows with S3 URLs) stay in frame overlay
        // These are baked into the PNG at z=0
        otherLayers.push(layerWithIndex);
      }
    }
    
    console.log(`[generate-frame-overlay] Layer z-indices:`);
    console.log(`  - Slot layers: ${slotLayers.map(l => `${l.layer}@z${l._originalIndex + 1}`).join(', ')}`);
    console.log(`  - Theme layers: ${themeLayers.map(l => `${l.layer}@z${l._originalIndex + 1}`).join(', ')}`);
    console.log(`  - Vector layers: ${vectorLayers.map(l => `${l.layer}@z${l._originalIndex + 1}`).join(', ')}`);

    // Count text vs shape theme layers
    const textThemeLayers = themeLayers.filter(l => l.type === 'text');
    const shapeThemeLayers = themeLayers.filter(l => l.type !== 'text');

    console.log(`[generate-frame-overlay] Layer categorization:`);
    console.log(`  - Slot layers (hidden, photos): ${slotLayers.length} - ${slotLayers.map(l => l.layer).join(', ')}`);
    console.log(`  - Theme layers (hidden, rendered by app): ${themeLayers.length}`);
    console.log(`    - Text layers: ${textThemeLayers.length} - ${textThemeLayers.map(l => l.layer).join(', ')}`);
    console.log(`    - Shape layers: ${shapeThemeLayers.length} - ${shapeThemeLayers.map(l => l.layer).join(', ')}`);
    console.log(`  - Vector layers (extracted, rendered by app): ${vectorLayers.length} - ${vectorLayers.map(l => l.layer).join(', ')}`);
    console.log(`  - Background layers (hidden, transparent): ${bgLayers.length} - ${bgLayers.map(l => l.layer).join(', ')}`);
    console.log(`  - Other layers (in overlay, includes card frames): ${otherLayers.length} - ${otherLayers.map(l => l.layer).join(', ')}`);

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
    
    /**
     * Parse RGBA color string and extract opacity
     * Returns { color: normalized hex/rgb, opacity: 0-1 }
     * Handles: rgba(r,g,b,a), rgb(r,g,b), #hex
     */
    const parseColorAndOpacity = (colorStr: string | null | undefined): { color: string | null; opacity: number } => {
      if (!colorStr) return { color: null, opacity: 1.0 };
      
      // Check for rgba format: rgba(48,48,48,0.08)
      const rgbaMatch = colorStr.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
      if (rgbaMatch) {
        const [, r, g, b, a] = rgbaMatch;
        const opacity = parseFloat(a);
        // Convert to hex for easier handling
        const hex = `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`;
        return { color: hex.toUpperCase(), opacity };
      }
      
      // Check for rgb format: rgb(48, 48, 48)
      const rgbMatch = colorStr.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (rgbMatch) {
        const [, r, g, b] = rgbMatch;
        const hex = `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`;
        return { color: hex.toUpperCase(), opacity: 1.0 };
      }
      
      // Already hex or other format
      return { color: colorStr, opacity: 1.0 };
    };
    
    /**
     * Extract border radius from HTML SVG content
     * Looks for rx="X" ry="Y" attributes in rect elements
     */
    const extractBorderRadiusFromHtml = (html: string | null | undefined): number => {
      if (!html) return 0;
      
      // Look for rx="18" or ry="18" pattern in SVG rect
      const rxMatch = html.match(/rx\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
      if (rxMatch) {
        return parseFloat(rxMatch[1]);
      }
      
      return 0;
    };
    
    /**
     * Detect shape type from HTML SVG content
     * Returns: 'rectangle' | 'ellipse' | 'circle' | 'custom'
     */
    const detectShapeTypeFromHtml = (html: string | null | undefined): 'rectangle' | 'ellipse' | 'circle' | 'custom' => {
      if (!html) return 'rectangle';
      
      if (html.includes('<ellipse')) {
        // Check if it's a circle (rx == ry or equal width/height)
        const rxMatch = html.match(/rx\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
        const ryMatch = html.match(/ry\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
        if (rxMatch && ryMatch && rxMatch[1] === ryMatch[1]) {
          return 'circle';
        }
        return 'ellipse';
      }
      
      if (html.includes('<rect')) {
        return 'rectangle';
      }
      
      if (html.includes('<path')) {
        return 'custom';
      }
      
      return 'rectangle';
    };

    // Extract theme layer geometries for client-side rendering
    // Now supports both shape (rectangles) and text layers with full styling
    const themeLayerGeometries: ThemeLayerGeometry[] = themeLayers.map(layer => {
      // Parse fill color - may contain embedded opacity (e.g., rgba(48,48,48,0.08))
      const fillParsed = parseColorAndOpacity(layer.fill);
      const strokeParsed = parseColorAndOpacity(layer.stroke);
      
      // Extract border radius from HTML SVG if not directly specified
      const borderRadiusFromHtml = extractBorderRadiusFromHtml(layer.html);
      const borderRadius = layer.border_radius || borderRadiusFromHtml;
      
      // Detect shape type from SVG HTML
      const shapeType = detectShapeTypeFromHtml(layer.html);
      
      // Determine final opacity:
      // 1. Use explicit opacity property if set
      // 2. Otherwise, use opacity from RGBA fill color
      // 3. Default to 1.0
      const finalOpacity = layer.opacity ?? fillParsed.opacity ?? 1.0;
      
      // Base geometry shared by all layer types
      // zIndex is originalIndex + 1 (higher = in front, matching Templated.io layer order)
      const base = {
        id: layer.layer,
        x: layer.x || 0,
        y: layer.y || 0,
        width: layer.width || 0,
        height: layer.height || 0,
        zIndex: (layer as LayerWithIndex)._originalIndex + 1,
        rotation: layer.rotation || 0,
        opacity: finalOpacity,
        fill: fillParsed.color,
        stroke: strokeParsed.color,
        strokeWidth: layer.stroke ? 1 : undefined, // Default stroke width if stroke color exists
      };
      
      // Check if this is a text layer
      if (layer.type === 'text') {
        // For text, parse color property separately (text color)
        const textColorParsed = parseColorAndOpacity(layer.color);
        
        console.log(`[generate-frame-overlay] Text layer found: ${layer.layer}`);
        console.log(`  - text: "${layer.text}"`);
        console.log(`  - font: ${layer.font_family}, size: ${layer.font_size}, weight: ${layer.font_weight}`);
        console.log(`  - color: ${layer.color} -> ${textColorParsed.color}`);
        console.log(`  - opacity: ${finalOpacity}`);
        
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
          color: textColorParsed.color, // Original text color
        };
      }
      
      // Shape layer
      console.log(`[generate-frame-overlay] Shape layer found: ${layer.layer}`);
      console.log(`  - fill: ${layer.fill} -> color: ${fillParsed.color}, opacity: ${fillParsed.opacity}`);
      console.log(`  - stroke: ${layer.stroke} -> ${strokeParsed.color}`);
      console.log(`  - borderRadius: ${borderRadius} (from property: ${layer.border_radius}, from HTML: ${borderRadiusFromHtml})`);
      console.log(`  - shapeType: ${shapeType}`);
      console.log(`  - final opacity: ${finalOpacity}`);
      
      // For custom shapes (like heart-icon), extract SVG path data from HTML
      // This allows rendering as SVG instead of simple rectangle
      let viewBox: string | undefined;
      let pathData: string | undefined;
      
      if (shapeType === 'custom' && layer.html) {
        // Extract viewBox from SVG
        const viewBoxMatch = layer.html.match(/viewBox\s*=\s*["']([^"']+)["']/i);
        viewBox = viewBoxMatch ? viewBoxMatch[1] : undefined;
        
        // Extract path 'd' attribute from SVG
        const pathMatch = layer.html.match(/<path[^>]*\sd\s*=\s*["']([^"']+)["']/i);
        pathData = pathMatch ? pathMatch[1] : undefined;
        
        console.log(`  - custom shape SVG: viewBox=${viewBox}, pathData length=${pathData?.length || 0}`);
      }
      
      return {
        ...base,
        type: 'shape' as const,
        borderRadius,
        shapeType,
        ...(viewBox && { viewBox }),
        ...(pathData && { pathData }),
      };
    });

    console.log(`[generate-frame-overlay] Theme layer geometries:`, JSON.stringify(themeLayerGeometries, null, 2));

    /**
     * Extract SVG viewBox from HTML
     * Returns the viewBox attribute value (e.g., "0 0 448 512")
     */
    const extractViewBox = (html: string | null | undefined): string => {
      if (!html) return '0 0 24 24'; // Default viewBox
      
      const viewBoxMatch = html.match(/viewBox\s*=\s*["']([^"']+)["']/i);
      return viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';
    };

    /**
     * Extract SVG path 'd' attribute from HTML
     * Returns the path data string
     */
    const extractPathData = (html: string | null | undefined): string => {
      if (!html) return '';
      
      // Look for <path d="..." ...> pattern
      const pathMatch = html.match(/<path[^>]*\sd\s*=\s*["']([^"']+)["']/i);
      return pathMatch ? pathMatch[1] : '';
    };

    /**
     * Extract fill color from SVG path or HTML
     * Returns hex or rgb color string
     */
    const extractSvgFill = (html: string | null | undefined): string => {
      if (!html) return '#FFFFFF'; // Default white
      
      // Look for fill="rgb(...)" or fill="#..."
      const fillMatch = html.match(/fill\s*=\s*["']([^"']+)["']/i);
      if (fillMatch) {
        const fillValue = fillMatch[1];
        // Convert rgb(r,g,b) to hex if needed
        const rgbMatch = fillValue.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
        if (rgbMatch) {
          const [, r, g, b] = rgbMatch;
          return `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`.toUpperCase();
        }
        return fillValue;
      }
      return '#FFFFFF';
    };

    // Extract vector layer geometries for client-side rendering with react-native-svg
    const vectorLayerGeometries: VectorLayerGeometry[] = vectorLayers.map(layer => {
      const viewBox = extractViewBox(layer.html);
      const pathData = extractPathData(layer.html);
      const fill = extractSvgFill(layer.html);
      // zIndex is originalIndex + 1 (higher = in front)
      const zIndex = (layer as LayerWithIndex)._originalIndex + 1;
      
      console.log(`[generate-frame-overlay] Vector layer found: ${layer.layer}`);
      console.log(`  - position: (${layer.x}, ${layer.y}) size: ${layer.width}x${layer.height}`);
      console.log(`  - rotation: ${layer.rotation ?? 0}°`);
      console.log(`  - zIndex: ${zIndex}`);
      console.log(`  - viewBox: ${viewBox}`);
      console.log(`  - pathData length: ${pathData.length} chars`);
      console.log(`  - fill: ${fill}`);
      
      return {
        id: layer.layer,
        x: layer.x || 0,
        y: layer.y || 0,
        width: layer.width || 0,
        height: layer.height || 0,
        zIndex,
        rotation: layer.rotation || 0,
        opacity: layer.opacity ?? 1.0,
        viewBox,
        pathData,
        fill,
        isThemed: false, // Vectors are not themed by default (white arrows stay white)
      };
    });

    console.log(`[generate-frame-overlay] Vector layer geometries:`, JSON.stringify(vectorLayerGeometries, null, 2));

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
    
    // Hide vector layers (icons/arrows - rendered by app with react-native-svg)
    vectorLayers.forEach((layer) => {
      hiddenLayers[layer.layer] = { hide: true };
    });
    
    // Hide background layers (allows dynamic background color changes)
    bgLayers.forEach((layer) => {
      hiddenLayers[layer.layer] = { hide: true };
    });
    
    // NOTE: Card background layers (before-card-background, after-card-background-main) are NOT hidden
    // They ARE the visual frame around photos and should remain visible in the overlay
    
    // IMPORTANT: Always hide common MAIN background layer names, even if not in layers_json
    // This handles templates where the background layer wasn't explicitly synced
    // Only include names that are clearly main canvas backgrounds (not content cards)
    const commonBgLayerNames = [
      // Exact matches for common background names
      'background', 'Background', 'BACKGROUND',
      'bg', 'BG', 'Bg',
      // Prefix-based background names
      'bg-background', 'bg-main', 'bg-color', 'bg-fill',
      'background-main', 'background-color', 'background-fill',
      // Canvas backgrounds
      'canvas_background', 'canvas-background',
      'main_background', 'main-background',
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

    // Update template with frame_overlay_url, theme_layers, vector_layers, and fresh layers_json
    // The layers_json is updated to ensure layer names are synced from Templated.io
    console.log(`[generate-frame-overlay] Updating template ${templateId} with frame_overlay_url, theme_layers, vector_layers, and fresh layers_json`);
    const { error: updateError } = await adminClient
      .from('templates')
      .update({
        frame_overlay_url: finalOverlayUrl,
        theme_layers: themeLayerGeometries,
        vector_layers: vectorLayerGeometries,
        layers_json: layersJson, // Update with fresh layer data from Templated.io API
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
    console.log(`[generate-frame-overlay] Vector layers saved: ${vectorLayerGeometries.length}`);

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
        vectorLayers: vectorLayerGeometries,
        vectorLayerCount: vectorLayerGeometries.length,
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
