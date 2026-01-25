/**
 * AI Service - Webhook + Realtime Architecture
 * 
 * Client-side service for AI image enhancement features.
 * 
 * Architecture:
 * 1. Client submits job via ai-enhance Edge Function
 * 2. ai-enhance submits to Fal.AI with webhook_url pointing to ai-webhook
 * 3. Client subscribes to Supabase Realtime for ai_generations updates
 * 4. When Fal.AI completes, webhook updates DB → Realtime notifies client instantly
 * 5. Polling via ai-poll is a fallback if Realtime connection fails
 * 
 * This provides instant results without polling when webhooks work!
 */

import { supabase, SUPABASE_URL } from '@/lib/supabase';
import { uploadTempImage } from '@/domains/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';
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
  poll: `${EDGE_FUNCTION_BASE}/ai-poll`,
  credits: `${EDGE_FUNCTION_BASE}/ai-credits`,
  config: `${EDGE_FUNCTION_BASE}/ai-config`,
} as const;

// Timing configuration
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_WAIT_TIME_MS = 90000; // 90 seconds max timeout
const REALTIME_SETUP_DELAY_MS = 1000; // Start polling after 1s (give Realtime a moment to connect)

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
  /** Background info for solid/gradient replacement (transparent PNG + background color) */
  backgroundInfo?: {
    type: 'solid' | 'gradient';
    solidColor?: string;
    gradient?: {
      type: 'linear';
      colors: [string, string];
      direction: 'vertical' | 'horizontal' | 'diagonal-tl' | 'diagonal-tr';
    };
  };
}

interface EnhanceSubmitResponse {
  success: boolean;
  generation_id: string;
  // Standard response fields (for new enhancements)
  request_id?: string;
  fal_model?: string;
  estimated_time_seconds?: number;
  // Cached response fields (for duplicate prevention)
  cached?: boolean;
  output_url?: string;
  credits_charged?: number;
  message?: string;
  error?: string;
}

interface PollResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message?: string;
  output_url?: string;
  processing_time_ms?: number;
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
// Realtime Subscription + Polling Fallback
// ============================================

/**
 * Wait for enhancement completion using Supabase Realtime
 * 
 * Primary: Subscribe to DB changes (webhook triggers instant update)
 * Fallback: Poll via ai-poll if Realtime doesn't deliver in time
 */
