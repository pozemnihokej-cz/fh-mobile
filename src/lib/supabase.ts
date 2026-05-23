import { createClient } from '@supabase/supabase-js';
import { resolveBaseUrl } from './runtimeUrls';

const supabaseUrl = resolveBaseUrl(import.meta.env.VITE_SUPABASE_URL, 'http://localhost:3002');
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('VITE_SUPABASE_ANON_KEY is not set. Add it to .env.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
