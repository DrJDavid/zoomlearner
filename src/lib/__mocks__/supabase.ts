import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'mock-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey); 