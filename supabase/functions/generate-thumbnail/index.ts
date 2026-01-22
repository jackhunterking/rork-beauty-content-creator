import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * Generate Thumbnail Edge Function (Simplified)
 * 
 * Generates a template thumbnail by rendering the template exactly as designed
 * in Templated.io - no layer modifications, no color overrides.
 * 
 * This is the simplest and safest approach:
 * - Renders template with all original colors and designs
 * - No transparent background
 * - No layer hiding or color modifications
 * - Thumbnail matches exactly what the designer created
 * 
 * For more complex thumbnail needs, use templated_preview_url from template sync.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATED_API_URL = 'https://api.templated.io/v1/render';

interface ThumbnailRequest {
  template_id?: string;
  templateId?: string;
  generate_all?: boolean;
}

interface TemplateData {
  id: string;
  templated_id: string;
  name: string;
}

/**
 * Generate thumbnail for a single template - simple render, no modifications
 */
async function generateThumbnailForTemplate(
  template: TemplateData,
  templatedApiKey: string,
  adminClient: ReturnType<typeof createClient>
): Promise<{ success: boolean; url?: string; error?: string }> {
  const { id: templateId, templated_id: templatedId, name } = template;
  
  console.log(`[generate-thumbnail] Processing: ${name} (${templateId})`);

  // Simple render - template exactly as designed, no modifications
  const renderPayload = {
    template: templatedId,
    format: 'png',
    // No transparent, no layers modifications
    // Renders exactly as designed in Templated.io
  };
  
  console.log(`[generate-thumbnail] Calling Templated.io render API`);
  
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
    console.error(`[generate-thumbnail] Templated.io error: ${renderResponse.status}`);
    return { success: false, error: `Templated.io API error: ${renderResponse.status}` };
  }

  const renderResult = await renderResponse.json();
  const renderUrl = renderResult.render_url;

  if (!renderUrl) {
    return { success: false, error: 'No render URL returned' };
  }

  console.log(`[generate-thumbnail] Render URL: ${renderUrl}`);

  // Download the rendered PNG
  const imageResponse = await fetch(renderUrl);
  if (!imageResponse.ok) {
    return { success: false, error: 'Failed to download rendered image' };
  }

  const imageData = new Uint8Array(await imageResponse.arrayBuffer());
  const filename = `${templatedId}-thumbnail.png`;

  // Upload to Supabase Storage
  console.log(`[generate-thumbnail] Uploading to storage: ${filename}`);
  const { error: uploadError } = await adminClient.storage
    .from('thumbnails')
    .upload(filename, imageData, {
      contentType: 'image/png',
      upsert: true,
    });

  let finalThumbnailUrl = renderUrl;

  if (!uploadError) {
    const { data: publicUrlData } = adminClient.storage
      .from('thumbnails')
      .getPublicUrl(filename);
    
    if (publicUrlData?.publicUrl) {
      finalThumbnailUrl = publicUrlData.publicUrl;
    }
  }

  // Update template with thumbnail URL
  const { error: updateError } = await adminClient
    .from('templates')
    .update({
      thumbnail: finalThumbnailUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId);

  if (updateError) {
    return { success: false, error: `Database update failed: ${updateError.message}` };
  }

  console.log(`[generate-thumbnail] Success! ${name}`);
  return { success: true, url: finalThumbnailUrl };
}

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
    const templatedApiKey = Deno.env.get('TEMPLATED_API_KEY');
    if (!templatedApiKey) {
      return new Response(
        JSON.stringify({ error: 'Templated.io API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body: ThumbnailRequest = await req.json();
    const templateId = body.template_id || body.templateId;
    const generateAll = body.generate_all;

    if (!templateId && !generateAll) {
      return new Response(
        JSON.stringify({ error: 'Missing: template_id or generate_all' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Batch processing
    if (generateAll) {
      console.log('[generate-thumbnail] Batch mode');
      
      const { data: templates, error: fetchError } = await adminClient
        .from('templates')
        .select('id, templated_id, name')
        .not('templated_id', 'is', null)
        .eq('is_active', true);

      if (fetchError) {
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
        results.push({ templateId: template.id, name: template.name, ...result });
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

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
    const { data: template, error: fetchError } = await adminClient
      .from('templates')
      .select('id, templated_id, name')
      .eq('id', templateId)
      .single();

    if (fetchError || !template) {
      return new Response(
        JSON.stringify({ error: `Template not found: ${templateId}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!template.templated_id) {
      return new Response(
        JSON.stringify({ error: 'Template has no Templated.io ID' }),
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
        thumbnailUrl: result.url,
        templateId,
        templatedId: template.templated_id,
        templateName: template.name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-thumbnail] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
