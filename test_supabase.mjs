import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lbfkvwkmnanljfnzdaay.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZmt2d2ttbmFubGpmbnpkYWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTgzMjYsImV4cCI6MjA5Njc5NDMyNn0.j8Z-5Jynqj4SX9KUK1LVvC0H2QfKDgBLBxBb_69zvqA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('clientes').insert([
    { nombre: 'Test Anon', cuit: '333', clave_fiscal: '444', estado: 'Al día', ultima_sincronizacion: 'Nunca' }
  ]);
  if (error) {
    console.error("SUPABASE ERROR:", error);
  } else {
    console.log("SUCCESS:", data);
  }
}
test();
