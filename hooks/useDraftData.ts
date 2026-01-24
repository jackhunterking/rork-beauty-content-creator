import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Draft, DraftRow } from '@/types';
import { mapRowToDraft } from '@/services/draftService';

interface UseDraftDataResult {
  draft: Draft | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch a draft directly from Supabase.
 * This provides a single source of truth for draft data,
 * bypassing the realtime list cache which may have stale/incomplete data.
 */
export function useDraftData(draftId: string | null): UseDraftDataResult {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDraft = useCallback(async () => {
    if (!draftId) {
      setDraft(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', draftId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const mappedDraft = mapRowToDraft(data as DraftRow);
      setDraft(mappedDraft);
    } catch (err) {
      console.error('[useDraftData] Error fetching draft:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch draft'));
    } finally {
      setIsLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    fetchDraft();
  }, [fetchDraft]);

  return {
    draft,
    isLoading,
    error,
    refetch: fetchDraft,
  };
}
