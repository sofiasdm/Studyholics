import { PomodoroTimer } from "./pomodoro.js";
import { exigirLogin } from "./protecao.js";
import { iniciarSessao, finalizarSessao } from "./gamificacao.js";
import { supabase } from "./supabaseClient.js";
import { DISCIPLINAS, OUTRA_DISCIPLINA } from "./disciplinas.js";

const $ = id => document.getElementById(id);
const tela = { config: $("tela-configuracao"), andamento: $("tela-andamento"), resumo: $("tela-resumo"), conclusao: $("tela-conclusao") };
const clock = new PomodoroTimer(value => { $("timer-display-ativo").textContent = value; }, message => showNotice(message, "info"), count => { $("contador-sessao").textContent = `Sessão: ${count}`; });
let sessionId = null;
let saving = false;
let destination = null;

function disciplina() { return $("disc-nome").value === OUTRA_DISCIPLINA ? $("disc-outra").value.trim() : $("disc-nome").value; }
function show(screen) { Object.entries(tela).forEach(([key, node]) => { node.style.display = key === screen ? "block" : "none"; }); }
function showNotice(message, kind = "error") { const box = $("pomodoro-aviso"); box.textContent = message; box.dataset.kind = kind; box.hidden = !message; }
function config() {
  const names = { foco: "input-foco", pausaCurta: "input-pausa-curta", pausaLonga: "input-pausa-longa", intervalosPausaLonga: "input-intervalo" };
  const result = Object.fromEntries(Object.entries(names).map(([key, id]) => [key, Number($(id).value)]));
  const invalido = Object.entries(names).some(([key, id]) => !Number.isInteger(result[key]) || result[key] < 1 || result[key] > Number($(id).max));
  if (invalido) throw new Error("Informe valores inteiros dentro dos limites de cada campo (foco e pausas até 60, intervalo até 10).");
  return result;
}
function toggleRunning() {
  const button = $("btn-pausar-continuar");
  if (clock.rodando) { clock.pausar(); button.innerHTML = '<i class="fa-solid fa-play"></i> Continuar'; }
  else { clock.iniciar(); button.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar'; }
}
function reset() {
  clock.resetar(); sessionId = null;
  $("texto-resumo").value = "";
  $("timer-display-inicial").textContent = `${String($("input-foco").value).padStart(2, "0")}:00`;
  show("config");
  showNotice("");
}
async function discard() {
  if (sessionId) {
    clock.pausar();
    await finalizarSessao(sessionId, 0, null);
  }
  reset();
}
function currentDescription() {
  $("disc-nome-ativo").textContent = disciplina();
  $("disc-conteudo-ativo").textContent = $("disc-conteudo").value.trim() || "Sem conteúdo informado";
}

// Campos de tempo: só dígitos, no máximo 2, valor máximo 240
document.querySelectorAll(".config-tempos input").forEach(input => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 2);
    if (Number(input.value) > Number(input.max)) input.value = input.max;
  });
});

$("input-foco").addEventListener("input", () => { const n = Math.max(1, Number($("input-foco").value) || 1); $("timer-display-inicial").textContent = `${String(n).padStart(2, "0")}:00`; });
$("btn-iniciar-sessao").addEventListener("click", async () => {
  showNotice("");
  const button = $("btn-iniciar-sessao"); button.disabled = true;
  try {
    if (!disciplina()) throw new Error($("disc-nome").value === OUTRA_DISCIPLINA ? "Digite o nome da disciplina." : "Escolha uma disciplina.");
    const values = config();
    sessionId = await iniciarSessao(disciplina(), $("disc-conteudo").value.trim(), values.foco);
    clock.resetar(); clock.configurar(values); currentDescription(); clock.iniciar();
    $("btn-pausar-continuar").innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
    show("andamento");
  } catch (e) { showNotice(e.message); }
  finally { button.disabled = false; }
});
$("btn-pausar-continuar").addEventListener("click", toggleRunning);
$("btn-abrir-resumo").addEventListener("click", () => { clock.pausar(); show("resumo"); });
$("btn-cancelar-resumo").addEventListener("click", () => { show("andamento"); $("btn-pausar-continuar").innerHTML = '<i class="fa-solid fa-play"></i> Continuar'; });

$("btn-salvar-sessao").addEventListener("click", async () => {
  if (!sessionId || saving) return;
  saving = true;
  const button = $("btn-salvar-sessao"); button.disabled = true; button.textContent = "Salvando…";
  try {
    const result = await finalizarSessao(sessionId, clock.minutosFocados, $("texto-resumo").value.trim() || null);
    $("pontos-display").textContent = `${result.pontos_da_sessao || 0} pontos!`;
    $("display-tempo-final").textContent = `${result.minutos_validos || 0} min`;
    $("disc-nome-final").textContent = disciplina();
    $("disc-conteudo-final").textContent = $("disc-conteudo").value.trim() || "Sem conteúdo informado";
    sessionId = null;
    show("conclusao"); showNotice("");
  } catch (e) { showNotice(e.message); }
  finally { saving = false; button.disabled = false; button.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Salvar sessão'; }
});
$("btn-nova-sessao").addEventListener("click", reset);
$("btn-desistir").addEventListener("click", () => { $("modal-aviso-saida").style.display = "flex"; destination = null; });
$("btn-ficar").addEventListener("click", () => { $("modal-aviso-saida").style.display = "none"; destination = null; });
$("btn-confirmar-saida").addEventListener("click", async () => {
  const button = $("btn-confirmar-saida"); button.disabled = true;
  try {
    const next = destination;
    await discard(); $("modal-aviso-saida").style.display = "none";
    if (next === "SIGN_OUT") { await supabase.auth.signOut(); location.href = "../index.html"; }
    else if (next) location.href = next;
  }
  catch (e) { showNotice(e.message); }
  finally { button.disabled = false; }
});
document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", event => {
  if (link.textContent.trim() === "Sair" && !sessionId) { event.preventDefault(); supabase.auth.signOut().then(() => location.href = "../index.html"); return; }
  if (!sessionId) return;
  event.preventDefault(); destination = link.textContent.trim() === "Sair" ? "SIGN_OUT" : link.href;
  $("modal-aviso-saida").style.display = "flex";
}));
window.addEventListener("beforeunload", event => { if (sessionId && !saving) event.preventDefault(); });

async function init() {
  if (!(await exigirLogin())) return;
  const options = new Set(DISCIPLINAS);
  const { data, error } = await supabase.rpc("grupo_listar");
  if (!error) data.forEach(g => (g.disciplinas || []).forEach(s => options.add(s)));
  $("disc-nome").replaceChildren(new Option("Selecione a disciplina", ""),
    ...[...options].sort((a, b) => a.localeCompare(b, "pt-BR")).map(s => new Option(s, s)),
    new Option("Outra (Personalizada)", OUTRA_DISCIPLINA));
  $("disc-nome").addEventListener("change", () => {
    const outra = $("disc-nome").value === OUTRA_DISCIPLINA;
    $("disc-outra").hidden = !outra;
    if (outra) $("disc-outra").focus(); else $("disc-outra").value = "";
  });
}
init();