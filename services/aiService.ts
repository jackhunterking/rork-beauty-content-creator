/**
 * AI Service
 * 
 * Client-side service for AI image enhancement features.
 * Communicates with Supabase Edge Functions for:
 * - Feature configuration
 * - Credit management
 * - Image enhancement processing
 */

import { supabase, SUPABASE_URL } from '@/lib/supabase';
import type {
  AIFeatureKey,
  AIModelConfig,
  AIModelConfigRow,
  AICredits,
  AIGeneration,
  AIGenerationRow,
  BackgroundPreset,
  BackgroundPresetRow,
  GroupedBackgroundPresets,
  AIEnhanceRequest,
  AIEnhanceResponse,
  AIFeatureCheck,
  AIConfigResponse,
  AIPresetsResponse,
} from '@/types';

// ============================================
// Edge Function URLs
// ============================================

const EDGE_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;

const ENDPOINTS = {
  enhance: `${EDGE_FUNCTION_BASE}/ai-enhance`,
  credits: `${EDGE_FUNCTION_BASE}/ai-credits`,
  config: `${EDGE_FUNCTION_BASE}/ai-config`,
} as const;

// ============================================
// Helper Functions
// ============================================

/**
 * Get authorization header for edge function calls
 */
async function getAuthHeader(): Promise<string | null> {
  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiService.ts:getAuthHeader:entry',message:'Getting auth header',data:{timestamp:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C,E'})}).catch(()=>{});
  // #endregion
  const { data: { session } } = await supabase.auth.getSession();
  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiService.ts:getAuthHeader:result',message:'Session check result',data:{hasSession:!!session,hasAccessToken:!!session?.access_token,tokenPrefix:session?.access_token?.substring(0,20)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C,E'})}).catch(()=>{});
  // #endregion
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

/**
 * Make authenticated request to edge function
 */
async function callEdgeFunction<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiService.ts:callEdgeFunction:entry',message:'Edge function call started',data:{url,method:options.method||'GET'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B'})}).catch(()=>{});
  // #endregion
  const authHeader = await getAuthHeader();
  
  if (!authHeader) {
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiService.ts:callEdgeFunction:noAuth',message:'No auth header - not authenticated',data:{url},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,D'})}).catch(()=>{});
    // #endregion
    throw new Error('Not authenticated');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      ...options.headers,
    },
  });

  const data = await response.json();

  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiService.ts:callEdgeFunction:response',message:'Edge function response',data:{url,status:response.status,ok:response.ok,errorMsg:data?.error},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

/**
 * Transform snake_case row to camelCase
 */
function transformConfigRow(row: AIModelConfigRow): AIModelConfig {
  return {
    featureKey: row.feature_key as AIFeatureKey,
    displayName: row.display_name,
    description: row.description || '',
    icon: row.icon,
    costCredits: row.cost_credits,
    isEnabled: row.is_enabled,
    isPremiumOnly: row.is_premium_only,
    sortOrder: row.sort_order,
  };
}

/**
 * Transform preset row to camelCase
 */
function transformPresetRow(row: BackgroundPresetRow): BackgroundPreset {
  return {
    id: row.id,
    name: row.name,
    category: row.category as BackgroundPreset['category'],
    previewUrl: row.preview_url || undefined,
    previewColor: row.preview_color || '#CCCCCC',
    isPremium: row.is_premium,
    sortOrder: row.sort_order,
  };
}

/**
 * Transform generation row to camelCase
 */
function transformGenerationRow(row: AIGenerationRow): AIGeneration {
  return {
    id: row.id,
    featureKey: row.feature_key as AIFeatureKey,
    status: row.status as AIGeneration['status'],
    inputImageUrl: row.input_image_url,
    outputImageUrl: row.output_image_url || undefined,
    creditsCharged: row.credits_charged,
    processingTimeMs: row.processing_time_ms || undefined,
    errorMessage: row.error_message || undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
  };
}

// ============================================
// Configuration Functions
// ============================================

/**
 * Fetch all enabled AI features
 * Results are cached for 5 minutes by the edge function
 */
export async function fetchAIConfig(): Promise<AIModelConfig[]> {
  try {
    const response = await callEdgeFunction<AIConfigResponse>(ENDPOINTS.config);
    return response.features;
  } catch (error) {
    console.error('[aiService] Error fetching AI config:', error);
    throw error;
  }
}

/**
 * Fetch background presets for background_replace feature
 */
export async function fetchBackgroundPresets(): Promise<{
  presets: BackgroundPreset[];
  grouped: GroupedBackgroundPresets;
}> {
  try {
    const response = await callEdgeFunction<AIPresetsResponse>(
      `${ENDPOINTS.config}/presets`
    );
    return response;
  } catch (error) {
    console.error('[aiService] Error fetching presets:', error);
    throw error;
  }
}

/**
 * Get a specific AI feature config
 */
export async function getFeatureConfig(featureKey: AIFeatureKey): Promise<AIModelConfig | null> {
  const configs = await fetchAIConfig();
  return configs.find(c => c.featureKey === featureKey) || null;
}

// ============================================
// Credit Functions
// ============================================

/**
 * Get current AI credit balance
 */
export async function getCredits(): Promise<AICredits> {
  try {
    const response = await callEdgeFunction<{
      credits_remaining: number;
      credits_used_this_period: number;
      monthly_allocation: number;
      period_end: string;
      days_until_reset: number;
    }>(ENDPOINTS.credits);

    return {
      creditsRemaining: response.credits_remaining,
      creditsUsedThisPeriod: response.credits_used_this_period,
      monthlyAllocation: response.monthly_allocation,
      periodEnd: response.period_end,
      daysUntilReset: response.days_until_reset,
    };
  } catch (error) {
    console.error('[aiService] Error fetching credits:', error);
    throw error;
  }
}

