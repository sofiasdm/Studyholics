// js/conclusao-sessao.js
// Mostra o resultado da sessão (os pontos já foram gravados por finalizar_sessao no pomodoro)
// e permite escrever/editar o resumo depois (salvar_resumo).
import { exigirLogin } from "./protecao.js";
import { carregarRegras, buscarSessao, finalizarSessao, salvarResumo, carregarPainel } from "./gamificacao.js";
import { validarResumo, mensagensDeResultado } from "./gamificacao-util.js";

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const idSessao = params.get("s");
// Só usado se alguém abrir esta tela com a sessão ainda aberta (link antigo): finalizamos aqui.
const minutosFocados = Math.max(0, parseInt(params.get("m") ?? "0", 10) || 0);

function mostrarErroGeral(msg) { const el = $("#erro-geral"); el.textContent = msg; el.hidden = false; }

// Resultado de finalizar_sessao guardado pelo pomodoro (traz pontos, nível e conquistas)
function lerResultadoGuardado(id) {
  try { return JSON.parse(sessionStorage.getItem(`resultado:${id}`)); } catch { return null; }
}

function renderAvisos(mensagens, acrescentar = false) {
  const ul = $("#avisos");
  const itens = mensagens.map(m => {
    const li = document.createElement("li");
    li.className = m.tipo === "info" ? "info" : "";
    const ico = document.createElement("span"); ico.className = "ico"; ico.textContent = m.icone;
    const txt = document.createElement("span"); txt.textContent = m.texto;   // textContent: nada vira HTML
    li.append(ico, txt);
    return li;
  });
  if (acrescentar) ul.append(...itens); else ul.replaceChildren(...itens);
}

function mostrarSaldo(saldo, nivelNome) {
  $("#saldo-linha").textContent = `Saldo: ${saldo} pts · ${nivelNome}`;
}

async function iniciar() {
  if (!(await exigirLogin())) return;
  if (!idSessao) return mostrarErroGeral("Sessão não informada. Volte ao pomodoro e inicie uma sessão.");

  let regras, sessao, res, painel = null;
  try {
    regras = await carregarRegras();
    sessao = await buscarSessao(idSessao);
    if (!sessao) return mostrarErroGeral("Sessão não encontrada.");

    if (!sessao.finalizada_em) {
      res = await finalizarSessao(idSessao, minutosFocados, null);
      sessao = await buscarSessao(idSessao);
    } else {
      res = lerResultadoGuardado(idSessao);
    }
    if (!res) painel = await carregarPainel();
  } catch (e) { return mostrarErroGeral(e.message); }

  // ----- Resultado -----
  const minutos = sessao.minutos_validos ?? 0;
  $("#info-sessao").textContent =
    `${sessao.disciplina}${sessao.conteudo ? " — " + sessao.conteudo : ""} · ${minutos} min de foco`;
  $("#pontos-sessao").textContent = `+${res?.pontos_da_sessao ?? sessao.pontos_ganhos ?? 0}`;
  if (res) mostrarSaldo(res.saldo, res.nivel.nome);
  else mostrarSaldo(painel.perfil.saldo, painel.perfil.nivel_nome);
  renderAvisos(res ? mensagensDeResultado(res) : []);
  $("#etapa-resultado").hidden = false;

  // ----- Resumo (opcional) -----
  const max = regras.resumo_max_caracteres ?? 1000;
  const bonus = regras.bonus_resumo ?? 0;
  const area = $("#resumo");
  area.maxLength = max;
  area.value = sessao.resumo ?? "";
  $("#dica-resumo").textContent =
    "Opcional. " + (!sessao.resumo && sessao.elegivel && bonus ? `Escrever o resumo rende +${bonus} pontos. ` : "") +
    `Entre ${regras.resumo_min_caracteres} e ${max} caracteres.`;
  $("#btn-enviar").textContent = sessao.resumo ? "Atualizar resumo" : "Salvar resumo";
  const atualizarContador = () => ($("#contador").textContent = `${area.value.trim().length}/${max}`);
  atualizarContador();
  area.addEventListener("input", () => { atualizarContador(); area.classList.remove("invalid"); $("#erro-resumo").textContent = ""; });
  $("#etapa-resumo").hidden = false;

  $("#form-resumo").addEventListener("submit", async e => {
    e.preventDefault();
    const v = validarResumo(area.value, regras);
    const erro = v.ok && !v.texto ? "Escreva o resumo para salvar." : v.erro;
    if (erro) { area.classList.add("invalid"); $("#erro-resumo").textContent = erro; return; }

    const btn = $("#btn-enviar"); btn.disabled = true;
    const st = $("#status");
    try {
      const r = await salvarResumo(idSessao, v.texto);
      $("#pontos-sessao").textContent = `+${r.pontos_da_sessao}`;
      mostrarSaldo(r.saldo, r.nivel.nome);
      renderAvisos(mensagensDeResultado(r), true);
      st.textContent = "Resumo salvo!"; st.dataset.type = "ok"; st.hidden = false;
      btn.textContent = "Atualizar resumo";
    } catch (err) {
      st.textContent = err.message; st.dataset.type = "error"; st.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}
iniciar();