import { supabase } from '@/lib/supabase';

export interface FeedbackResult {
  success: boolean;
  error?: string;
}

/**
 * Submit feedback or support message to Supabase
 * Works for both authenticated and anonymous users
 */
export async function submitFeedback(message: string): Promise<FeedbackResult> {
  try {
    // Validate message
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return { success: false, error: 'Please enter a message' };
    }

    if (trimmedMessage.length < 10) {
      return { success: false, error: 'Please provide more details (at least 10 characters)' };
    }

    if (trimmedMessage.length > 2000) {
      return { success: false, error: 'Message is too long (max 2000 characters)' };
    }

    // Get current user if authenticated
    const { data: { user } } = await supabase.auth.getUser();

    // Insert feedback
    const { error } = await supabase
      .from('feedback')
      .insert({
        user_id: user?.id || null,
        user_email: user?.email || null,
        message: trimmedMessage,
        status: 'pending',
      });

    if (error) {
      console.error('[FeedbackService] Error submitting feedback:', error);
      return { success: false, error: 'Failed to send message. Please try again.' };
    }

    console.log('[FeedbackService] Feedback submitted successfully');
    return { success: true };
  } catch (error) {
    console.error('[FeedbackService] Unexpected error:', error);
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}
