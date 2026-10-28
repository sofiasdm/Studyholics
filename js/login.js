// js/login.js
// Tela de login (hoje no index.html), integrada ao Supabase.
import { supabase } from "./supabaseClient.js";
import {
  $, $$, ativarMostrarSenha, ligarFormulario,
  setStatus, withBusy, authMessage,
} from "./auth.js";

// Botões com data-go="caminho" levam a outra página (ex.: "Criar conta")
$$("[data-go]").forEach(btn =>
  btn.addEventListener("click", () => (window.location.href = btn.dataset.go))
);

ligarFormulario($("form.login-card"), form => withBusy(form, () => entrar(form)));

async function entrar(form) {
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return setStatus(form, authMessage(error), "error");

  // Busca a linha do estudante (a regra RLS só devolve a do próprio usuário)
  const { data: estudante, error: erroEstudante } = await supabase
    .from("estudante")
    .select("primeiro_nome, username, pontuacao")
    .eq("id_usuario", data.user.id)
    .maybeSingle();
  if (erroEstudante) console.error(erroEstudante);

  setStatus(form, `Bem-vindo(a), ${estudante?.primeiro_nome ?? "estudante"}!`);
  // TODO: quando pages/dashboard.html existir, redirecione para ela aqui.
}

ativarMostrarSenha();