// Cliente Supabase único, importado por app.js.
import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const key = import.meta.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!rawUrl || !key) {
  throw new Error(
    "Variáveis do Supabase ausentes. Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY."
  );
}

// A integração pode fornecer a URL da Data API (/rest/v1). O SDK adiciona
// /rest/v1 e /auth/v1 por conta própria; ele precisa da origem do projeto.
const url = new URL(rawUrl).origin;

// A chave "publishable" é feita para ficar no front-end; quem protege os dados
// são as regras de RLS criadas no SQL. NUNCA coloque a chave "secret" aqui.
export const supabase = createClient(url, key);