/**
 * Check if user has enough credits for a feature
 */
export async function checkCredits(featureKey: AIFeatureKey): Promise<AIFeatureCheck> {
  try {
    const response = await callEdgeFunction<{
      has_credits: boolean;
      credits_remaining: number;
      credits_required: number;
    }>(`${ENDPOINTS.credits}/check`, {
      method: 'POST',
      body: JSON.stringify({ feature_key: featureKey }),
    });

    return {
      hasCredits: response.has_credits,
      creditsRemaining: response.credits_remaining,
      creditsRequired: response.credits_required,
    };
  } catch (error) {
    console.error('[aiService] Error checking credits:', error);
    throw error;
  }
}

/**
 * Get generation history
 */
export async function getGenerationHistory(
  limit: number = 20,
  offset: number = 0
): Promise<AIGeneration[]> {
  try {
    const response = await callEdgeFunction<{
      generations: AIGenerationRow[];
    }>(`${ENDPOINTS.credits}/history`, {
      method: 'POST',
      body: JSON.stringify({ limit, offset }),
    });

    return response.generations.map(transformGenerationRow);
  } catch (error) {
    console.error('[aiService] Error fetching history:', error);
    throw error;
  }
}

// ============================================
// Enhancement Functions
// ============================================

/**
 * Process an image with AI enhancement
 * 
 * @param request - Enhancement request with image URL and feature
 * @returns Enhanced image URL and updated credits
 */
export async function enhanceImage(
  request: AIEnhanceRequest
): Promise<AIEnhanceResponse> {
  try {
    const response = await callEdgeFunction<{
      success: boolean;
      generation_id: string;
      output_url?: string;
      credits_charged: number;
      credits_remaining: number;
      processing_time_ms?: number;
      error?: string;
    }>(ENDPOINTS.enhance, {
      method: 'POST',
      body: JSON.stringify({
        feature_key: request.featureKey,
        image_url: request.imageUrl,
        draft_id: request.draftId,
        slot_id: request.slotId,
        preset_id: request.presetId,
        custom_prompt: request.customPrompt,
        params: request.params,
      }),
    });

    return {
      success: response.success,
      generationId: response.generation_id,
      outputUrl: response.output_url,
      creditsCharged: response.credits_charged,
      creditsRemaining: response.credits_remaining,
      processingTimeMs: response.processing_time_ms,
      error: response.error,
    };
  } catch (error: any) {
    console.error('[aiService] Enhancement error:', error);
    
    // Return structured error response
    return {
      success: false,
      generationId: '',
      creditsCharged: 0,
      creditsRemaining: 0,
      error: error.message || 'Enhancement failed',
    };
  }
}

/**
 * Convenience method: Enhance image quality
 * Uses creative-upscaler for quality improvement
 */
export async function enhanceQuality(
  imageUrl: string,
  draftId?: string,
  slotId?: string
): Promise<AIEnhanceResponse> {
  return enhanceImage({
    featureKey: 'auto_quality',
    imageUrl,
    draftId,
    slotId,
  });
}

/**
 * Convenience method: Remove background
 * Uses birefnet/v2 for transparent background
 */
export async function removeBackground(
  imageUrl: string,
  draftId?: string,
  slotId?: string
): Promise<AIEnhanceResponse> {
  return enhanceImage({
    featureKey: 'background_remove',
    imageUrl,
    draftId,
    slotId,
  });
}

/**
 * Convenience method: Replace background with preset
 */
export async function replaceBackgroundWithPreset(
  imageUrl: string,
  presetId: string,
  draftId?: string,
  slotId?: string
): Promise<AIEnhanceResponse> {
  return enhanceImage({
    featureKey: 'background_replace',
    imageUrl,
    draftId,
    slotId,
    presetId,
  });
}

/**
 * Convenience method: Replace background with custom prompt
 */
export async function replaceBackgroundWithPrompt(
  imageUrl: string,
  customPrompt: string,
  draftId?: string,
  slotId?: string
): Promise<AIEnhanceResponse> {
  return enhanceImage({
    featureKey: 'background_replace',
    imageUrl,
    draftId,
    slotId,
    customPrompt,
  });
}

// ============================================
// Direct Database Access (Fallback)
// ============================================

/**
 * Fetch AI configs directly from database
 * Use this as fallback if edge function is unavailable
 */
export async function fetchAIConfigDirect(): Promise<AIModelConfig[]> {
  const { data, error } = await supabase
    .from('ai_model_config')
    .select('*')
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[aiService] Direct config fetch error:', error);
    throw error;
  }

  return (data as AIModelConfigRow[]).map(transformConfigRow);
}

/**
 * Fetch background presets directly from database
 */
export async function fetchBackgroundPresetsDirect(): Promise<BackgroundPreset[]> {
  const { data, error } = await supabase
    .from('background_presets')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[aiService] Direct presets fetch error:', error);
    throw error;
  }

  return (data as BackgroundPresetRow[]).map(transformPresetRow);
}

// ============================================
// Export Default
// ============================================

export default {
  // Config
  fetchAIConfig,
  fetchBackgroundPresets,
  getFeatureConfig,
  
  // Credits
  getCredits,
  checkCredits,
  getGenerationHistory,
  
  // Enhancement
  enhanceImage,
  enhanceQuality,
  removeBackground,
  replaceBackgroundWithPreset,
  replaceBackgroundWithPrompt,
  
  // Direct DB access
  fetchAIConfigDirect,
  fetchBackgroundPresetsDirect,
};
