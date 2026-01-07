import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tmgjsrxdjbazrwvbdoed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtZ2pzcnhkamJhenJ3dmJkb2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NDE3MDcsImV4cCI6MjA4MzMxNzcwN30.krSbo9fqvKkbQrjFDnQo2s7JiaXwo1wydhvaontxtFE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

