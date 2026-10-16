// Studyholics — interface apenas. Nenhum dado é salvo ou enviado.
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
  username: "Informe seu nome de usuário.",
  password: "Informe sua senha.",
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
  if (input.name === "username" && input.minLength > 0 && v && v.length < 3) return "Use pelo menos 3 caracteres.";
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
    $(".status", form)?.removeAttribute("hidden");
  });
});

// ---------- Foto de perfil (apenas pré-visualização) ----------
$(".avatar input").addEventListener("change", e => {
  const file = e.target.files[0];
  const img = $(".avatar img");
  if (!file) return;
  img.src = URL.createObjectURL(file);
  img.hidden = false;
});

show(0);
