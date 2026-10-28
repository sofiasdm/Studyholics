// Checagens ESTÁTICAS (não executam SQL): garantem que a migration e as telas não perderam
// proteções essenciais e que tudo está registrado. O comportamento do banco é testado em
// supabase/tests/gamificacao.sql (precisa rodar no Supabase).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const sql = readFileSync("supabase/migrations/202610270001_gamificacao.sql", "utf8");
const tabelas = [...sql.matchAll(/create table if not exists public\.(gam_\w+)/g)].map(m => m[1]);

test("migration cria as 9 tabelas esperadas", () => {
  assert.deepEqual(tabelas.sort(), [
    "gam_conquista", "gam_conquista_usuario", "gam_nivel", "gam_perfil", "gam_pontos_historico",
    "gam_recompensa", "gam_regra", "gam_resgate", "gam_sessao",
  ]);
});
test("todas as tabelas têm RLS habilitado e o cliente só recebe SELECT", () => {
  for (const t of tabelas) assert.match(sql, new RegExp(`alter table public\\.${t}\\s+enable row level security`), t);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all)[^;]*to[^;]*authenticated/i);
  assert.doesNotMatch(sql, /create policy[^;]*for (insert|update|delete|all)/i);
});
test("tabelas de dados do usuário filtram por auth.uid()", () => {
  for (const t of ["gam_perfil", "gam_sessao", "gam_pontos_historico", "gam_conquista_usuario", "gam_resgate"])
    assert.match(sql, new RegExp(`on public\\.${t}\\s+for select to authenticated using \\(id_usuario = \\(select auth\\.uid\\(\\)\\)\\)`), t);
});
test("anti-duplicidade e saldo: constraints presentes", () => {
  assert.match(sql, /unique \(id_sessao, motivo\)/);
  assert.match(sql, /unique \(id_usuario, codigo\)/);
  assert.match(sql, /saldo\s+integer not null default 0 check \(saldo >= 0\)/);
  assert.match(sql, /primary key \(id_usuario, codigo\)/);
});
test("funções security definer fixam search_path e RPCs só para authenticated", () => {
  const definers = sql.split(/create or replace function/).slice(1).filter(f => /security definer/.test(f));
  assert.ok(definers.length >= 5);
  for (const f of definers) assert.match(f, /set search_path = ''/);
  assert.match(sql, /grant execute on function[\s\S]*to authenticated;/);
  assert.doesNotMatch(sql, /grant execute[^;]*to[^;]*\banon\b/i);
});
test("RPCs de escrita travam o perfil (concorrência) e usam auth.uid()", () => {
  for (const nome of ["iniciar_sessao", "finalizar_sessao", "salvar_resumo", "resgatar_recompensa", "gam_painel"]) {
    const corpo = sql.split(new RegExp(`create or replace function public\\.${nome}\\(`))[1].split("end $$;")[0];
    assert.match(corpo, /auth\.uid\(\)/, nome);
    assert.match(corpo, /gam_travar_perfil/, nome);
  }
});
test("toda regra lida por gam_regra_valor existe no seed", () => {
  const usadas = new Set([...sql.matchAll(/gam_regra_valor\('(\w+)'\)/g)].map(m => m[1]));
  const seed = sql.split("insert into public.gam_regra")[1].split("on conflict")[0];
  for (const chave of usadas) assert.match(seed, new RegExp(`'${chave}'`), chave);
  assert.ok(usadas.size >= 9);
});
test("catálogos têm seeds coerentes (níveis crescentes, recompensas apontam para conquistas existentes)", () => {
  const niveis = [...sql.matchAll(/\((\d), '[^']+',\s+(\d+)\)/g)].map(m => [+m[1], +m[2]]);
  assert.ok(niveis.length >= 5);
  for (let i = 1; i < niveis.length; i++) assert.ok(niveis[i][1] > niveis[i - 1][1]);
  const conquistas = new Set([...sql.matchAll(/^\s+\('(\w+)',\s+'[^']+',\s+'[^']+',\s+'[^']+',\s+'\w+',\s+\d+\)/gm)].map(m => m[1]));
  const exigidas = [...sql.matchAll(/'(?:titulo_focado|selo_veterano|moldura_\w+)'[^\n]*?(null|'(\w+)')\)/g)].map(m => m[2]).filter(Boolean);
  assert.ok(conquistas.size >= 10, `só ${conquistas.size} conquistas lidas`);
  assert.ok(exigidas.length >= 2);
  for (const c of exigidas) assert.ok(conquistas.has(c), `conquista inexistente: ${c}`);
});
test("páginas novas existem, estão no vite.config e o JS referenciado existe", () => {
  const vite = readFileSync("vite.config.js", "utf8");
  for (const [pagina, js] of [["conclusao-sessao", "conclusao-sessao.js"], ["gamificacao", "gamificacao-painel.js"]]) {
    assert.ok(existsSync(`pages/${pagina}.html`));
    assert.ok(existsSync(`js/${js}`));
    assert.match(readFileSync(`pages/${pagina}.html`, "utf8"), new RegExp(`../js/${js}`));
    assert.match(vite, new RegExp(`pages/${pagina}\\.html`));
  }
});
test("front nunca usa innerHTML com dados do banco", () => {
  for (const f of ["js/conclusao-sessao.js", "js/gamificacao-painel.js"])
    assert.doesNotMatch(readFileSync(f, "utf8"), /innerHTML/, f);
});
