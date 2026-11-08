// js/login.js
// Tela de login (hoje no index.html), integrada ao Supabase.
import { supabase } from "./supabaseClient.js";
import {
  $, $$, ativarMostrarSenha, ligarFormulario,
  setStatus, withBusy, authMessage,
} from "./auth.js";

// Para onde ir depois de entrar (caminho relativo ao index.html)
const PAGINA_INICIAL = "pages/pagina-inicial.html";

// Botões com data-go="caminho" levam a outra página (ex.: "Criar conta")
$$("[data-go]").forEach(btn =>
  btn.addEventListener("click", () => (window.location.href = btn.dataset.go))
);

ligarFormulario($("form.login-card"), form => withBusy(form, () => entrar(form)));

async function entrar(form) {
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return setStatus(form, authMessage(error), "error");

  // A página inicial busca o nome e os pontos do usuário por conta própria.
  window.location.href = PAGINA_INICIAL;
}

ativarMostrarSenha();