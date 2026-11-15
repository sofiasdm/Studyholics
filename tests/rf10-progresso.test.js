import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Exercita as funções reais da página com DOM e Supabase simulados. Nenhum teste
// abre conexão, grava no banco ou modifica arquivos da aplicação.
const html = readFileSync(new URL("../pages/pagina-inicial.html", import.meta.url), "utf8");
const original = readFileSync(new URL("../js/pagina-inicial.js", import.meta.url), "utf8");
const semImports = original.replace(/^import\s+.*?;\s*$/gm, "");
const codigo = semImports.replace(/\biniciar\(\);\s*$/, "");
assert.notEqual(semImports, original, "Imports da página não foram identificados");
assert.notEqual(codigo, semImports, "Inicialização da página não foi identificada");

const AGORA = "2026-11-11T15:00:00.000Z"; // quarta-feira, meio-dia em São Paulo
class DataFixa extends Date {
  constructor(...args) { super(...(args.length ? args : [AGORA])); }
  static now() { return new Date(AGORA).getTime(); }
}

function elemento() {
  return {
    textContent: "", className: "", title: "", hidden: true, style: {}, children: [],
    append(...filhos) { this.children.push(...filhos); },
    replaceChildren(...filhos) { this.children = filhos; },
    addEventListener() {},
  };
}

function pagina({ sessoes = [], pontos = 0, saldo = pontos, usuario = "A" } = {}) {
  const estado = { pontos, saldo };
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const elementos = new Map(ids.map(id => [id, elemento()]));
  const eventos = [];
  const intervalos = [];
  const documento = {
    getElementById: id => elementos.get(id) ?? null,
    createElement: () => elemento(),
  };
  const tabela = nome => {
    const consulta = {
      select() { return this; }, eq() { return this; }, not() { return this; },
      order() { return this; }, limit() { return this; }, maybeSingle() { return this; },
      then(resolve, reject) {
        const data = nome === "estudante"
          ? { primeiro_nome: usuario }
          : sessoes.filter(s => s.finalizada_em).map(s => ({ ...s }));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return consulta;
  };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: usuario } } } }) },
    from: tabela,
    channel: () => ({
      on(_tipo, _filtro, fn) { eventos.push(fn); return this; },
      subscribe() { return this; },
    }),
  };
  const contexto = {
    document: documento, supabase, Date: DataFixa, Intl, console,
    exigirLogin: async () => true,
    carregarPainel: async () => ({ perfil: { pontos_acumulados: estado.pontos, saldo: estado.saldo, nivel: 2, nivel_nome: "Iniciante" } }),
    setTimeout: fn => { fn(); return 1; },
    setInterval: fn => { intervalos.push(fn); return intervalos.length; },
    window: { location: { href: "" } },
  };
  runInNewContext(codigo, contexto, { filename: "js/pagina-inicial.js" });
  return {
    contexto, estado, sessoes, eventos, intervalos,
    get: id => documento.getElementById(id),
    iniciar: () => contexto.iniciar(),
  };
}

test("RF10/CT11: reabertura com dados persistidos mantém horas e histórico", async () => {
  const dados = [
    { disciplina: "Matemática", conteudo: "Funções", finalizada_em: "2026-11-09T15:00:00Z", minutos_validos: 30 },
    { disciplina: "História", conteudo: "Brasil", finalizada_em: "2026-11-10T15:00:00Z", minutos_validos: 45 },
  ];
  const primeira = pagina({ sessoes: dados, pontos: 85 });
  await primeira.iniciar();
  assert.equal(primeira.get("horas-total").textContent, "1h 15min");
  assert.equal(primeira.get("pontos-total").textContent, "85 pts");
  assert.equal(primeira.get("lista-sessoes").children.length, 2);

  // Novo contexto equivale a abrir a página novamente com os mesmos dados persistidos.
  const reaberta = pagina({ sessoes: dados, pontos: 85 });
  await reaberta.iniciar();
  assert.equal(reaberta.get("horas-total").textContent, "1h 15min");
  assert.equal(reaberta.get("pontos-total").textContent, "85 pts");
  assert.equal(reaberta.get("lista-sessoes").children.length, 2);
});

test("RF10/CT13: repetir a leitura não duplica os pontos exibidos", async () => {
  const tela = pagina({ pontos: 190, saldo: 40 });
  await tela.iniciar();
  assert.equal(tela.get("pontos-total").textContent, "190 pts");
  // Simula duas respostas idênticas do backend para a mesma sessão.
  tela.contexto.renderPainel({ perfil: { pontos_acumulados: 190, saldo: 40, nivel: 2, nivel_nome: "Iniciante" } });
  assert.equal(tela.get("pontos-total").textContent, "190 pts");
});

test("RF10/CT17: painel informa o total de sessões concluídas", async () => {
  const tela = pagina({ sessoes: [
    { disciplina: "A", finalizada_em: "2026-11-09T15:00:00Z", minutos_validos: 25 },
    { disciplina: "B", finalizada_em: "2026-11-10T15:00:00Z", minutos_validos: 30 },
  ] });
  await tela.iniciar();
  const indicador = tela.get("sessoes-total");
  assert.ok(indicador, "Falta o indicador #sessoes-total no dashboard");
  assert.equal(indicador.textContent, "2");
});

test("RF10: gráfico e métricas atualizam após nova sessão sem recarregar", async () => {
  const tela = pagina({ sessoes: [
    { disciplina: "A", finalizada_em: "2026-11-09T15:00:00Z", minutos_validos: 60 },
    { disciplina: "B", finalizada_em: "2026-11-11T15:00:00Z", minutos_validos: 30 },
  ], pontos: 100 });
  await tela.iniciar();
  assert.equal(tela.get("meta-texto").textContent, "1h 30min de 6h da meta semanal");
  assert.equal(tela.get("barra-0").title, "1h 0min");
  assert.equal(tela.get("barra-2").title, "30min");

  tela.sessoes.push({ disciplina: "C", finalizada_em: "2026-11-11T16:00:00Z", minutos_validos: 30 });
  tela.estado.pontos = 130;
  for (const avisar of tela.eventos) avisar({ eventType: "INSERT" });
  for (const atualizar of tela.intervalos) atualizar();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(tela.get("horas-total").textContent, "2h 0min", "Horas não foram atualizadas após a atividade");
  assert.equal(tela.get("pontos-total").textContent, "130 pts");
  assert.equal(tela.get("meta-texto").textContent, "2h 0min de 6h da meta semanal");
  assert.equal(tela.get("barra-2").title, "1h 0min");
});
