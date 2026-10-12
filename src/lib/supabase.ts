import { createClient } from '@supabase/supabase-js'
// Buscando as chaves recebidas no .env
const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL

// Validando as chaves do supabase
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Configure as variáveis de ambiente do Supabase.'
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)