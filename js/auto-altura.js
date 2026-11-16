// js/auto-altura.js
// Toda <textarea> cresce conforme o texto digitado, até metade da altura da tela (depois aparece a rolagem).
// Quem quiser um limite de caracteres continua usando o atributo maxlength no HTML.
const limite = () => Math.round(window.innerHeight * 0.5);

function ajustar(t) {
  if (!t.offsetParent) return;                       // escondida: não dá para medir
  t.style.height = "auto";
  const borda = t.offsetHeight - t.clientHeight;
  const altura = Math.min(t.scrollHeight + borda, limite());
  t.style.height = `${altura}px`;
  t.style.overflowY = t.scrollHeight + borda > altura ? "auto" : "hidden";
}
const ajustarTodas = () => document.querySelectorAll("textarea").forEach(ajustar);

document.addEventListener("input", e => { if (e.target instanceof HTMLTextAreaElement) ajustar(e.target); });
document.addEventListener("focusin", e => { if (e.target instanceof HTMLTextAreaElement) ajustar(e.target); });
// Depois de enviar/limpar um formulário (o campo é esvaziado por código, sem evento "input")
document.addEventListener("submit", () => [150, 600, 1500].forEach(ms => setTimeout(ajustarTodas, ms)));
window.addEventListener("resize", ajustarTodas);
window.addEventListener("load", ajustarTodas);
