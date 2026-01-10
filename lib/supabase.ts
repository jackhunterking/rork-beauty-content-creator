import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = 'https://tmgjsrxdjbazrwvbdoed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtZ2pzcnhkamJhenJ3dmJkb2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NDE3MDcsImV4cCI6MjA4MzMxNzcwN30.krSbo9fqvKkbQrjFDnQo2s7JiaXwo1wydhvaontxtFE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use AsyncStorage for session persistence on native, localStorage on web
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    // Auto refresh tokens before they expire
    autoRefreshToken: true,
    // Persist session across app restarts
    persistSession: true,
    // Don't detect session from URL on native (handled by deep links)
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Export URL for deep linking configuration
export const SUPABASE_URL = supabaseUrl;

