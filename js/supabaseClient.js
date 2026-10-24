// Cliente Supabase único, importado por app.js.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const key = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Variáveis do Supabase ausentes. Confira o .env.local (e reinicie o 'npm run dev')."
  );
}

// A chave "publishable" é feita para ficar no front-end; quem protege os dados
// são as regras de RLS criadas no SQL. NUNCA coloque a chave "secret" aqui.
export const supabase = createClient(url, key);
