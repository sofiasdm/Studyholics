// js/pomodoro-pagina.js
// Tela "Nova sessão" + cronômetro. Ao clicar em "Finalizar sessão" a sessão é encerrada
// no banco (os pontos já são gravados); o resumo é escrito depois, na tela de conclusão.
import { PomodoroTimer } from "./pomodoro.js";
import { exigirLogin } from "./protecao.js";
import { iniciarSessao, finalizarSessao } from "./gamificacao.js";
import { DISCIPLINAS, MAX_TOPICO } from "./disciplinas.js";

const $ = id => document.getElementById(id);

const display = $("timer-display");
const btnAcao = $("btn-acao");
const btnVoltar = $("btn-voltar");
const btnFinalizar = $("btn-finalizar");
const telaConfig = $("tela-configuracao");
const telaAndamento = $("tela-andamento");
const contadorSessao = $("contador-sessao");
const selDisciplina = $("sel-disciplina");
const inputTopico = $("input-topico");
const resumoSessao = $("resumo-sessao");
const aviso = $("aviso");

let sessaoId = null;        // sessão aberta no banco
let finalizando = false;

// ---------- Avisos na tela (no lugar de alert) ----------
function avisar(texto, tipo = "erro") {
  aviso.textContent = texto;
  aviso.dataset.tipo = tipo;
}
const limparAviso = () => avisar("", "info");

// ---------- Cronômetro ----------
const pomodoro = new PomodoroTimer(
  tempo => { display.textContent = tempo; },
  msg => avisar(msg, "info"),
  n => { contadorSessao.textContent = `Sessão: ${n}`; }
);

// ---------- Formulário ----------
function preencherDisciplinas() {
  selDisciplina.replaceChildren(new Option("Selecione a disciplina", ""));
  DISCIPLINAS.forEach(nome => selDisciplina.append(new Option(nome, nome)));
  inputTopico.maxLength = MAX_TOPICO;
}

// Lê e valida os tempos. Devolve null (e mostra o aviso) se algo estiver inválido.
function lerConfig() {
  const ler = id => Number($(id).value);
  const cfg = {
    foco: ler("input-foco"),
    pausaCurta: ler("input-pausa-curta"),
    pausaLonga: ler("input-pausa-longa"),
    intervalosPausaLonga: ler("input-intervalo"),
  };
  const invalido = Object.values(cfg).some(v => !Number.isInteger(v) || v < 1);
  if (invalido) { avisar("Os tempos precisam ser números inteiros de 1 em diante."); return null; }
  if (cfg.foco > 240) { avisar("O pomodoro pode ter no máximo 240 minutos."); return null; }
  return cfg;
}

function modoAndamento(ativo) {
  telaConfig.style.display = ativo ? "none" : "block";
  telaAndamento.style.display = ativo ? "block" : "none";
}

function rotuloBotao(rodando) {
  btnAcao.innerHTML = rodando ? "⏸ Pausar" : "▶ Continuar";
  btnAcao.style.backgroundColor = rodando ? "#6c757d" : "#48bb78";
}

// ---------- Começar / Pausar / Continuar ----------
btnAcao.addEventListener("click", async () => {
  limparAviso();

  if (pomodoro.rodando) {
    pomodoro.pausar();
    rotuloBotao(false);
    return;
  }

  if (!sessaoId) {
    const disciplina = selDisciplina.value;
    if (!disciplina) { avisar("Escolha a disciplina."); selDisciplina.focus(); return; }
    const cfg = lerConfig();
    if (!cfg) return;

    btnAcao.disabled = true;
    try {
      sessaoId = await iniciarSessao(disciplina, inputTopico.value.trim(), cfg.foco);
    } catch (e) {
      avisar(e.message);
      btnAcao.disabled = false;
      return;
    }
    btnAcao.disabled = false;

    // Configura só ao começar de verdade: "Continuar" não pode reiniciar o relógio
    pomodoro.resetar();
    pomodoro.configurar(cfg);
    contadorSessao.textContent = "Sessão: 1";
    resumoSessao.textContent = inputTopico.value.trim() ? `${disciplina} — ${inputTopico.value.trim()}` : disciplina;
    modoAndamento(true);
  }

  pomodoro.iniciar();
  rotuloBotao(true);
});

// ---------- Voltar (abandona a sessão, sem pontos) ----------
btnVoltar.addEventListener("click", () => {
  if (pomodoro.minutosFocados >= 1 &&
      !confirm("Voltar descarta esta sessão e você não ganha pontos. Para salvar, use “Finalizar sessão”. Descartar mesmo assim?")) {
    return;
  }
  pomodoro.resetar();
  sessaoId = null; // o banco descarta a sessão aberta (sem pontos) quando a próxima começar
  limparAviso();
  btnAcao.innerHTML = "▶ Começar";
  btnAcao.style.backgroundColor = "#48bb78";
  modoAndamento(false);
});

// ---------- Finalizar: grava a sessão e os pontos agora; resumo fica para depois ----------
btnFinalizar.addEventListener("click", async () => {
  if (!sessaoId || finalizando) return;
  limparAviso();
  pomodoro.pausar();
  rotuloBotao(false);
  const minutos = pomodoro.minutosFocados;

  finalizando = true;
  btnFinalizar.disabled = true;
  const textoOriginal = btnFinalizar.textContent;
  btnFinalizar.textContent = "Salvando…";
  try {
    const resultado = await finalizarSessao(sessaoId, minutos, null);
    // A tela de conclusão usa isto para mostrar pontos, nível e conquistas
    try { sessionStorage.setItem(`resultado:${sessaoId}`, JSON.stringify(resultado)); } catch { /* sem storage: tudo bem */ }
    location.href = `conclusao-sessao.html?s=${encodeURIComponent(sessaoId)}`;
  } catch (e) {
    finalizando = false;
    btnFinalizar.disabled = false;
    btnFinalizar.textContent = textoOriginal;
    avisar(e.message); // pode tentar de novo: finalizar_sessao é idempotente
  }
});

// Evita fechar a aba sem querer no meio de uma sessão
window.addEventListener("beforeunload", e => {
  if (sessaoId && !finalizando) e.preventDefault();
});

// ---------- Início ----------
async function iniciar() {
  preencherDisciplinas();
  btnAcao.disabled = true;
  if (!(await exigirLogin())) return;
  btnAcao.disabled = false;
}
iniciar();