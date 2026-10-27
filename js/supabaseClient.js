// Cliente Supabase único, importado por app.js.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const key = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// A chave "publishable" é feita para ficar no front-end; quem protege os dados
// são as regras de RLS criadas no SQL. NUNCA coloque a chave "secret" aqui.
export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured ? createClient(url, key) : null;
