/**
 * AI Service - Direct Fal.AI Integration
 * 
 * Client-side service for AI image enhancement features.
 * Uses Supabase Edge Functions to submit jobs, then polls Fal.AI directly.
 */

import { supabase, SUPABASE_URL } from '@/lib/supabase';
import Constants from 'expo-constants';
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
} from '@/types';

// ============================================
// Configuration
// ============================================

const EDGE_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;

const ENDPOINTS = {
  enhance: `${EDGE_FUNCTION_BASE}/ai-enhance`,
  credits: `${EDGE_FUNCTION_BASE}/ai-credits`,
  config: `${EDGE_FUNCTION_BASE}/ai-config`,
} as const;

// Get Fal.AI API key for client-side polling
const FAL_API_KEY = Constants.expoConfig?.extra?.falApiKey || '';

// Polling configuration
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_TIME_MS = 120000; // 2 minutes max

// ============================================
// Types
// ============================================

export type AIProcessingStatus = 
  | 'submitting'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export interface AIProcessingProgress {
  status: AIProcessingStatus;
  message: string;
  progress?: number; // 0-100
  outputUrl?: string;
  error?: string;
}

interface FalQueueResponse {
  request_id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  response?: {
    image?: { url: string };
    output?: { url: string };
    url?: string;
    error?: string;
  };
  error?: {
    message: string;
    code?: string;
  };
}

interface EnhanceSubmitResponse {
  success: boolean;
  generation_id: string;
  request_id: string;
  fal_model: string;
  poll_url: string;
  estimated_time_seconds?: number;
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

async function callEdgeFunction<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeader = await getAuthHeader();
  
  if (!authHeader) {
    throw new Error('AUTH_PENDING');
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

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('AUTH_PENDING');
    }
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

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

export async function fetchAIConfig(): Promise<AIModelConfig[]> {
  try {
    const response = await callEdgeFunction<{ features: AIModelConfigRow[]; version: string }>(ENDPOINTS.config);
    return (response.features || []).map(transformConfigRow);
  } catch (error: any) {
    if (error?.message === 'AUTH_PENDING') {
      return [];
    }
    console.error('[aiService] Error fetching AI config:', error);
    throw error;
  }
}

export async function fetchBackgroundPresets(): Promise<{
  presets: BackgroundPreset[];
  grouped: GroupedBackgroundPresets;
}> {
  try {
    const response = await callEdgeFunction<{
      presets: BackgroundPresetRow[];
      grouped: Record<string, BackgroundPresetRow[]>;
    }>(`${ENDPOINTS.config}/presets`);
    
    const transformedPresets = (response.presets || []).map(transformPresetRow);
    const transformedGrouped: GroupedBackgroundPresets = {
      studio: (response.grouped?.studio || []).map(transformPresetRow),
      solid: (response.grouped?.solid || []).map(transformPresetRow),
      nature: (response.grouped?.nature || []).map(transformPresetRow),
      blur: (response.grouped?.blur || []).map(transformPresetRow),
      professional: (response.grouped?.professional || []).map(transformPresetRow),
    };
    
    return {
      presets: transformedPresets,
      grouped: transformedGrouped,
    };
  } catch (error: any) {
    if (error?.message === 'AUTH_PENDING') {
      return {
        presets: [],
        grouped: { studio: [], solid: [], nature: [], blur: [], professional: [] }
      };
    }
    console.error('[aiService] Error fetching presets:', error);
    throw error;
  }
}

export async function getFeatureConfig(featureKey: AIFeatureKey): Promise<AIModelConfig | null> {
  const configs = await fetchAIConfig();
  return configs.find(c => c.featureKey === featureKey) || null;
}

// ============================================
// Credit Functions
// ============================================

export async function getCredits(): Promise<AICredits | null> {
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
  } catch (error: any) {
    if (error?.message === 'AUTH_PENDING') {
      return null;
    }
    console.error('[aiService] Error fetching credits:', error);
    throw error;
  }
}

export async function checkCredits(featureKey: AIFeatureKey): Promise<AIFeatureCheck> {
  // Premium users have unlimited access - always return true
  // Credits are tracked internally for analytics only
    return {
    hasCredits: true,
    creditsRemaining: 999,
    creditsRequired: 1,
    };
}

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
// Fal.AI Polling Functions
// ============================================

