import { PomodoroTimer } from "./pomodoro.js";
import { exigirLogin } from "./protecao.js";
import { iniciarSessao, finalizarSessao } from "./gamificacao.js";
import { supabase } from "./supabaseClient.js";
import { DISCIPLINAS, OUTRA_DISCIPLINA } from "./disciplinas.js";

const $ = id => document.getElementById(id);
const tela = { config: $("tela-configuracao"), andamento: $("tela-andamento"), resumo: $("tela-resumo"), conclusao: $("tela-conclusao") };
const TITULO_PADRAO = "Studyholics - Pomodoro";

function tocarAlarme() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.45);
    });
  } catch { /* navegador bloqueou áudio automático */ }
}

const clock = new PomodoroTimer(
  value => {
    $("timer-display-ativo").textContent = value;
    document.title = `${value} — Studyholics`;
  },
  message => {
    tocarAlarme();
    showNotice(message, "info");
  },
  count => {
    $("contador-sessao").textContent = `Sessão: ${count}`;
  },
  () => {
    tocarAlarme();
    $("btn-pausar-continuar").innerHTML = '<i class="fa-solid fa-play"></i> Continuar';
    show("resumo");
    showNotice("Todos os ciclos concluídos! Escreva um resumo (opcional) e salve sua sessão.", "info");
  }
);

let sessionId = null;
let saving = false;
let destination = null;
let gruposUsuario = [];

function disciplina() { return $("disc-nome").value === OUTRA_DISCIPLINA ? $("disc-outra").value.trim() : $("disc-nome").value; }

// [N1: Controle de tela atual e persistência em localStorage]
let telaAtual = "config";
function show(screen) {
  telaAtual = screen;
  Object.entries(tela).forEach(([key, node]) => { node.style.display = key === screen ? "block" : "none"; });
  if (screen === "conclusao" || screen === "config") document.title = TITULO_PADRAO;
  if (screen === "conclusao") limparEstado();
  else salvarEstado();
}

const CHAVE_ESTADO = "studyholics.pomodoro.v1";
const CHAVE_TUTORIAL = "studyholics.pomodoro.tutorial.v1";
const IDS_TEMPOS = ["input-foco", "input-pausa-curta", "input-pausa-longa", "input-intervalo"];
let usuarioId = null;

function limparEstado() { try { localStorage.removeItem(CHAVE_ESTADO); } catch { /* sem armazenamento */ } }
function salvarEstado() {
  if (!usuarioId || telaAtual === "conclusao") return;
  try {
    localStorage.setItem(CHAVE_ESTADO, JSON.stringify({
      v: 1, usuario: usuarioId, tela: telaAtual, sessionId,
      disc: $("disc-nome").value, outra: $("disc-outra").value, conteudo: $("disc-conteudo").value,
      resumo: $("texto-resumo").value, tempos: IDS_TEMPOS.map(id => $(id).value),
      timer: sessionId ? clock.exportar() : null,
    }));
  } catch { /* ignora */ }
}
function restaurarEstado() {
  let e = null;
  try { e = JSON.parse(localStorage.getItem(CHAVE_ESTADO)); } catch { /* ignora */ }
  if (!e || e.v !== 1 || e.usuario !== usuarioId) return;

  IDS_TEMPOS.forEach((id, i) => { const n = String(e.tempos?.[i] ?? "").replace(/\D/g, ""); if (n) $(id).value = n; });
  $("input-foco").dispatchEvent(new Event("input"));
  if (!new URLSearchParams(location.search).get("disciplina") && [...$("disc-nome").options].some(o => o.value === e.disc)) {
    $("disc-nome").value = e.disc;
    $("disc-nome").dispatchEvent(new Event("change"));
  }
  $("disc-outra").value = String(e.outra ?? "").slice(0, 100);
  $("disc-conteudo").value = String(e.conteudo ?? "").slice(0, 200);
  $("texto-resumo").value = String(e.resumo ?? "");

  if (e.sessionId && e.timer && (e.tela === "andamento" || e.tela === "resumo")) {
    sessionId = e.sessionId;
    currentDescription();
    clock.restaurar(e.timer);
    if (telaAtual !== "resumo") {
      $("contador-sessao").textContent = `Sessão: ${clock.ciclosCompletos + 1}`;
      $("btn-pausar-continuar").innerHTML = clock.rodando
        ? '<i class="fa-solid fa-pause"></i> Pausar' : '<i class="fa-solid fa-play"></i> Continuar';
      show(e.tela);
      showNotice("Sessão retomada de onde você parou.", "info");
    }
  }
}
setInterval(salvarEstado, 2000);
window.addEventListener("pagehide", salvarEstado);
document.addEventListener("visibilitychange", () => { if (document.hidden) salvarEstado(); });

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
  document.getElementById("btn-compartilhar-grupo")?.remove();
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

