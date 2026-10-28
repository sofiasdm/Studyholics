// js/conclusao-sessao.js
// Fecha a sessão (finalizar_sessao) ou edita o resumo de uma sessão já finalizada (salvar_resumo),
// e mostra o feedback de pontos, nível, conquistas e recompensas.
import { exigirLogin } from "./protecao.js";
import { carregarRegras, buscarSessao, finalizarSessao, salvarResumo } from "./gamificacao.js";
import { validarResumo, mensagensDeResultado } from "./gamificacao-util.js";

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const idSessao = params.get("s");
// Minutos focados reportados pelo pomodoro. O servidor limita pelo relógio dele, então não é confiável por si só.
const minutosFocados = Math.max(0, parseInt(params.get("m") ?? "0", 10) || 0);

function mostrarErroGeral(msg) { const el = $("#erro-geral"); el.textContent = msg; el.hidden = false; }

function mostrarResultado(res) {
  $("#etapa-resumo").hidden = true;
  $("#etapa-resultado").hidden = false;
  $("#pontos-sessao").textContent = `+${res.pontos_ganhos_agora}`;
  $("#saldo-linha").textContent = `Saldo: ${res.saldo} pts · ${res.nivel.nome}`;
  const ul = $("#avisos");
  ul.replaceChildren(...mensagensDeResultado(res).map(m => {
    const li = document.createElement("li");
    li.className = m.tipo === "info" ? "info" : "";
    const ico = document.createElement("span"); ico.className = "ico"; ico.textContent = m.icone;
    const txt = document.createElement("span"); txt.textContent = m.texto;   // textContent: nada vira HTML
    li.append(ico, txt);
    return li;
  }));
}

async function iniciar() {
  if (!(await exigirLogin())) return;
  if (!idSessao) return mostrarErroGeral("Sessão não informada. Volte ao pomodoro e inicie uma sessão.");

  let regras, sessao;
  try { [regras, sessao] = await Promise.all([carregarRegras(), buscarSessao(idSessao)]); }
  catch (e) { return mostrarErroGeral(e.message); }
  if (!sessao) return mostrarErroGeral("Sessão não encontrada.");

  const finalizada = Boolean(sessao.finalizada_em);
  const max = regras.resumo_max_caracteres ?? 1000;
  const obrigatorio = regras.resumo_obrigatorio === 1;
  const area = $("#resumo");
  area.maxLength = max;
  area.value = sessao.resumo ?? "";
  $("#info-sessao").textContent = `${sessao.disciplina}${sessao.conteudo ? " — " + sessao.conteudo : ""}`;
  $("#dica-resumo").textContent = (obrigatorio ? "Obrigatório. " : "Opcional, mas rende pontos extras. ") +
    `Entre ${regras.resumo_min_caracteres} e ${max} caracteres.`;
  $("#btn-enviar").textContent = finalizada ? "Salvar resumo" : "Finalizar sessão";
  const atualizarContador = () => ($("#contador").textContent = `${area.value.trim().length}/${max}`);
  atualizarContador();
  area.addEventListener("input", () => { atualizarContador(); area.classList.remove("invalid"); $("#erro-resumo").textContent = ""; });
  $("#etapa-resumo").hidden = false;

  $("#form-resumo").addEventListener("submit", async e => {
    e.preventDefault();
    const v = validarResumo(area.value, regras);
    // Sessão já finalizada: salvar resumo exige conteúdo
    const erro = v.ok && finalizada && !v.texto ? "Escreva o resumo para salvar." : v.erro;
    if (erro) { area.classList.add("invalid"); $("#erro-resumo").textContent = erro; return; }

    const btn = $("#btn-enviar"); btn.disabled = true;
    try {
      const res = finalizada
        ? await salvarResumo(idSessao, v.texto)
        : await finalizarSessao(idSessao, minutosFocados, v.texto);
      mostrarResultado(res);
    } catch (err) {
      const st = $("#status"); st.textContent = err.message; st.dataset.type = "error"; st.hidden = false;
      btn.disabled = false;
    }
  });
}
iniciar();
