import { test } from "node:test";
import assert from "node:assert/strict";
import {
  regrasComoObjeto, validarResumo, nivelDe, progressoNivel, mensagensDeResultado,
  rotuloMotivo, textoEstadoRecompensa,
} from "../js/gamificacao-util.js";

const niveis = [
  { nivel: 1, nome: "Calouro", pontos_minimos: 0 },
  { nivel: 2, nome: "Iniciante", pontos_minimos: 100 },
  { nivel: 3, nome: "Dedicado", pontos_minimos: 300 },
];
const regras = { resumo_obrigatorio: 0, resumo_min_caracteres: 10, resumo_max_caracteres: 50 };

test("regrasComoObjeto converte linhas em mapa numérico", () => {
  assert.deepEqual(regrasComoObjeto([{ chave: "a", valor: "3" }, { chave: "b", valor: 0 }]), { a: 3, b: 0 });
  assert.deepEqual(regrasComoObjeto(null), {});
});

// ---- resumo ----
test("resumo vazio/só espaços: opcional passa sem texto, obrigatório falha", () => {
  assert.deepEqual(validarResumo("   \n ", regras), { ok: true, texto: null, erro: "" });
  const r = validarResumo("   ", { ...regras, resumo_obrigatorio: 1 });
  assert.equal(r.ok, false);
  assert.match(r.erro, /obrigatório/);
});
test("resumo: mínimo e máximo de caracteres, ignorando espaços das pontas", () => {
  assert.equal(validarResumo("curto", regras).ok, false);
  assert.equal(validarResumo("   curto    ", regras).ok, false);          // 5 chars úteis
  assert.equal(validarResumo("x".repeat(51), regras).ok, false);
  assert.equal(validarResumo("  " + "x".repeat(50) + "  ", regras).ok, true); // 50 úteis
  const ok = validarResumo("  revisei laços for e while  ", regras);
  assert.deepEqual(ok, { ok: true, texto: "revisei laços for e while", erro: "" });
});
test("resumo: null/undefined não quebram", () => {
  assert.equal(validarResumo(undefined, regras).ok, true);
  assert.equal(validarResumo(null, { ...regras, resumo_obrigatorio: 1 }).ok, false);
});

// ---- níveis ----
test("nivelDe respeita os limites exatos", () => {
  assert.equal(nivelDe(0, niveis).nivel, 1);
  assert.equal(nivelDe(99, niveis).nivel, 1);
  assert.equal(nivelDe(100, niveis).nivel, 2);
  assert.equal(nivelDe(299, niveis).nivel, 2);
  assert.equal(nivelDe(300, niveis).nivel, 3);
  assert.equal(nivelDe(99999, niveis).nivel, 3);
});
test("nivelDe funciona com catálogo fora de ordem", () => {
  assert.equal(nivelDe(150, [...niveis].reverse()).nivel, 2);
});
test("progressoNivel: percentual, faltam e nível máximo", () => {
  const p = progressoNivel(150, niveis);       // 50 de 200 até o nível 3
  assert.equal(p.atual.nivel, 2);
  assert.equal(p.proximo.nivel, 3);
  assert.equal(p.percentual, 25);
  assert.equal(p.faltam, 150);
  assert.equal(progressoNivel(0, niveis).percentual, 0);
  const max = progressoNivel(500, niveis);
  assert.deepEqual([max.proximo, max.percentual, max.faltam], [null, 100, 0]);
});

// ---- notificações ----
const base = {
  pontos_ganhos_agora: 0, ja_finalizada: false, elegivel: true, subiu_de_nivel: false,
  nivel: { nivel: 1, nome: "Calouro" }, conquistas_novas: [], recompensas_liberadas: [],
};
test("notificação: pontos, nível, conquistas e recompensas na ordem certa", () => {
  const m = mensagensDeResultado({
    ...base, pontos_ganhos_agora: 45, subiu_de_nivel: true, nivel: { nivel: 2, nome: "Iniciante" },
    conquistas_novas: [{ nome: "Primeiro passo", icone: "🎯" }],
    recompensas_liberadas: [{ nome: "Moldura prata", icone: "🥈" }],
  });
  assert.deepEqual(m.map(x => x.tipo), ["pontos", "nivel", "conquista", "recompensa"]);
  assert.equal(m[0].texto, "+45 pontos");
  assert.match(m[1].texto, /Iniciante/);
});
test("notificação: sem pontos explica o motivo (já pontuada / curta / teto diário)", () => {
  assert.match(mensagensDeResultado({ ...base, ja_finalizada: true })[0].texto, /já foi pontuada/);
  assert.match(mensagensDeResultado({ ...base, elegivel: false })[0].texto, /curta demais/);
  assert.match(mensagensDeResultado(base)[0].texto, /limite de pontos de hoje/);
  assert.equal(mensagensDeResultado({ ...base, elegivel: false })[0].tipo, "info");
});

test("rótulos e estados de recompensa", () => {
  assert.equal(rotuloMotivo("resumo"), "Resumo da sessão");
  assert.equal(rotuloMotivo("desconhecido"), "desconhecido");
  assert.equal(textoEstadoRecompensa({ estado: "resgatada" }), "Resgatada");
  assert.equal(textoEstadoRecompensa({ estado: "disponivel", custo_pontos: 150 }), "Resgatar por 150 pts");
  assert.equal(textoEstadoRecompensa({ estado: "disponivel", custo_pontos: 0 }), "Resgatar grátis");
  assert.match(textoEstadoRecompensa({ estado: "bloqueada", nivel_minimo: 4, conquista_requerida_nome: "Semana perfeita" }),
    /nível 4 e conquista "Semana perfeita"/);
});