// Campos de tempo: só dígitos, no máximo 2
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
    $("contador-sessao").textContent = "Sessão: 1";
    $("btn-pausar-continuar").innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
    show("andamento");
  } catch (e) { showNotice(e.message); }
  finally { button.disabled = false; }
});
$("btn-pausar-continuar").addEventListener("click", toggleRunning);
$("btn-abrir-resumo").addEventListener("click", () => {
  clock.pausar();
  show("resumo");
  if (clock.minutosFocados < 1) {
    showNotice("Você focou por menos de 1 minuto. Sessões com 0 min não geram pontos.", "info");
  }
});
$("btn-cancelar-resumo").addEventListener("click", () => {
  showNotice("");
  show("andamento");
  $("btn-pausar-continuar").innerHTML = '<i class="fa-solid fa-play"></i> Continuar';
});

$("btn-salvar-sessao").addEventListener("click", async () => {
  if (!sessionId || saving) return;
  saving = true;
  const button = $("btn-salvar-sessao"); button.disabled = true; button.textContent = "Salvando…";
  try {
    const idSalvo = sessionId;
    const resumoTexto = $("texto-resumo").value.trim() || null;
    const discAtual = disciplina();
    const result = await finalizarSessao(idSalvo, clock.minutosFocados, resumoTexto);

    $("pontos-display").textContent = `${result.pontos_da_sessao || 0} pontos!`;
    $("display-tempo-final").textContent = `${result.minutos_validos || 0} min`;
    $("disc-nome-final").textContent = discAtual;
    $("disc-conteudo-final").textContent = $("disc-conteudo").value.trim() || "Sem conteúdo informado";

    document.getElementById("btn-compartilhar-grupo")?.remove();
    if (resumoTexto) {
      const norm = s => s.trim().toLocaleLowerCase("pt-BR");
      const grupoAlvo = gruposUsuario.find(g => (g.disciplinas || []).some(d => norm(d) === norm(discAtual)));
      if (grupoAlvo) {
        const btnGrupo = document.createElement("a");
        btnGrupo.id = "btn-compartilhar-grupo";
        btnGrupo.className = "btn-borda-verde";
        btnGrupo.style.marginLeft = "12px";
        btnGrupo.style.textDecoration = "none";
        btnGrupo.style.display = "inline-flex";
        btnGrupo.style.alignItems = "center";
        btnGrupo.style.gap = "8px";
        btnGrupo.href = `grupos.html?grupo=${encodeURIComponent(grupoAlvo.id)}&resumo=${encodeURIComponent(idSalvo)}`;
        btnGrupo.innerHTML = `<i class="fa-solid fa-share-nodes"></i> Publicar no grupo ${grupoAlvo.nome}`;
        $("btn-nova-sessao").parentElement.append(btnGrupo);
      }
    }

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

// [N1: Tutorial — abre sozinho só na 1ª visita]
function abrirTutorial() { $("modal-tutorial").style.display = "flex"; $("btn-fechar-tutorial").focus(); }
function fecharTutorial() {
  $("modal-tutorial").style.display = "none";
  try { localStorage.setItem(CHAVE_TUTORIAL, "1"); } catch { /* ignora */ }
}
$("btn-ajuda-pomodoro").addEventListener("click", abrirTutorial);
$("btn-fechar-tutorial").addEventListener("click", fecharTutorial);
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("modal-tutorial").style.display === "flex") fecharTutorial(); });

// [N1: init() atualizado com restauração de estado e abertura do tutorial]
async function init() {
  const sessao = await exigirLogin();
  if (!sessao) return;
  usuarioId = sessao.user.id;

  const options = new Set(DISCIPLINAS);
  const { data, error } = await supabase.rpc("grupo_listar");
  if (!error && Array.isArray(data)) {
    gruposUsuario = data;
    data.forEach(g => (g.disciplinas || []).forEach(s => options.add(s)));
  }

  $("disc-nome").replaceChildren(new Option("Selecione a disciplina", ""),
    ...[...options].sort((a, b) => a.localeCompare(b, "pt-BR")).map(s => new Option(s, s)),
    new Option("Outra (Personalizada)", OUTRA_DISCIPLINA));
  $("disc-nome").addEventListener("change", () => {
    const outra = $("disc-nome").value === OUTRA_DISCIPLINA;
    $("disc-outra").hidden = !outra;
    if (outra) $("disc-outra").focus(); else $("disc-outra").value = "";
  });

  const preselected = new URLSearchParams(location.search).get("disciplina");
  if (preselected && options.has(preselected)) $("disc-nome").value = preselected;
  if (error) showNotice("Não foi possível carregar as disciplinas dos grupos. As disciplinas padrão continuam disponíveis.", "info");

  restaurarEstado();
  let jaViu = false;
  try { jaViu = localStorage.getItem(CHAVE_TUTORIAL) === "1"; } catch { /* ignora */ }
  if (!jaViu) abrirTutorial();
}
init();