import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * Generate Thumbnail Edge Function
 * 
 * Generates a template thumbnail with default background and theme colors baked in.
 * Unlike generate-frame-overlay (which creates transparent PNGs for compositing),
 * this function creates the final visual thumbnail shown in the Create tab.
 * 
 * Key differences from generate-frame-overlay:
 * - Does NOT use transparent: true (we want the full render with background)
 * - Does NOT hide background/theme layers
 * - APPLIES default_background_color to background layers
 * - APPLIES default_theme_color to theme layers
 * - Slot layers keep their placeholder images
 * 
 * Layer Naming Convention:
 * - 'slot-*': Photo placeholder layers (keep default placeholder images)
 * - 'theme-*': Theme-colored layers (apply default_theme_color)
 * - 'bg-*', 'background-*', '*-background*': Background layers (apply default_background_color)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATED_API_URL = 'https://api.templated.io/v1/render';

interface ThumbnailRequest {
  /** Template ID (UUID) - can use snake_case or camelCase */
  template_id?: string;
  templateId?: string;
  /** Generate thumbnails for all templates */
  generate_all?: boolean;
}

interface TemplatedLayer {
  layer: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number | null;
  fill?: string | null;
  stroke?: string | null;
  color?: string | null;
  html?: string | null;
  text?: string;
  image_url?: string;
  [key: string]: unknown;
}

interface TemplateData {
  id: string;
  templated_id: string;
  name: string;
  layers_json: TemplatedLayer[] | null;
  default_background_color: string | null;
  default_theme_color: string | null;
  canvas_width: number;
  canvas_height: number;
}

/**
 * Generate thumbnail for a single template
 */
