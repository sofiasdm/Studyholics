// Studyholics — telas de login e cadastro integradas ao Supabase.
import { supabase, supabaseConfigured } from "./supabaseClient.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.6M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7c1.8 0 3.3-.5 4.6-1.2"/></svg>';

// ---------- Navegação entre telas ----------
function show(step, { updateRoute = false } = {}) {
  $("#login").hidden = step !== 0;
  $("#signup").hidden = step === 0;
  $("#verify-email").hidden = true;
  $("#welcome").hidden = true;
  $("#signup").dataset.step = Math.max(1, step);
  $$(".step").forEach(form => (form.hidden = Number(form.dataset.step) !== step));
  $$(".progress li").forEach((dot, i) => {
    dot.className = i + 1 < step ? "done" : i + 1 === step ? "current" : "";
  });
  if (updateRoute) {
    const hash = step === 0 ? "#login" : "#cadastro";
    if (location.hash !== hash) history.pushState(null, "", hash);
  }
  window.scrollTo(0, 0);
}
let current = 0;
const go = step => {
  current = Math.max(0, Math.min(3, step));
  show(current, { updateRoute: current === 0 || current === 1 });
};
$$("[data-go]").forEach(btn => btn.addEventListener("click", () => go(Number(btn.dataset.go))));
$("#back").addEventListener("click", () => go(current === 1 ? 0 : current - 1));
$$('[data-route="login"]').forEach(link => link.addEventListener("click", event => {
  event.preventDefault();
  go(0);
}));

function showWelcome(name = "") {
  $("#login").hidden = true;
  $("#signup").hidden = true;
  $("#verify-email").hidden = true;
  $("#welcome").hidden = false;
  $("#welcome-title").textContent = name ? `Bem-vindo(a), ${name}!` : "Acesso liberado!";
  current = 0;
  if (location.hash !== "#inicio") history.pushState(null, "", "#inicio");
  window.scrollTo(0, 0);
}

function showEmailVerification(email) {
  $("#login").hidden = true;
  $("#signup").hidden = true;
  $("#welcome").hidden = true;
  $("#verify-email").hidden = false;
  $("#verification-form").hidden = false;
  $("#verification-email").textContent = email;
  $("#verify-email form").elements.email.value = email;
  window.scrollTo(0, 0);
}

window.addEventListener("popstate", () => {
  if (location.hash === "#cadastro") go(1);
  else go(0);
});

$("#logout").addEventListener("click", async () => {
  const button = $("#logout");
  button.disabled = true;
  try {
    if (!supabaseConfigured) throw new Error("Supabase não configurado.");
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    go(0);
  } catch (error) {
    console.error(error);
    button.disabled = false;
    alert("Não foi possível voltar ao login. Tente novamente.");
  }
});

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
  if (!field) return;
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
  form.addEventListener("blur", e => {
    if (e.target.matches("input:not([type=file]), select") && e.target.value.trim())
      setError(e.target, errorFor(e.target, form));
  }, true);
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (form.id === "verification-form") return withBusy(form, () => verifySignupEmail(form));
    if (!validate(form)) return;
    const step = Number(form.dataset.step);
    if (step === 1) return withBusy(form, () => validateEmailBeforeNext(form));
    if (step && step < 3) return go(step + 1);
    // Login (sem data-step) ou última etapa do cadastro:
    withBusy(form, () => (step === 3 ? handleSignup(form) : handleLogin(form)));
  });
});

async function verifySignupEmail(form) {
  const token = form.elements.token.value.trim().replace(/\s+/g, "");
  if (!token) {
    setError(form.elements.token, "Informe o código enviado para seu e-mail.");
    form.elements.token.focus();
    return;
  }
  const { error } = await supabase.auth.verifyOtp({
    email: form.elements.email.value,
    token,
    type: "signup",
  });
  if (error) {
    console.error(error);
    setStatus(form, "Código inválido ou expirado. Confira o código e tente novamente.", "error");
    return;
  }
  const { error: logoutError } = await supabase.auth.signOut();
  if (logoutError) console.error(logoutError);
  go(0);
  setStatus($(".login-card"), "E-mail confirmado. Entre com seu e-mail e senha.");
}

$("#resend-code").addEventListener("click", async () => {
  const form = $("#verification-form");
  const button = $("#resend-code");
  button.disabled = true;
  try {
    const { error } = await supabase.auth.resend({ type: "signup", email: form.elements.email.value });
    if (error) throw error;
    setStatus(form, "Enviamos um novo código. Confira sua caixa de entrada.");
  } catch (error) {
    console.error(error);
    setStatus(form, authMessage(error), "error");
  } finally {
    button.disabled = false;
  }
});

// ---------- Utilitários da integração ----------
function setStatus(form, text, type = "ok") {
  const el = $(".status", form);
  if (!el) return;
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

// Verifica duplicidade no servidor antes de permitir que o cadastro avance.
async function validateEmailBeforeNext(form) {
  if (!supabaseConfigured) {
    setStatus(form, "O cadastro está temporariamente indisponível. Tente novamente mais tarde.", "error");
    return;
  }
  const email = form.elements.email.value.trim().toLowerCase();
  const { data: disponivel, error } = await supabase.rpc("email_disponivel", { p_email: email });
  if (error) {
    console.error(error);
    setStatus(form, "Não foi possível validar este e-mail agora. Tente novamente em instantes.", "error");
    return;
  }
  if (!disponivel) {
    setError(form.elements.email, "Este e-mail já está cadastrado. Entre ou use outro e-mail.");
    form.elements.email.focus();
    return;
  }
  go(2);
}

// ---------- Cursos (vêm da tabela CURSO) ----------
async function carregarCursos() {
  const select = $('select[name="course"]');
  if (!supabaseConfigured) {
    select.options[0].textContent = "Cadastro indisponível no momento";
    return;
  }
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
  if (!supabaseConfigured) return setStatus(form, "O acesso está temporariamente indisponível. Tente novamente mais tarde.", "error");
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

  showWelcome(estudante?.primeiro_nome ?? "");
}

// ---------- Cadastro ----------
async function handleSignup(form) {
  if (!supabaseConfigured) return setStatus(form, "O cadastro está temporariamente indisponível. Tente novamente mais tarde.", "error");
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
      emailRedirectTo: `${window.location.origin}/#login`,
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
  if (!data.session) {
    showEmailVerification(etapa1.get("email").trim());
    return;
  }

  // 4) com sessão: envia a foto (opcional). Falha na foto não cancela o cadastro.
  const foto = $('input[name="photo"]', form).files[0];
  if (foto) {
    try { await uploadFoto(foto, data.user.id); }
    catch (e) { console.error(e); showWelcome(primeiroNome); return; }
  }
  showWelcome(primeiroNome);
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

show(location.hash === "#cadastro" ? 1 : 0);

if (supabaseConfigured) {
  supabase.auth.getSession().then(async ({ data, error }) => {
    if (error || !data.session) return;
    const { data: estudante } = await supabase
      .from("estudante")
      .select("primeiro_nome")
      .eq("id_usuario", data.session.user.id)
      .maybeSingle();
    showWelcome(estudante?.primeiro_nome ?? "");
  }).catch(console.error);
}
