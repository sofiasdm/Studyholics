// js/auth.js
// Funções compartilhadas pelas telas de login e cadastro.
// Aqui NÃO há chamadas ao Supabase: só validação, mensagens e utilitários da tela.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.6M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7c1.8 0 3.3-.5 4.6-1.2"/></svg>';

// ---------- Mostrar/ocultar senha ----------
// Adiciona o botão do "olhinho" em todo campo que tenha a classe .field.password
export function ativarMostrarSenha() {
  $$(".field.password").forEach(field => {
    const input = $("input", field);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toggle";
    btn.setAttribute("aria-label", "Mostrar senha");
    btn.innerHTML = EYE;
    btn.addEventListener("click", () => {
      const oculta = input.type === "password";
      input.type = oculta ? "text" : "password";
      btn.innerHTML = oculta ? EYE_OFF : EYE;
      btn.setAttribute("aria-label", oculta ? "Ocultar senha" : "Mostrar senha");
    });
    field.append(btn);
  });
}

// ---------- Validação ----------
// Mensagens de "campo vazio", indexadas pelo atributo name do input no HTML
const messages = {
  email: "Informe um e-mail válido.",
  password: "Informe sua senha.",
  confirm: "Confirme sua senha.",
  name: "Informe seu nome.",
  sobrenome: "Informe seu sobrenome.",
  course: "Selecione seu curso.",
  semester: "Selecione seu semestre.",
  username: "Informe seu nome de usuário.",
};

// Devolve o texto do erro de um campo, ou "" se estiver tudo certo
function errorFor(input, form) {
  const valor = input.value;       // senha: não removemos espaços
  const texto = valor.trim();

  if (input.required && !texto) return messages[input.name] ?? "Preencha este campo.";

  const comprimento = input.type === "password" ? valor.length : texto.length;
  if (input.minLength > 0 && comprimento < input.minLength)
    return `Use pelo menos ${input.minLength} caracteres.`;

  if (input.name === "confirm" && valor !== form.elements.password.value)
    return "As senhas precisam ser iguais.";
  if (input.name === "username" && !/^[A-Za-z0-9_.]{3,30}$/.test(texto))
    return "Use 3 a 30 caracteres: letras, números, _ ou .";
  if (input.type === "email" && !input.checkValidity()) return messages.email;
  return "";
}

// Mostra (ou remove) a mensagem de erro logo abaixo do campo
export function setError(input, msg) {
  const field = input.closest(".field");
  if (!field) return; // ex.: o input da foto não fica dentro de um .field
  let el = field.nextElementSibling?.classList.contains("error") ? field.nextElementSibling : null;
  field.classList.toggle("invalid", Boolean(msg));
  input.setAttribute("aria-invalid", Boolean(msg));
  if (!msg) return el?.remove();
  if (!el) { el = document.createElement("p"); el.className = "error"; field.after(el); }
  el.textContent = msg;
}

// Valida todos os campos do formulário. Devolve true se estiver tudo certo
function validate(form) {
  let ok = true;
  $$("input:not([type=file]), select", form).forEach(input => {
    const msg = errorFor(input, form);
    setError(input, msg);
    if (msg) ok = false;
  });
  return ok;
}

// Liga um formulário: limpa o erro ao digitar, valida ao enviar e,
// só se estiver tudo certo, chama aoEnviar(form)
export function ligarFormulario(form, aoEnviar) {
  form.addEventListener("input", e => {
    setError(e.target, "");
    $(".status", form)?.setAttribute("hidden", "");
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!validate(form)) return;
    aoEnviar(form);
  });
}

// ---------- Mensagens e estado do botão ----------
export function setStatus(form, text, type = "ok") {
  const el = $(".status", form);
  el.textContent = text;
  el.dataset.type = type;
  el.hidden = false;
}

// Desabilita o botão enquanto a requisição roda (evita cliques duplos)
export async function withBusy(form, action) {
  const btn = $("button[type=submit]", form);
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Aguarde…";
  try {
    await action();
  } catch (err) {
    console.error(err);
    setStatus(form, "Algo deu errado. Tente novamente em instantes.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// Traduz os erros do Supabase Auth para mensagens amigáveis
export function authMessage(error) {
  switch (error.code) {
    case "invalid_credentials":    return "E-mail ou senha incorretos.";
    case "email_not_confirmed":    return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
    case "user_already_exists":
    case "email_exists":           return "Este e-mail já está cadastrado.";
    case "weak_password":          return "Senha fraca. Use pelo menos 8 caracteres.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit": return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  }
  // Erro interno do banco (ex.: falha no gatilho). Não é culpa do e-mail nem do usuário.
  if (error.message?.includes("Database error"))
    return "Erro no servidor ao criar a conta. Tente novamente ou avise a equipe.";
  return "Não foi possível concluir. Tente novamente.";
}