// Cliente Supabase único, importado por app.js.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Variáveis do Supabase ausentes. Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY."
  );
}

// A chave "publishable" é feita para ficar no front-end; quem protege os dados
// são as regras de RLS criadas no SQL. NUNCA coloque a chave "secret" aqui.
export const supabase = createClient(url, key);