/**
 * Poll Fal.AI for job status
 */
async function pollFalAIStatus(
  pollUrl: string,
  onProgress?: (progress: AIProcessingProgress) => void,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; outputUrl?: string; error?: string }> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    // Check if cancelled
    if (abortSignal?.aborted) {
      return { success: false, error: 'Cancelled' };
    }

    try {
      const response = await fetch(pollUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[aiService] Poll error:', response.status, errorText);
        
        // Retry on 5xx errors
        if (response.status >= 500) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
          continue;
        }
        
        return { success: false, error: `Poll failed: ${response.status}` };
      }

      const result: FalQueueResponse = await response.json();
      console.log('[aiService] Poll status:', result.status);

      switch (result.status) {
        case 'IN_QUEUE':
          onProgress?.({
            status: 'queued',
            message: 'Waiting in queue...',
            progress: 10,
          });
          break;

        case 'IN_PROGRESS':
          const elapsed = Date.now() - startTime;
          const estimatedProgress = Math.min(30 + (elapsed / 1000) * 2, 90);
          onProgress?.({
            status: 'processing',
            message: 'Enhancing your photo...',
            progress: estimatedProgress,
          });
          break;

        case 'COMPLETED':
          // Extract output URL from various possible locations
          const outputUrl = 
            result.response?.image?.url ||
            result.response?.output?.url ||
            result.response?.url;

          if (!outputUrl) {
            console.error('[aiService] No output URL in response:', result);
            return { success: false, error: 'No output URL in response' };
          }

          onProgress?.({
            status: 'completed',
            message: 'Enhancement complete!',
            progress: 100,
            outputUrl,
          });

          return { success: true, outputUrl };

        case 'FAILED':
          const errorMsg = result.error?.message || result.response?.error || 'Processing failed';
          onProgress?.({
            status: 'failed',
            message: errorMsg,
            error: errorMsg,
          });
          return { success: false, error: errorMsg };
      }

    } catch (error: any) {
      console.error('[aiService] Poll error:', error);
      // Continue polling on network errors
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Timeout
  onProgress?.({
    status: 'timeout',
    message: 'Processing took too long',
    error: 'Timeout',
  });
  return { success: false, error: 'Processing timeout' };
}

// ============================================
// Enhancement Functions
// ============================================

/**
 * Enhance an image with AI - with progress tracking
 * 
 * This is the main function to use for AI enhancements.
 * It submits to the edge function, then polls Fal.AI directly.
 */
