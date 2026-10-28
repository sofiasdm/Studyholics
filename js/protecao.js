// js/protecao.js
// Guarda de páginas internas: sem sessão ativa, volta para o login.
import { supabase } from "./supabaseClient.js";

export async function exigirLogin(destino = "../index.html") {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace(destino);
    return null;
  }
  return session;
}
