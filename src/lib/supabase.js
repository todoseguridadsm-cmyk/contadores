import { createClient } from '@supabase/supabase-js';

// Usaremos variables de entorno para que sea seguro al subir a Vercel.
// Vite usa import.meta.env en lugar de process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
