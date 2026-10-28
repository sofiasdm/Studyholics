// Studyholics — telas de login e cadastro integradas ao Supabase.
import { supabase } from "./supabaseClient.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.6M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7c1.8 0 3.3-.5 4.6-1.2"/></svg>';

// ---------- Navegação entre telas ----------
function show(step) {
  $("#login").hidden = step !== 0;
  $("#signup").hidden = step === 0;
  $("#signup").dataset.step = step;
  $$(".step").forEach(form => (form.hidden = Number(form.dataset.step) !== step));
  $$(".progress li").forEach((dot, i) => {
    dot.className = i + 1 < step ? "done" : i + 1 === step ? "current" : "";
  });
  window.scrollTo(0, 0);
}
let current = 0;
const go = step => show((current = step));
$$("[data-go]").forEach(btn => btn.addEventListener("click", () => go(Number(btn.dataset.go))));
$("#back").addEventListener("click", () => go(current - 1));

// ---------- Mostrar/ocultar senha ----------
$$(".field.password").forEach(field => {
  const input = $("input", field);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "toggle";
  btn.setAttribute("aria-label", "Mostrar senha");
  btn.innerHTML = EYE;
  btn.addEventListener("click", () => {
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    btn.innerHTML = hidden ? EYE_OFF : EYE;
    btn.setAttribute("aria-label", hidden ? "Ocultar senha" : "Mostrar senha");
  });
  field.append(btn);
});

// ---------- Validação ----------
const messages = {
  password: "Informe sua senha.",
  username: "Informe seu nome de usuário.",
  name: "Informe seu nome completo.",
  email: "Informe um e-mail válido.",
  confirm: "Confirme sua senha.",
  course: "Selecione seu curso.",
  semester: "Selecione seu semestre.",
};

function errorFor(input, form) {
  const v = input.value.trim();
  if (input.name === "confirm" && v && v !== form.password.value) return "As senhas precisam ser iguais.";
  if (input.name === "password" && input.minLength > 0 && v && v.length < 8) return "Use pelo menos 8 caracteres.";
  if (input.name === "username" && v && !/^[A-Za-z0-9_.]{3,30}$/.test(v)) return "Use 3 a 30 caracteres: letras, números, _ ou .";
  if (input.name === "name" && v && v.split(/\s+/).length < 2) return "Informe nome e sobrenome.";
  return input.checkValidity() ? "" : messages[input.name];
}

function setError(input, msg) {
  const field = input.closest(".field");
  let el = field.nextElementSibling?.classList.contains("error") ? field.nextElementSibling : null;
  field.classList.toggle("invalid", Boolean(msg));
  input.setAttribute("aria-invalid", Boolean(msg));
  if (!msg) return el?.remove();
  if (!el) { el = document.createElement("p"); el.className = "error"; field.after(el); }
  el.textContent = msg;
}

function validate(form) {
  let ok = true;
  $$("input:not([type=file]), select", form).forEach(input => {
    const msg = errorFor(input, form);
    setError(input, msg);
    if (msg) ok = false;
  });
  return ok;
}

$$("form").forEach(form => {
  form.addEventListener("input", e => { setError(e.target, ""); $(".status", form)?.setAttribute("hidden", ""); });
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!validate(form)) return;
    const step = Number(form.dataset.step);
    if (step && step < 3) return go(step + 1);
    // Login (sem data-step) ou última etapa do cadastro:
    withBusy(form, () => (step === 3 ? handleSignup(form) : handleLogin(form)));
  });
});

// ---------- Utilitários da integração ----------
function setStatus(form, text, type = "ok") {
  const el = $(".status", form);
  el.textContent = text;
  el.dataset.type = type;
  el.hidden = false;
}

