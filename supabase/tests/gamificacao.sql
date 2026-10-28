-- =====================================================================
-- Teste de integração da gamificação. NÃO foi executado no ambiente de desenvolvimento
-- (não havia Postgres/Supabase). Rode no SQL Editor do Supabase DEPOIS da migration.
-- Tudo acontece dentro de uma transação que termina em ROLLBACK: não deixa dados.
-- Sucesso = termina com "NOTICE: TODOS OS TESTES PASSARAM". Falha = exceção com o nome do teste.
-- =====================================================================
begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local');

create function pg_temp.como(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p::text, true);
end $$;

-- Cria, "envelhece" a sessão em p_idade minutos (o relógio do servidor é a referência) e finaliza.
create function pg_temp.sessao(p_plan int, p_idade int, p_focados int, p_resumo text) returns jsonb language plpgsql as $$
declare v uuid;
begin
  v := public.iniciar_sessao('Cálculo', 'Limites', p_plan);
  update public.gam_sessao set iniciada_em = now() - make_interval(mins => p_idade) where id = v;
  return public.finalizar_sessao(v, p_focados, p_resumo);
end $$;

do $$
declare
  a constant uuid := '00000000-0000-0000-0000-00000000000a';
  b constant uuid := '00000000-0000-0000-0000-00000000000b';
  r jsonb; v uuid; n int; falhou boolean;