export async function enhanceImageWithPolling(
  request: AIEnhanceRequest,
  onProgress?: (progress: AIProcessingProgress) => void,
  abortSignal?: AbortSignal
): Promise<AIEnhanceResponse> {
  const startTime = Date.now();

  try {
    // Report submitting status
    onProgress?.({
      status: 'submitting',
      message: 'Starting enhancement...',
      progress: 0,
    });

    // Step 1: Submit to edge function
    const submitResponse = await callEdgeFunction<EnhanceSubmitResponse>(ENDPOINTS.enhance, {
      method: 'POST',
      body: JSON.stringify({
        feature_key: request.featureKey,
        image_url: request.imageUrl,
        draft_id: request.draftId,
        slot_id: request.slotId,
        preset_id: request.presetId,
        custom_prompt: request.customPrompt,
        solid_color: request.solidColor,
        model_type: request.modelType,
        params: request.params,
      }),
    });

    if (!submitResponse.success || !submitResponse.request_id) {
      throw new Error(submitResponse.error || 'Failed to submit enhancement request');
    }

    console.log('[aiService] Submitted:', submitResponse.generation_id, submitResponse.request_id);

    // Report queued status
    onProgress?.({
      status: 'queued',
      message: 'Request submitted...',
      progress: 5,
    });

    // Check if cancelled before polling
    if (abortSignal?.aborted) {
      return {
        success: false,
        generationId: submitResponse.generation_id,
        creditsCharged: 0,
        creditsRemaining: 0,
        error: 'Cancelled',
      };
    }

    // Step 2: Poll Fal.AI directly
    const pollResult = await pollFalAIStatus(
      submitResponse.poll_url,
      onProgress,
      abortSignal
    );

    const processingTime = Date.now() - startTime;

    if (!pollResult.success) {
      // Update generation status via Supabase
      await updateGenerationStatus(submitResponse.generation_id, 'failed', pollResult.error);
      
      return {
        success: false,
        generationId: submitResponse.generation_id,
        creditsCharged: 0,
        creditsRemaining: 0,
        processingTimeMs: processingTime,
        error: pollResult.error,
      };
    }

    // Update generation with success
    await updateGenerationStatus(submitResponse.generation_id, 'completed', undefined, pollResult.outputUrl, processingTime);

    return {
      success: true,
      generationId: submitResponse.generation_id,
      outputUrl: pollResult.outputUrl,
      creditsCharged: 1, // Internal tracking
      creditsRemaining: 999, // Unlimited for premium
      processingTimeMs: processingTime,
    };

  } catch (error: any) {
    console.error('[aiService] Enhancement error:', error);
    
    onProgress?.({
      status: 'failed',
      message: error.message || 'Enhancement failed',
      error: error.message,
    });
    
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
 * Update generation status in database
 */
async function updateGenerationStatus(
  generationId: string,
  status: 'completed' | 'failed',
  errorMessage?: string,
  outputUrl?: string,
  processingTimeMs?: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('ai_generations')
      .update({
        status,
        error_message: errorMessage || null,
        output_image_url: outputUrl || null,
        processing_time_ms: processingTimeMs || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', generationId);

    if (error) {
      console.error('[aiService] Failed to update generation:', error);
    }
  } catch (e) {
    console.error('[aiService] Update generation error:', e);
  }
}

/**
 * Legacy sync function - wraps the polling version
 */
export async function enhanceImage(
  request: AIEnhanceRequest
): Promise<AIEnhanceResponse> {
  return enhanceImageWithPolling(request);
}

// ============================================
// Convenience Methods
// ============================================

export async function enhanceQuality(
  imageUrl: string,
  onProgress?: (progress: AIProcessingProgress) => void,
  abortSignal?: AbortSignal
): Promise<AIEnhanceResponse> {
  return enhanceImageWithPolling(
    { featureKey: 'auto_quality', imageUrl },
    onProgress,
    abortSignal
  );
}

export async function removeBackground(
  imageUrl: string,
  onProgress?: (progress: AIProcessingProgress) => void,
  abortSignal?: AbortSignal
): Promise<AIEnhanceResponse> {
  return enhanceImageWithPolling(
    { featureKey: 'background_remove', imageUrl },
    onProgress,
    abortSignal
  );
}

export async function replaceBackgroundWithPreset(
  imageUrl: string,
  presetId: string,
  onProgress?: (progress: AIProcessingProgress) => void,
  abortSignal?: AbortSignal
): Promise<AIEnhanceResponse> {
  return enhanceImageWithPolling(
    { featureKey: 'background_replace', imageUrl, presetId },
    onProgress,
    abortSignal
  );
}

export async function replaceBackgroundWithPrompt(
  imageUrl: string,
  customPrompt: string,
  onProgress?: (progress: AIProcessingProgress) => void,
  abortSignal?: AbortSignal
): Promise<AIEnhanceResponse> {
  return enhanceImageWithPolling(
    { featureKey: 'background_replace', imageUrl, customPrompt },
    onProgress,
    abortSignal
  );
}

export async function replaceBackgroundWithColor(
  imageUrl: string,
  solidColor: string,
  onProgress?: (progress: AIProcessingProgress) => void,
  abortSignal?: AbortSignal
): Promise<AIEnhanceResponse> {
  return enhanceImageWithPolling(
    { featureKey: 'background_replace', imageUrl, solidColor },
    onProgress,
    abortSignal
  );
}

// ============================================
// Direct Database Access (Fallback)
// ============================================

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
  enhanceImageWithPolling,
  enhanceQuality,
  removeBackground,
  replaceBackgroundWithPreset,
  replaceBackgroundWithPrompt,
  replaceBackgroundWithColor,
  
  // Direct DB access
  fetchAIConfigDirect,
  fetchBackgroundPresetsDirect,
};