// Desabilita o botão enquanto a requisição roda (evita cliques duplos)
async function withBusy(form, action) {
  const btn = $("button[type=submit]", form);
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Aguarde…";
  try {
    await action();
  } catch (err) {
    console.error(err);
    setStatus(form, authMessage(err), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// Traduz os erros do Supabase Auth para mensagens amigáveis
function authMessage(error) {
  const code = String(error?.code ?? error?.error_code ?? "").toLowerCase();
  const detail = [error?.message, error?.error_description, error?.details]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // O Supabase pode sinalizar e-mail repetido por código ou apenas pela mensagem,
  // dependendo da configuração de confirmação de e-mail do projeto.
  if (
    ["user_already_exists", "email_exists", "email_already_exists", "duplicate_email"].includes(code) ||
    /user.*already registered|email (address )?.*(already (registered|exists|in use)|registered)|already (been )?registered/i.test(detail) ||
    (code === "unexpected_failure" && /already exists|duplicate key.*email/i.test(detail))
  ) {
    return "Este e-mail já possui uma conta. Faça login ou use outro e-mail.";
  }

  if (/database error saving new user|database error creating new user/i.test(detail))
    return "O Supabase não conseguiu salvar os dados do cadastro. Verifique o trigger de criação do perfil e os campos obrigatórios da tabela estudante.";

  if (code === "email_not_confirmed")
    return "Confirme seu e-mail antes de entrar. Confira sua caixa de entrada e a pasta de spam.";

  switch (code) {
    case "invalid_credentials":    return "E-mail ou senha incorretos.";
    case "weak_password":          return "Senha fraca. Use pelo menos 8 caracteres.";
    case "email_address_invalid":  return "Informe um endereço de e-mail válido.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit": return "Muitas tentativas. Aguarde um pouco e tente de novo.";
    case "email_not_found":        return "Não encontramos uma conta com esse e-mail.";
  }
  if (/failed to fetch|networkerror|network request failed/i.test(detail))
    return "Não foi possível conectar ao serviço de cadastro. Verifique sua conexão e tente novamente.";
  if (/database error/i.test(detail))
    return "Não foi possível salvar o cadastro no banco de dados. Verifique o trigger de criação do perfil.";
  return "Não foi possível concluir. Tente novamente.";
}

// ---------- Cursos (vêm da tabela CURSO) ----------
async function carregarCursos() {
  const select = $('select[name="course"]');
  const { data, error } = await supabase
    .from("curso")
    .select("id_curso, nome_curso")
    .order("nome_curso");
  if (error) {
    console.error(error);
    select.options[0].textContent = "Não foi possível carregar os cursos";
    return;
  }
  select.innerHTML = '<option value="">Selecione seu curso</option>';
  data.forEach(c => select.append(new Option(c.nome_curso, c.id_curso)));
}
carregarCursos();

// ---------- Login ----------
async function handleLogin(form) {
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[login] signInWithPassword retornou erro", {
      code: error.code,
      status: error.status,
      message: error.message,
      error,
    });
    return setStatus(form, authMessage(error), "error");
  }

  // Busca a linha do estudante (a regra RLS só devolve a do próprio usuário)
  const { data: estudante, error: erroEstudante } = await supabase
    .from("estudante")
    .select("primeiro_nome, username, pontuacao")
    .eq("id_usuario", data.user.id)
    .maybeSingle();
  if (erroEstudante) console.error(erroEstudante);

  setStatus(form, `Bem-vindo(a), ${estudante?.primeiro_nome ?? "estudante"}!`);
  // TODO: quando existir a tela inicial, redirecione/mostre-a aqui.
}

// ---------- Cadastro ----------
async function handleSignup(form) {
  // Dados das 3 etapas (form[data-step] evita pegar o <main id="signup">)
  const etapa1 = new FormData($('form[data-step="1"]'));
  const etapa2 = new FormData($('form[data-step="2"]'));
  const username = form.elements.username.value.trim();

  // 1) nome de usuário livre?
  const { data: livre, error: erroUser } = await supabase.rpc("username_disponivel", { p_username: username });
  if (erroUser) throw erroUser;
  if (!livre) return setError(form.elements.username, "Esse nome de usuário já está em uso.");

  // 2) cria a conta no Supabase Auth. Os campos extras vão em options.data;
  //    o trigger handle_new_user (SQL) usa isso para criar a linha em ESTUDANTE.
  const [primeiroNome, ...resto] = etapa1.get("name").trim().split(/\s+/);
  const { data, error } = await supabase.auth.signUp({
    email: etapa1.get("email").trim(),
    password: etapa1.get("password"),
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        primeiro_nome: primeiroNome,
        sobrenome: resto.join(" "),
        username,
        id_curso: Number(etapa2.get("course")),
        semestre: Number(etapa2.get("semester")),
      },
    },
  });
  if (error) {
    console.error("[cadastro] signUp retornou erro", {
      code: error.code,
      status: error.status,
      message: error.message,
      error,
    });
    return setStatus(form, authMessage(error), "error");
  }

  // E-mail já existente (com confirmação ligada o Supabase não dá erro, devolve identities vazio)
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
    return setStatus(form, "Este e-mail já possui uma conta. Faça login ou use outro e-mail.", "error");

  // 3) sem sessão = confirmação de e-mail ligada: usuário precisa confirmar antes
  if (!data.session)
    return setStatus(form, "Conta criada! Enviamos um link de confirmação para o seu e-mail.");

  // 4) com sessão: envia a foto (opcional). Falha na foto não cancela o cadastro.
  const foto = $('input[name="photo"]', form).files[0];
  if (foto) {
    try { await uploadFoto(foto, data.user.id); }
    catch (e) { console.error(e); return setStatus(form, "Conta criada! (A foto não pôde ser enviada.)"); }
  }
  setStatus(form, "Conta criada com sucesso! Bem-vindo(a) ao Studyholics.");
}

async function uploadFoto(file, userId) {
  const path = `${userId}/avatar`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`; // ?v= evita cache da foto antiga
  const { error: erroUpdate } = await supabase
    .from("estudante").update({ foto_url: url }).eq("id_usuario", userId);
  if (erroUpdate) throw erroUpdate;
}

// ---------- Foto de perfil (apenas pré-visualização) ----------
$(".avatar input").addEventListener("change", e => {
  const file = e.target.files[0];
  const img = $(".avatar img");
  if (!file) return;
  img.src = URL.createObjectURL(file);
  img.hidden = false;
});

show(0);