begin
  perform pg_temp.como(a);

  -- 1) Pontuação: 30 min (tempo 30) + conclusão (10) + resumo (15) = 55
  r := pg_temp.sessao(25, 30, 30, 'Revisei limites laterais e continuidade.');
  assert (r->>'pontos_ganhos_agora')::int = 55, '1: pontos da sessão 1 = 55, veio ' || (r->>'pontos_ganhos_agora');
  assert (r->>'concluida')::boolean, '1: sessão concluída';
  assert (r->>'saldo')::int = 55, '1: saldo 55';
  assert r->'conquistas_novas' @> '[{"codigo":"primeira_sessao"}]', '1: desbloqueou primeira_sessao';
  assert (r->>'ja_finalizada')::boolean = false, '1: não é reenvio';

  -- 2) Idempotência: finalizar de novo não pontua
  select id into v from public.gam_sessao where id_usuario = a limit 1;
  r := public.finalizar_sessao(v, 999, 'Outro resumo qualquer aqui');
  assert (r->>'ja_finalizada')::boolean and (r->>'pontos_ganhos_agora')::int = 0, '2: reenvio não pontua';
  assert (select saldo from public.gam_perfil where id_usuario = a) = 55, '2: saldo intacto';

  -- 3) Cliente mentindo: reporta 60 min sem o servidor ter visto tempo passar
  v := public.iniciar_sessao('Cálculo', null, 25);
  r := public.finalizar_sessao(v, 60, null);
  assert (r->>'minutos_validos')::int = 0 and not (r->>'elegivel')::boolean and (r->>'pontos_ganhos_agora')::int = 0,
         '3: minutos limitados pelo relógio do servidor';

  -- 4) Sessão curta demais não pontua
  r := pg_temp.sessao(25, 5, 5, null);
  assert (r->>'pontos_ganhos_agora')::int = 0, '4: 5 min não pontua';

  -- 5) Validação de resumo (curto, longo e só espaços com resumo obrigatório)
  falhou := false;
  begin perform pg_temp.sessao(25, 30, 30, 'curto'); exception when others then falhou := true; end;
  assert falhou, '5a: resumo curto é rejeitado';
  falhou := false;
  begin perform pg_temp.sessao(25, 30, 30, repeat('x', 1001)); exception when others then falhou := true; end;
  assert falhou, '5b: resumo > 1000 é rejeitado';
  update public.gam_regra set valor = 1 where chave = 'resumo_obrigatorio';
  falhou := false;
  begin perform pg_temp.sessao(25, 30, 30, '    '); exception when others then falhou := true; end;
  assert falhou, '5c: resumo obrigatório vazio é rejeitado';
  update public.gam_regra set valor = 0 where chave = 'resumo_obrigatorio';

  -- 6) Resumo depois da sessão: bônus uma única vez; edição não paga de novo
  r := pg_temp.sessao(25, 25, 25, null);                       -- tempo 25 + conclusão 10 = 35 (saldo 90)
  assert (r->>'pontos_ganhos_agora')::int = 35, '6a: sem resumo = 35, veio ' || (r->>'pontos_ganhos_agora');
  v := (r->>'sessao_id')::uuid;
  r := public.salvar_resumo(v, 'Agora escrevi o resumo da sessão.');
  assert (r->>'pontos_ganhos_agora')::int = 15, '6b: bônus do resumo tardio';
  r := public.salvar_resumo(v, 'Editei o resumo da sessão de novo.');
  assert (r->>'pontos_ganhos_agora')::int = 0, '6c: edição não gera pontos';
  assert (select count(*) from public.gam_pontos_historico where id_sessao = v and motivo = 'resumo') = 1, '6d: 1 linha de resumo';
  assert (select resumo from public.gam_sessao where id = v) like 'Editei%', '6e: resumo atualizado e consultável';

  -- 7) Nível: saldo 105 >= 100 => nível 2 (verificado na sessão seguinte)
  assert (select nivel from public.gam_perfil where id_usuario = a) = 2, '7: nível 2 com 105 pontos';

  -- 8) Recompensa: saldo insuficiente, depois resgate, depois repetição
  falhou := false;
  begin perform public.resgatar_recompensa('moldura_prata'); exception when others then falhou := true; end;
  assert falhou, '8a: saldo insuficiente (105 < 150)';
  r := pg_temp.sessao(60, 60, 60, 'Resolvi a lista inteira de limites.');   -- 60 + 10 + 15 = 85 => 190
  assert (r->>'saldo')::int = 190, '8b: saldo 190, veio ' || (r->>'saldo');
  r := public.resgatar_recompensa('moldura_prata');
  assert (r->>'saldo')::int = 40, '8c: debitou 150';
  falhou := false;
  begin perform public.resgatar_recompensa('moldura_prata'); exception when others then falhou := true; end;
  assert falhou, '8d: resgate repetido bloqueado';
  falhou := false;
  begin perform public.resgatar_recompensa('moldura_dourada'); exception when others then falhou := true; end;
  assert falhou, '8e: requisitos (nível 4 + conquista) bloqueiam';
  assert (select saldo from public.gam_perfil where id_usuario = a) = 40, '8f: saldo nunca negativo';
  assert (select pontos from public.gam_pontos_historico where id_usuario = a and motivo = 'resgate') = -150, '8g: resgate no histórico';
  assert (select pontos_acumulados from public.gam_perfil where id_usuario = a) = 190, '8h: resgate não derruba o nível';

  -- 9) Conquistas sem duplicar
  select count(*) into n from public.gam_conquista_usuario where id_usuario = a and codigo = 'primeira_sessao';
  assert n = 1, '9: conquista única';

  -- 10) Teto diário (200): já há 190 hoje, só 10 entram
  update public.gam_regra set valor = 200 where chave = 'teto_pontos_dia';
  r := pg_temp.sessao(60, 60, 60, null);
  assert (r->>'pontos_ganhos_agora')::int = 10, '10: teto diário aplicado, veio ' || (r->>'pontos_ganhos_agora');
  update public.gam_regra set valor = 300 where chave = 'teto_pontos_dia';

  -- 11) Isolamento entre usuários e escrita direta bloqueada
  perform pg_temp.como(b);
  r := public.gam_painel();
  assert (r->'perfil'->>'saldo')::int = 0, '11a: usuário B começa zerado';
  set local role authenticated;
  assert (select count(*) from public.gam_sessao) = 0, '11b: B não enxerga sessões de A';
  assert (select count(*) from public.gam_pontos_historico) = 0, '11c: B não enxerga histórico de A';
  falhou := false;
  begin update public.gam_perfil set saldo = 999999; exception when others then falhou := true; end;
  assert falhou, '11d: update direto no saldo é negado';
  falhou := false;
  begin insert into public.gam_pontos_historico (id_usuario, motivo, pontos) values (b, 'tempo', 100); exception when others then falhou := true; end;
  assert falhou, '11e: insert direto no histórico é negado';
  falhou := false;
  begin perform public.finalizar_sessao(v, 30, null); exception when others then falhou := true; end;
  assert falhou, '11f: B não finaliza sessão de A';
  reset role;

  raise notice 'TODOS OS TESTES PASSARAM';
end $$;

rollback;