async function waitForEnhancementCompletion(
  generationId: string,
  onProgress?: (progress: AIProcessingProgress) => void,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; outputUrl?: string; error?: string }> {
  const startTime = Date.now();
  let subscription: RealtimeChannel | null = null;
  let resolved = false;
  let lastPollTime = 0;

  return new Promise((resolve) => {
    // Helper to clean up and resolve
    const finish = (result: { success: boolean; outputUrl?: string; error?: string }) => {
      if (resolved) return;
      resolved = true;
      subscription?.unsubscribe();
      resolve(result);
    };

    // Handle abort signal
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        finish({ success: false, error: 'Cancelled' });
      });
    }

    // Set up Realtime subscription for instant webhook delivery
    console.log(`[aiService] Setting up Realtime subscription for ${generationId}`);
    
    subscription = supabase
      .channel(`ai_generation_${generationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_generations',
          filter: `id=eq.${generationId}`,
        },
        (payload) => {
          if (resolved) return;
          
          const newRecord = payload.new as AIGenerationRow;
          console.log(`[aiService] Realtime update: status=${newRecord.status}`);

          if (newRecord.status === 'completed' && newRecord.output_image_url) {
            console.log('[aiService] 🚀 Instant result via webhook!');
            console.log('[aiService] Output URL:', newRecord.output_image_url);
            onProgress?.({
              status: 'completed',
              message: 'Enhancement complete!',
              progress: 100,
              outputUrl: newRecord.output_image_url,
            });
            finish({ success: true, outputUrl: newRecord.output_image_url });
          } else if (newRecord.status === 'failed') {
            onProgress?.({
              status: 'failed',
              message: newRecord.error_message || 'Enhancement failed',
              error: newRecord.error_message,
            });
            finish({ success: false, error: newRecord.error_message || 'Enhancement failed' });
          }
        }
      )
      .subscribe((status) => {
        console.log(`[aiService] Realtime subscription status: ${status}`);
      });

    // Fallback polling loop (in case Realtime fails or webhook is slow)
    const pollLoop = async () => {
      while (!resolved && Date.now() - startTime < MAX_WAIT_TIME_MS) {
        // Check abort
        if (abortSignal?.aborted) {
          finish({ success: false, error: 'Cancelled' });
          return;
        }

        // Only poll if enough time has passed since last poll
        const timeSinceLastPoll = Date.now() - lastPollTime;
        if (timeSinceLastPoll >= POLL_INTERVAL_MS) {
          lastPollTime = Date.now();
          
          try {
            const result = await callEdgeFunction<PollResponse>(ENDPOINTS.poll, {
              method: 'POST',
              body: JSON.stringify({ generation_id: generationId }),
            });

            // Calculate progress
            const elapsed = Date.now() - startTime;
            const estimatedProgress = Math.min(10 + (elapsed / 1000) * 1.5, 95);

            switch (result.status) {
              case 'queued':
                onProgress?.({
                  status: 'queued',
                  message: result.message || 'Waiting in queue...',
                  progress: 10,
                });
                break;

              case 'processing':
                onProgress?.({
                  status: 'processing',
                  message: result.message || 'Enhancing your photo...',
                  progress: estimatedProgress,
                });
                break;

              case 'completed':
                console.log('[aiService] ✓ Result via polling');
                onProgress?.({
                  status: 'completed',
                  message: 'Enhancement complete!',
                  progress: 100,
                  outputUrl: result.output_url,
                });
                finish({ success: true, outputUrl: result.output_url });
                return;

              case 'failed':
                onProgress?.({
                  status: 'failed',
                  message: result.error || 'Enhancement failed',
                  error: result.error,
                });
                finish({ success: false, error: result.error });
                return;
            }
          } catch (error: any) {
            console.warn('[aiService] Poll error (will retry):', error.message);
          }
        }

        // Wait a bit before next iteration
        await new Promise(r => setTimeout(r, 500));
      }

      // Timeout
      if (!resolved) {
        onProgress?.({
          status: 'timeout',
          message: 'Processing took too long',
          error: 'Timeout',
        });
        finish({ success: false, error: 'Processing timeout' });
      }
    };

    // Start polling loop after short delay (give Realtime a moment to connect)
    setTimeout(() => {
      if (!resolved) {
        console.log('[aiService] Starting polling (Realtime + fallback)...');
        pollLoop();
      }
    }, REALTIME_SETUP_DELAY_MS);
  });
}

// ============================================
// Enhancement Functions
// ============================================

/**
 * Enhance an image with AI - with progress tracking
 * 
 * This is the main function to use for AI enhancements.
 * It submits to the edge function, then polls via server-side ai-poll endpoint.
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

    // Step 0: Upload local image to cloud storage if needed
    // Fal.AI cannot access local file:// URLs, so we need a public HTTP URL
    let imageUrl = request.imageUrl;
    if (imageUrl.startsWith('file://') || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      onProgress?.({
        status: 'submitting',
        message: 'Uploading image...',
        progress: 5,
      });
      
      try {
        imageUrl = await uploadTempImage(imageUrl, `ai-enhance-${Date.now()}`);
      } catch (uploadError: any) {
        console.error('[aiService] Image upload failed:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }
    }

    // Step 1: Submit to edge function
    const submitResponse = await callEdgeFunction<EnhanceSubmitResponse>(ENDPOINTS.enhance, {
      method: 'POST',
      body: JSON.stringify({
        feature_key: request.featureKey,
        image_url: imageUrl,
        draft_id: request.draftId,
        slot_id: request.slotId,
        preset_id: request.presetId,
        custom_prompt: request.customPrompt,
        solid_color: request.solidColor,
        model_type: request.modelType,
        params: request.params,
      }),
    });

    // Check for cached response (duplicate prevention)
    if (submitResponse.cached && submitResponse.output_url) {
      console.log('[aiService] Received cached result - image was already enhanced');
      
      onProgress?.({
        status: 'completed',
        message: 'Using cached enhancement (already processed)',
        progress: 100,
        outputUrl: submitResponse.output_url,
      });

      return {
        success: true,
        generationId: submitResponse.generation_id,
        outputUrl: submitResponse.output_url,
        creditsCharged: submitResponse.credits_charged ?? 0,
        creditsRemaining: 999,
        processingTimeMs: Date.now() - startTime,
        cached: true,
      };
    }

    // Standard flow - validate generation_id for polling
    if (!submitResponse.success || !submitResponse.generation_id) {
      throw new Error(submitResponse.error || 'Failed to submit enhancement request');
    }

    console.log('[aiService] Submitted:', submitResponse.generation_id);

    // Report queued status
    onProgress?.({
      status: 'queued',
      message: 'Request submitted...',
      progress: 5,
    });

    // Check if cancelled before waiting
    if (abortSignal?.aborted) {
      return {
        success: false,
        generationId: submitResponse.generation_id,
        creditsCharged: 0,
        creditsRemaining: 0,
        error: 'Cancelled',
      };
    }

    // Step 2: Wait for completion via Realtime (instant) or polling (fallback)
    // Webhooks deliver results instantly via Realtime subscription
    const pollResult = await waitForEnhancementCompletion(
      submitResponse.generation_id,
      onProgress,
      abortSignal
    );

    const processingTime = Date.now() - startTime;

    if (!pollResult.success) {
      return {
        success: false,
        generationId: submitResponse.generation_id,
        creditsCharged: 0,
        creditsRemaining: 0,
        processingTimeMs: processingTime,
        error: pollResult.error,
      };
    }

    return {
      success: true,
      generationId: submitResponse.generation_id,
      outputUrl: pollResult.outputUrl,
      creditsCharged: 1,
      creditsRemaining: 999,
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

/**
 * Remove background from an image using birefnet
 * Returns a transparent PNG that can be composited onto any background
 * 
 * @param imageUrl - URL of the image to process
 * @param onProgress - Progress callback
 * @param abortSignal - Optional abort signal for cancellation
 * @returns AIEnhanceResponse with outputUrl pointing to transparent PNG
 */
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

/**
 * Replace background with an exact solid color
 * 
 * This is a two-step process:
 * 1. Remove background using birefnet (returns transparent PNG)
 * 2. Client-side composites the PNG onto the exact hex color
 * 
 * This approach guarantees pixel-perfect color matching since no AI
 * interpretation is involved in the color application.
 * 
 * @param imageUrl - URL of the image to process
 * @param onProgress - Progress callback
 * @param abortSignal - Optional abort signal for cancellation
 * @returns AIEnhanceResponse with outputUrl pointing to transparent PNG
 * 
 * Note: The client must handle compositing the returned transparent PNG
 * onto the desired color using backgroundCompositeService.
 */
export async function replaceBackgroundWithExactColor(
  imageUrl: string,
  onProgress?: (progress: AIProcessingProgress) => void,
  abortSignal?: AbortSignal
): Promise<AIEnhanceResponse> {
  // Step 1: Remove background to get transparent PNG
  // The client will handle Step 2: Compositing onto solid color
  return removeBackground(imageUrl, onProgress, abortSignal);
}

/**
 * Replace background with a gradient
 * 
 * This is a two-step process:
 * 1. Remove background using birefnet (returns transparent PNG)
 * 2. Client-side composites the PNG onto the gradient
 * 
 * This approach is required because AI cannot reliably generate
 * specific gradients from text prompts.
 * 
 * @param imageUrl - URL of the image to process
 * @param onProgress - Progress callback
 * @param abortSignal - Optional abort signal for cancellation
 * @returns AIEnhanceResponse with outputUrl pointing to transparent PNG
 * 
 * Note: The client must handle compositing the returned transparent PNG
 * onto the desired gradient using backgroundCompositeService.
 */
export async function replaceBackgroundWithGradient(
  imageUrl: string,
  onProgress?: (progress: AIProcessingProgress) => void,
  abortSignal?: AbortSignal
): Promise<AIEnhanceResponse> {
  // Step 1: Remove background to get transparent PNG
  // The client will handle Step 2: Compositing onto gradient
  return removeBackground(imageUrl, onProgress, abortSignal);
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
  replaceBackgroundWithPreset,
  replaceBackgroundWithPrompt,
  replaceBackgroundWithColor,
  
  // Background Remove & Exact Color/Gradient (birefnet-based)
  removeBackground,
  replaceBackgroundWithExactColor,
  replaceBackgroundWithGradient,
  
  // Direct DB access
  fetchAIConfigDirect,
  fetchBackgroundPresetsDirect,
};
