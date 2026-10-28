// js/gamificacao-painel.js
// Painel: saldo, nível/progresso, conquistas, recompensas, histórico e resumos.
import { exigirLogin } from "./protecao.js";
import { carregarPainel, resgatarRecompensa, listarResumos } from "./gamificacao.js";
import { progressoNivel, rotuloMotivo, textoEstadoRecompensa } from "./gamificacao-util.js";

const $ = s => document.querySelector(s);

// Cria elemento com texto seguro (textContent): dados vindos do banco nunca viram HTML.
function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...filhos);
  return e;
}
const data = iso => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function renderNivel(p, niveis) {
  $("#saldo").textContent = `${p.saldo} pts`;
  const pr = progressoNivel(p.pontos_acumulados, niveis);
  $("#nivel-nome").textContent = `${pr.atual.nome} (nv. ${pr.atual.nivel})`;
  $("#barra-i").style.width = `${pr.percentual}%`;
  $("#barra").setAttribute("aria-valuenow", pr.percentual);
  $("#progresso-texto").textContent = pr.proximo
    ? `${p.pontos_acumulados} pts acumulados · faltam ${pr.faltam} para ${pr.proximo.nome}`
    : `${p.pontos_acumulados} pts acumulados · nível máximo!`;
}

function renderConquistas(lista) {
  $("#conquistas").replaceChildren(...lista.map(c => el("div", { className: `item ${c.obtida_em ? "ok" : "bloqueado"}` },
    el("span", { className: "ico", textContent: c.icone }),
    el("strong", { textContent: c.nome }),
    el("span", { className: "muted", textContent: c.descricao }),
    el("span", { className: "muted", textContent: c.obtida_em ? `Obtida em ${data(c.obtida_em)}` : "Pendente" }))));
}

function renderRecompensas(lista) {
  $("#recompensas").replaceChildren(...lista.map(r => {
    const btn = el("button", { className: "btn", type: "button", textContent: textoEstadoRecompensa(r) });
    btn.disabled = r.estado !== "disponivel";
    btn.addEventListener("click", async () => {
      if (!confirm(`Resgatar "${r.nome}"${r.custo_pontos ? ` por ${r.custo_pontos} pontos` : ""}?`)) return;
      btn.disabled = true;
      try { await resgatarRecompensa(r.codigo); await carregar(); }
      catch (e) { alert(e.message); btn.disabled = false; }
    });
    return el("div", { className: `item ${r.estado === "bloqueada" ? "bloqueado" : r.estado === "resgatada" ? "ok" : ""}` },
      el("span", { className: "ico", textContent: r.icone }),
      el("strong", { textContent: r.nome }),
      el("span", { className: "muted", textContent: r.descricao }), btn);
  }));
}

function renderHistorico(lista) {
  $("#historico").replaceChildren(...(lista.length ? lista.map(h => el("li", {},
    el("span", { textContent: `${rotuloMotivo(h.motivo)} · ${data(h.criado_em)}` }),
    el("span", { className: h.pontos > 0 ? "pos" : "neg", textContent: `${h.pontos > 0 ? "+" : ""}${h.pontos}` })))
    : [el("li", { textContent: "Nenhum ponto ainda. Faça uma sessão de estudo!" })]));
}

async function renderResumos() {
  const lista = await listarResumos();
  $("#resumos").replaceChildren(...(lista.length ? lista.map(s => el("div", { className: "resumo-item" },
    el("strong", { textContent: `${s.disciplina}${s.conteudo ? " — " + s.conteudo : ""} · ${data(s.finalizada_em)}` }),
    el("p", { textContent: s.resumo }),
    el("a", { href: `conclusao-sessao.html?s=${encodeURIComponent(s.id)}`, textContent: "Editar" })))
    : [el("p", { className: "muted", textContent: "Você ainda não escreveu resumos." })]));
}

async function carregar() {
  try {
    const painel = await carregarPainel();
    renderNivel(painel.perfil, painel.niveis);
    renderConquistas(painel.conquistas);
    renderRecompensas(painel.recompensas);
    renderHistorico(painel.historico);
    await renderResumos();
  } catch (e) {
    const er = $("#erro-geral"); er.textContent = e.message; er.hidden = false;
  }
}

exigirLogin().then(sessao => { if (sessao) carregar(); });