async function generateThumbnailForTemplate(
  template: TemplateData,
  templatedApiKey: string,
  adminClient: ReturnType<typeof createClient>
): Promise<{ success: boolean; url?: string; error?: string }> {
  const { id: templateId, templated_id: templatedId, name, default_background_color, default_theme_color } = template;
  
  console.log(`[generate-thumbnail] Processing template: ${name} (${templateId})`);
  console.log(`[generate-thumbnail] Templated ID: ${templatedId}`);
  console.log(`[generate-thumbnail] Default BG color: ${default_background_color || 'not set'}`);
  console.log(`[generate-thumbnail] Default theme color: ${default_theme_color || 'not set'}`);

  // Fetch fresh layers from Templated.io API
  let layersJson: TemplatedLayer[] = template.layers_json || [];
  
  try {
    const templateInfoUrl = `https://api.templated.io/v1/template/${templatedId}/layers?includeLockedLayers=true&_t=${Date.now()}`;
    console.log(`[generate-thumbnail] Fetching layers from Templated.io: ${templateInfoUrl}`);
    
    const templateInfoResponse = await fetch(templateInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${templatedApiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (templateInfoResponse.ok) {
      const templateInfo = await templateInfoResponse.json();
      
      let freshLayers: TemplatedLayer[] = [];
      if (Array.isArray(templateInfo)) {
        freshLayers = templateInfo;
      } else if (templateInfo.layers && Array.isArray(templateInfo.layers)) {
        freshLayers = templateInfo.layers;
      }
      
      if (freshLayers.length > 0) {
        console.log(`[generate-thumbnail] Got ${freshLayers.length} fresh layers from API`);
        layersJson = freshLayers;
      }
    } else {
      console.log(`[generate-thumbnail] Could not fetch layers (${templateInfoResponse.status}), using database layers`);
    }
  } catch (fetchErr) {
    console.log(`[generate-thumbnail] Error fetching layers: ${fetchErr}, using database layers`);
  }

  // Categorize layers and build the render payload
  const layerPayload: Record<string, Record<string, unknown>> = {};
  
  // Use default colors or fallbacks
  const bgColor = default_background_color || '#FFFFFF';
  const themeColor = default_theme_color || '#303030';
  
  console.log(`[generate-thumbnail] Applying colors - BG: ${bgColor}, Theme: ${themeColor}`);
  
  for (const layer of layersJson) {
    const layerName = (layer.layer || '').toLowerCase();
    
    // Check if this is a theme layer (starts with 'theme-')
    if (layerName.startsWith('theme-')) {
      console.log(`[generate-thumbnail] Theme layer: ${layer.layer} -> fill: ${themeColor}`);
      layerPayload[layer.layer] = { fill: themeColor };
    }
    // Check if this is a background layer
    else if (
      layerName.startsWith('bg-') || 
      layerName.startsWith('background-') || 
      layerName === 'background' ||
      layerName.includes('-background') ||
      layerName.includes('-card-background')
    ) {
      // Only apply background color to shape layers, not images
      if (layer.type === 'shape' || layer.type === 'rectangle') {
        console.log(`[generate-thumbnail] Background layer: ${layer.layer} -> fill: ${bgColor}`);
        layerPayload[layer.layer] = { fill: bgColor };
      }
    }
    // Slot layers - keep their default placeholder images (don't override)
    // Other layers - render as-is from template
  }
  
  console.log(`[generate-thumbnail] Layer payload keys:`, Object.keys(layerPayload));

  // Call Templated.io API - render with colors applied, NOT transparent
  const renderPayload = {
    template: templatedId,
    format: 'png',
    // Note: NOT using transparent: true - we want the full render with background
    layers: layerPayload,
  };
  
  console.log(`[generate-thumbnail] API payload:`, JSON.stringify(renderPayload));
  
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
    console.error(`[generate-thumbnail] Templated.io API error: ${renderResponse.status} - ${errorText}`);
    return { success: false, error: `Templated.io API error: ${renderResponse.status}` };
  }

  const renderResult = await renderResponse.json();
  const renderUrl = renderResult.render_url;

  if (!renderUrl) {
    console.error('[generate-thumbnail] No render_url in response');
    return { success: false, error: 'No render URL returned from Templated.io' };
  }

  console.log(`[generate-thumbnail] Render URL received: ${renderUrl}`);

  // Download the rendered PNG
  console.log(`[generate-thumbnail] Downloading rendered PNG...`);
  const imageResponse = await fetch(renderUrl);
  if (!imageResponse.ok) {
    console.error(`[generate-thumbnail] Failed to download image: ${imageResponse.status}`);
    return { success: false, error: 'Failed to download rendered image' };
  }

  const imageArrayBuffer = await imageResponse.arrayBuffer();
  const imageData = new Uint8Array(imageArrayBuffer);

  // Generate filename
  const filename = `${templatedId}-thumbnail.png`;

  // Upload to Supabase Storage (thumbnails bucket)
  console.log(`[generate-thumbnail] Uploading to Supabase Storage: ${filename}`);
  const { error: uploadError } = await adminClient.storage
    .from('thumbnails')
    .upload(filename, imageData, {
      contentType: 'image/png',
      upsert: true,
    });

  let finalThumbnailUrl = renderUrl;
  let source = 'templated.io';

  if (uploadError) {
    console.warn(`[generate-thumbnail] Storage upload failed, using Templated.io URL:`, uploadError.message);
    // Continue with Templated.io URL as fallback
  } else {
    // Get public URL
    const { data: publicUrlData } = adminClient.storage
      .from('thumbnails')
      .getPublicUrl(filename);
    
    if (publicUrlData?.publicUrl) {
      finalThumbnailUrl = publicUrlData.publicUrl;
      source = 'supabase-storage';
      console.log(`[generate-thumbnail] Uploaded to Supabase Storage: ${finalThumbnailUrl}`);
    }
  }

  // Update template with new thumbnail URL
  console.log(`[generate-thumbnail] Updating template ${templateId} with thumbnail URL`);
  const { error: updateError } = await adminClient
    .from('templates')
    .update({
      thumbnail: finalThumbnailUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId);

  if (updateError) {
    console.error(`[generate-thumbnail] Failed to update template:`, updateError.message);
    return { success: false, error: `Failed to update template: ${updateError.message}` };
  }

  console.log(`[generate-thumbnail] Success! Template ${name} thumbnail updated from ${source}`);
  
  return { success: true, url: finalThumbnailUrl };
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
      console.error('[generate-thumbnail] TEMPLATED_API_KEY not configured');
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
    const body: ThumbnailRequest = await req.json();
    const templateId = body.template_id || body.templateId;
    const generateAll = body.generate_all;

    // Validate: either template_id or generate_all must be provided
    if (!templateId && !generateAll) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: template_id or generate_all' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle batch processing
    if (generateAll) {
      console.log('[generate-thumbnail] Batch mode: generating thumbnails for all templates');
      
      const { data: templates, error: fetchError } = await adminClient
        .from('templates')
        .select('id, templated_id, name, layers_json, default_background_color, default_theme_color, canvas_width, canvas_height')
        .not('templated_id', 'is', null)
        .eq('is_active', true);

      if (fetchError) {
        console.error('[generate-thumbnail] Failed to fetch templates:', fetchError.message);
        return new Response(
          JSON.stringify({ error: `Failed to fetch templates: ${fetchError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results: { templateId: string; name: string; success: boolean; url?: string; error?: string }[] = [];
      
      for (const template of templates || []) {
        const result = await generateThumbnailForTemplate(
          template as TemplateData,
          templatedApiKey,
          adminClient
        );
        results.push({
          templateId: template.id,
          name: template.name,
          ...result,
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      console.log(`[generate-thumbnail] Batch complete: ${successCount} success, ${failCount} failed`);

      return new Response(
        JSON.stringify({
          success: true,
          batch: true,
          totalProcessed: results.length,
          successCount,
          failCount,
          results,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single template processing
    console.log(`[generate-thumbnail] Fetching template: ${templateId}`);
    const { data: template, error: fetchError } = await adminClient
      .from('templates')
      .select('id, templated_id, name, layers_json, default_background_color, default_theme_color, canvas_width, canvas_height')
      .eq('id', templateId)
      .single();

    if (fetchError || !template) {
      console.error('[generate-thumbnail] Template not found:', fetchError?.message);
      return new Response(
        JSON.stringify({ error: `Template not found: ${templateId}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!template.templated_id) {
      return new Response(
        JSON.stringify({ error: 'Template does not have a Templated.io ID configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await generateThumbnailForTemplate(
      template as TemplateData,
      templatedApiKey,
      adminClient
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: result.url,
        thumbnailUrl: result.url,
        templateId,
        templatedId: template.templated_id,
        templateName: template.name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-thumbnail] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
