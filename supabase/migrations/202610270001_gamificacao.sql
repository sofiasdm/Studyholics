-- =====================================================================
-- Studyholics — Gamificação (pontos, resumos, níveis, conquistas, recompensas)
-- Rode este arquivo no SQL Editor do Supabase (ou via supabase db push).
-- O motor de cálculo vive AQUI (funções security definer); o front só chama RPCs.
-- =====================================================================

-- ---------- 1. Regras configuráveis (única fonte dos valores) ----------
create table if not exists public.gam_regra (
  chave     text primary key,
  valor     integer not null check (valor >= 0),
  descricao text not null
);

insert into public.gam_regra (chave, valor, descricao) values
  ('minutos_minimos',            10,   'Minutos de foco mínimos para a sessão pontuar'),
  ('pontos_por_minuto',          1,    'Pontos por minuto de foco válido'),
  ('minutos_maximos_pontuaveis', 120,  'Teto de minutos que contam em uma única sessão'),
  ('percentual_conclusao',       90,   '% do pomodoro planejado para a sessão contar como concluída'),
  ('bonus_conclusao',            10,   'Bônus por concluir o pomodoro planejado'),
  ('bonus_resumo',               15,   'Bônus por registrar o resumo da sessão (pago uma única vez por sessão)'),
  ('resumo_obrigatorio',         0,    '1 = não é possível finalizar a sessão sem resumo; 0 = resumo opcional'),
  ('resumo_min_caracteres',      10,   'Mínimo de caracteres de um resumo (após remover espaços das pontas)'),
  ('resumo_max_caracteres',      1000, 'Máximo de caracteres de um resumo'),
  ('teto_pontos_dia',            300,  'Máximo de pontos ganhos por dia (fuso America/Sao_Paulo)')
on conflict (chave) do nothing;

-- ---------- 2. Catálogos ----------
create table if not exists public.gam_nivel (
  nivel         integer primary key check (nivel >= 1),
  nome          text not null,
  pontos_minimos integer not null unique check (pontos_minimos >= 0)
);

insert into public.gam_nivel (nivel, nome, pontos_minimos) values
  (1, 'Calouro',   0),
  (2, 'Iniciante', 100),
  (3, 'Dedicado',  300),
  (4, 'Focado',    700),
  (5, 'Veterano',  1500),
  (6, 'Mestre',    3000),
  (7, 'Lenda',     6000)
on conflict (nivel) do nothing;

-- tipo_criterio: sessoes_concluidas | minutos_totais | resumos_escritos
--                | pontos_acumulados | nivel_atingido | sequencia_dias
create table if not exists public.gam_conquista (
  codigo         text primary key,
  nome           text not null,
  descricao      text not null,
  icone          text not null,
  tipo_criterio  text not null check (tipo_criterio in
    ('sessoes_concluidas','minutos_totais','resumos_escritos','pontos_acumulados','nivel_atingido','sequencia_dias')),
  valor_criterio integer not null check (valor_criterio > 0),
  ativa          boolean not null default true
);

insert into public.gam_conquista (codigo, nome, descricao, icone, tipo_criterio, valor_criterio) values
  ('primeira_sessao', 'Primeiro passo',    'Conclua sua primeira sessão de estudo.',     '🎯', 'sessoes_concluidas', 1),
  ('sessoes_5',       'Pegando o ritmo',   'Conclua 5 sessões de estudo.',               '🔥', 'sessoes_concluidas', 5),
  ('sessoes_25',      'Rotina de estudo',  'Conclua 25 sessões de estudo.',              '🏅', 'sessoes_concluidas', 25),
  ('foco_60',         'Uma hora de foco',  'Acumule 60 minutos de foco.',                '⏱️', 'minutos_totais',     60),
  ('foco_600',        'Maratonista',       'Acumule 10 horas de foco.',                  '🏃', 'minutos_totais',     600),
  ('resumo_1',        'Anotador',          'Escreva seu primeiro resumo pós-sessão.',    '📝', 'resumos_escritos',   1),
  ('resumos_10',      'Memória de ferro',  'Escreva 10 resumos pós-sessão.',             '📚', 'resumos_escritos',   10),
  ('pontos_500',      'Meio milhar',       'Acumule 500 pontos.',                        '💎', 'pontos_acumulados',  500),
  ('nivel_3',         'Subindo de nível',  'Alcance o nível 3.',                         '🚀', 'nivel_atingido',     3),
  ('sequencia_3',     'Constância',        'Estude 3 dias seguidos.',                    '📅', 'sequencia_dias',     3),
  ('sequencia_7',     'Semana perfeita',   'Estude 7 dias seguidos.',                    '🌟', 'sequencia_dias',     7)
on conflict (codigo) do nothing;

-- custo_pontos = 0 significa recompensa "liberada" apenas pelos requisitos.
create table if not exists public.gam_recompensa (
  codigo               text primary key,
  nome                 text not null,
  descricao            text not null,
  icone                text not null,
  custo_pontos         integer not null default 0 check (custo_pontos >= 0),
  nivel_minimo         integer not null default 1 references public.gam_nivel(nivel),
  conquista_requerida  text references public.gam_conquista(codigo),
  ativa                boolean not null default true
);

insert into public.gam_recompensa (codigo, nome, descricao, icone, custo_pontos, nivel_minimo, conquista_requerida) values
  ('moldura_prata',  'Moldura prata',    'Moldura prata para o seu perfil.',            '🥈', 150, 2, null),
  ('titulo_focado',  'Título "Focado"',  'Exiba o título Focado ao lado do seu nome.',  '🏷️', 300, 3, null),
  ('selo_veterano',  'Selo Veterano',    'Selo exclusivo para quem estuda com rotina.', '🎖️', 0,   1, 'sessoes_25'),
  ('moldura_dourada','Moldura dourada',  'Moldura dourada para o seu perfil.',          '🥇', 600, 4, 'sequencia_7')
on conflict (codigo) do nothing;

-- ---------- 3. Dados do usuário ----------
create table if not exists public.gam_perfil (
  id_usuario        uuid primary key references auth.users(id) on delete cascade,
  saldo             integer not null default 0 check (saldo >= 0),            -- gastável
  pontos_acumulados integer not null default 0 check (pontos_acumulados >= 0), -- vitalício (define o nível)
  nivel             integer not null default 1 references public.gam_nivel(nivel),
  atualizado_em     timestamptz not null default now()
);

create table if not exists public.gam_sessao (
  id                   uuid primary key default gen_random_uuid(),
  id_usuario           uuid not null references auth.users(id) on delete cascade,
  disciplina           text not null check (char_length(btrim(disciplina)) between 1 and 100),
  conteudo             text check (conteudo is null or char_length(conteudo) <= 200),
  minutos_planejados   integer not null check (minutos_planejados between 1 and 240),
  iniciada_em          timestamptz not null default now(),
  finalizada_em        timestamptz,
  minutos_validos      integer check (minutos_validos >= 0),
  elegivel             boolean,
  concluida            boolean,
  resumo               text,
  resumo_atualizado_em timestamptz,
  pontos_ganhos        integer not null default 0 check (pontos_ganhos >= 0)
);
create index if not exists gam_sessao_usuario_idx on public.gam_sessao (id_usuario, iniciada_em desc);

create table if not exists public.gam_pontos_historico (
  id          bigint generated always as identity primary key,
  id_usuario  uuid not null references auth.users(id) on delete cascade,
  id_sessao   uuid references public.gam_sessao(id) on delete set null,
  motivo      text not null check (motivo in ('tempo','conclusao','resumo','resgate')),
  pontos      integer not null check (pontos <> 0),
  descricao   text,
  criado_em   timestamptz not null default now(),
  unique (id_sessao, motivo)   -- impede pontuar duas vezes o mesmo item da mesma sessão
);
create index if not exists gam_hist_usuario_idx on public.gam_pontos_historico (id_usuario, criado_em desc);

create table if not exists public.gam_conquista_usuario (
  id_usuario uuid not null references auth.users(id) on delete cascade,
  codigo     text not null references public.gam_conquista(codigo),
  obtida_em  timestamptz not null default now(),
  primary key (id_usuario, codigo)
);

create table if not exists public.gam_resgate (
  id          bigint generated always as identity primary key,
  id_usuario  uuid not null references auth.users(id) on delete cascade,
  codigo      text not null references public.gam_recompensa(codigo),
  custo       integer not null check (custo >= 0),
  criado_em   timestamptz not null default now(),
  unique (id_usuario, codigo)  -- cada recompensa é resgatada uma única vez
);

-- ---------- 4. Segurança (RLS): o cliente só LÊ; toda escrita passa pelas RPCs ----------
alter table public.gam_regra             enable row level security;
alter table public.gam_nivel             enable row level security;
alter table public.gam_conquista         enable row level security;
alter table public.gam_recompensa        enable row level security;
alter table public.gam_perfil            enable row level security;
alter table public.gam_sessao            enable row level security;
alter table public.gam_pontos_historico  enable row level security;
alter table public.gam_conquista_usuario enable row level security;
alter table public.gam_resgate           enable row level security;

revoke all on public.gam_regra, public.gam_nivel, public.gam_conquista, public.gam_recompensa,
              public.gam_perfil, public.gam_sessao, public.gam_pontos_historico,
              public.gam_conquista_usuario, public.gam_resgate from anon, authenticated;
grant select on public.gam_regra, public.gam_nivel, public.gam_conquista, public.gam_recompensa,
                public.gam_perfil, public.gam_sessao, public.gam_pontos_historico,
                public.gam_conquista_usuario, public.gam_resgate to authenticated;

drop policy if exists gam_regra_leitura      on public.gam_regra;
drop policy if exists gam_nivel_leitura      on public.gam_nivel;
drop policy if exists gam_conquista_leitura  on public.gam_conquista;
drop policy if exists gam_recompensa_leitura on public.gam_recompensa;
create policy gam_regra_leitura      on public.gam_regra      for select to authenticated using (true);
create policy gam_nivel_leitura      on public.gam_nivel      for select to authenticated using (true);
create policy gam_conquista_leitura  on public.gam_conquista  for select to authenticated using (true);
create policy gam_recompensa_leitura on public.gam_recompensa for select to authenticated using (ativa);

drop policy if exists gam_perfil_proprio    on public.gam_perfil;
drop policy if exists gam_sessao_propria    on public.gam_sessao;
drop policy if exists gam_hist_proprio      on public.gam_pontos_historico;
drop policy if exists gam_conq_usuario_prop on public.gam_conquista_usuario;
drop policy if exists gam_resgate_proprio   on public.gam_resgate;
create policy gam_perfil_proprio    on public.gam_perfil              for select to authenticated using (id_usuario = (select auth.uid()));
create policy gam_sessao_propria    on public.gam_sessao              for select to authenticated using (id_usuario = (select auth.uid()));
create policy gam_hist_proprio      on public.gam_pontos_historico    for select to authenticated using (id_usuario = (select auth.uid()));
create policy gam_conq_usuario_prop on public.gam_conquista_usuario   for select to authenticated using (id_usuario = (select auth.uid()));
create policy gam_resgate_proprio   on public.gam_resgate             for select to authenticated using (id_usuario = (select auth.uid()));

-- ---------- 5. Funções internas (não expostas ao cliente) ----------
create or replace function public.gam_regra_valor(p_chave text)
returns integer language sql stable set search_path = '' as $$
  select valor from public.gam_regra where chave = p_chave;
$$;

-- Cria o perfil se faltar e TRAVA a linha: serializa operações concorrentes do mesmo usuário.
create or replace function public.gam_travar_perfil(p_uid uuid)
returns public.gam_perfil language plpgsql set search_path = '' as $$
declare v_perfil public.gam_perfil;
begin
  insert into public.gam_perfil (id_usuario) values (p_uid) on conflict (id_usuario) do nothing;
  select * into v_perfil from public.gam_perfil where id_usuario = p_uid for update;
  return v_perfil;
end $$;

-- Concede pontos respeitando o teto diário e a unicidade (sessão, motivo). Retorna o que foi creditado.
create or replace function public.gam_conceder(p_uid uuid, p_sessao uuid, p_motivo text, p_pontos integer, p_descricao text)
returns integer language plpgsql set search_path = '' as $$
declare
  v_hoje   integer;
  v_pts    integer;
  v_linhas integer;
  v_fuso   constant text := 'America/Sao_Paulo';
begin
  if p_pontos <= 0 then return 0; end if;

  select coalesce(sum(pontos), 0) into v_hoje
    from public.gam_pontos_historico
   where id_usuario = p_uid and pontos > 0
     and (criado_em at time zone v_fuso)::date = (now() at time zone v_fuso)::date;

  v_pts := least(p_pontos, greatest(public.gam_regra_valor('teto_pontos_dia') - v_hoje, 0));
  if v_pts <= 0 then return 0; end if;

  insert into public.gam_pontos_historico (id_usuario, id_sessao, motivo, pontos, descricao)
  values (p_uid, p_sessao, p_motivo, v_pts, p_descricao)
  on conflict (id_sessao, motivo) do nothing;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then return 0; end if;   -- já pontuado antes: nada a creditar

  update public.gam_perfil
     set saldo = saldo + v_pts, pontos_acumulados = pontos_acumulados + v_pts, atualizado_em = now()
   where id_usuario = p_uid;
  if p_sessao is not null then
    update public.gam_sessao set pontos_ganhos = pontos_ganhos + v_pts where id = p_sessao;
  end if;
  return v_pts;
end $$;

-- Valida/normaliza o resumo. Devolve NULL se vazio e opcional; lança erro nos demais casos inválidos.
create or replace function public.gam_validar_resumo(p_resumo text, p_obrigatorio boolean)
returns text language plpgsql stable set search_path = '' as $$
declare
  v_texto text := nullif(btrim(coalesce(p_resumo, '')), '');
  v_min   integer := public.gam_regra_valor('resumo_min_caracteres');
  v_max   integer := public.gam_regra_valor('resumo_max_caracteres');
begin
  if v_texto is null then
    if p_obrigatorio then raise exception 'O resumo é obrigatório.' using errcode = '22023'; end if;
    return null;
  end if;
  if char_length(v_texto) < v_min then
    raise exception 'O resumo precisa ter pelo menos % caracteres.', v_min using errcode = '22023';
  end if;
  if char_length(v_texto) > v_max then
    raise exception 'O resumo pode ter no máximo % caracteres.', v_max using errcode = '22023';
  end if;
  return v_texto;
end $$;

-- Sequência atual de dias seguidos com sessão elegível (termina hoje ou ontem).
create or replace function public.gam_sequencia_dias(p_uid uuid)
returns integer language sql stable set search_path = '' as $$
  with dias as (
    select distinct (finalizada_em at time zone 'America/Sao_Paulo')::date as d
      from public.gam_sessao where id_usuario = p_uid and elegivel
  ), grupos as (
    select d, d - (row_number() over (order by d))::integer as g from dias
  ), seqs as (
    select count(*)::integer as n, max(d) as ultimo from grupos group by g
  )
  select coalesce(max(n) filter (where ultimo >= (now() at time zone 'America/Sao_Paulo')::date - 1), 0) from seqs;
$$;

-- Recalcula o nível pelo total vitalício. Retorna o nível resultante.
create or replace function public.gam_atualizar_nivel(p_uid uuid)
returns integer language plpgsql set search_path = '' as $$
declare v_nivel integer;
begin
  select n.nivel into v_nivel
    from public.gam_nivel n
    join public.gam_perfil p on p.id_usuario = p_uid
   where n.pontos_minimos <= p.pontos_acumulados
   order by n.nivel desc limit 1;
  update public.gam_perfil set nivel = coalesce(v_nivel, 1), atualizado_em = now() where id_usuario = p_uid;
  return coalesce(v_nivel, 1);
end $$;

-- Avalia todos os critérios e registra só as conquistas novas. Retorna jsonb com as novas.
create or replace function public.gam_avaliar_conquistas(p_uid uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_sessoes integer; v_minutos integer; v_resumos integer; v_pontos integer; v_nivel integer; v_seq integer;
  v_novas jsonb;
begin
  select count(*) filter (where concluida),
         coalesce(sum(minutos_validos) filter (where elegivel), 0),
         count(*) filter (where elegivel and resumo is not null)
    into v_sessoes, v_minutos, v_resumos
    from public.gam_sessao where id_usuario = p_uid and finalizada_em is not null;
  select pontos_acumulados, nivel into v_pontos, v_nivel from public.gam_perfil where id_usuario = p_uid;
  v_seq := public.gam_sequencia_dias(p_uid);

  with inseridas as (
    insert into public.gam_conquista_usuario (id_usuario, codigo)
    select p_uid, c.codigo
      from public.gam_conquista c
     where c.ativa
       and case c.tipo_criterio
             when 'sessoes_concluidas' then v_sessoes
             when 'minutos_totais'     then v_minutos
             when 'resumos_escritos'   then v_resumos
             when 'pontos_acumulados'  then v_pontos
             when 'nivel_atingido'     then v_nivel
             when 'sequencia_dias'     then v_seq
           end >= c.valor_criterio
    on conflict (id_usuario, codigo) do nothing
    returning codigo
  )
  select coalesce(jsonb_agg(jsonb_build_object('codigo', c.codigo, 'nome', c.nome, 'descricao', c.descricao, 'icone', c.icone)
                            order by c.valor_criterio), '[]'::jsonb)
    into v_novas
    from inseridas i join public.gam_conquista c on c.codigo = i.codigo;
  return v_novas;
end $$;

-- Códigos de recompensas cujos REQUISITOS (nível/conquista) estão cumpridos e que ainda não foram resgatadas.
create or replace function public.gam_recompensas_liberadas(p_uid uuid)
returns text[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(r.codigo order by r.codigo), '{}')
    from public.gam_recompensa r
    join public.gam_perfil p on p.id_usuario = p_uid
   where r.ativa and p.nivel >= r.nivel_minimo
     and (r.conquista_requerida is null or exists (
           select 1 from public.gam_conquista_usuario cu
            where cu.id_usuario = p_uid and cu.codigo = r.conquista_requerida))
     and not exists (select 1 from public.gam_resgate g where g.id_usuario = p_uid and g.codigo = r.codigo);
$$;

-- Monta o resultado enviado ao front após um evento que pode render pontos.
create or replace function public.gam_resultado(
  p_uid uuid, p_sessao uuid, p_detalhes jsonb, p_nivel_antes integer, p_liberadas_antes text[], p_ja_finalizada boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_nivel_novo integer := public.gam_atualizar_nivel(p_uid);
  v_conquistas jsonb   := public.gam_avaliar_conquistas(p_uid);
  v_liberadas  jsonb;
  v_s public.gam_sessao;
  v_p public.gam_perfil;
begin
  -- conquistas podem depender do nível (nivel_atingido) e o nível não depende delas: uma passada basta.
  select * into v_s from public.gam_sessao where id = p_sessao;
  select * into v_p from public.gam_perfil where id_usuario = p_uid;

  select coalesce(jsonb_agg(jsonb_build_object('codigo', r.codigo, 'nome', r.nome, 'icone', r.icone) order by r.codigo), '[]'::jsonb)
    into v_liberadas
    from public.gam_recompensa r
   where r.codigo = any (public.gam_recompensas_liberadas(p_uid))
     and not (r.codigo = any (p_liberadas_antes));

  return jsonb_build_object(
    'sessao_id',            p_sessao,
    'ja_finalizada',        p_ja_finalizada,
    'minutos_validos',      v_s.minutos_validos,
    'elegivel',             v_s.elegivel,
    'concluida',            v_s.concluida,
    'pontos_ganhos_agora',  coalesce((select sum((d->>'pontos')::integer) from jsonb_array_elements(p_detalhes) d), 0),
    'pontos_da_sessao',     v_s.pontos_ganhos,
    'detalhes',             p_detalhes,
    'saldo',                v_p.saldo,
    'pontos_acumulados',    v_p.pontos_acumulados,
    'nivel',                jsonb_build_object('nivel', v_nivel_novo, 'nome', (select nome from public.gam_nivel where nivel = v_nivel_novo)),
    'nivel_anterior',       p_nivel_antes,
    'subiu_de_nivel',       v_nivel_novo > p_nivel_antes,
    'conquistas_novas',     v_conquistas,
    'recompensas_liberadas', v_liberadas
  );
end $$;

revoke all on function public.gam_regra_valor(text), public.gam_travar_perfil(uuid),
  public.gam_conceder(uuid, uuid, text, integer, text), public.gam_validar_resumo(text, boolean),
  public.gam_sequencia_dias(uuid), public.gam_atualizar_nivel(uuid), public.gam_avaliar_conquistas(uuid),
  public.gam_recompensas_liberadas(uuid), public.gam_resultado(uuid, uuid, jsonb, integer, text[], boolean)
  from public, anon, authenticated;

-- ---------- 6. RPCs expostas ao front (usam auth.uid(); nunca confiam em id vindo do cliente) ----------

-- Inicia uma sessão. O relógio de referência é o do servidor (iniciada_em).
-- Qualquer sessão anterior ainda aberta é encerrada SEM pontos (impede duas sessões simultâneas somando tempo).
create or replace function public.iniciar_sessao(p_disciplina text, p_conteudo text, p_minutos_planejados integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'Faça login para iniciar uma sessão.' using errcode = '28000'; end if;
  perform public.gam_travar_perfil(v_uid);

  update public.gam_sessao
     set finalizada_em = now(), minutos_validos = 0, elegivel = false, concluida = false
   where id_usuario = v_uid and finalizada_em is null;

  insert into public.gam_sessao (id_usuario, disciplina, conteudo, minutos_planejados)
  values (v_uid, btrim(coalesce(p_disciplina, '')), nullif(btrim(coalesce(p_conteudo, '')), ''), p_minutos_planejados)
  returning id into v_id;
  return v_id;
end $$;

-- Finaliza a sessão, calcula e credita os pontos. Idempotente: repetir a chamada não pontua de novo.
create or replace function public.finalizar_sessao(p_id_sessao uuid, p_minutos_focados integer, p_resumo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_perfil public.gam_perfil;
  v_s public.gam_sessao;
  v_resumo text;
  v_wall integer; v_min integer; v_elegivel boolean; v_concluida boolean;
  v_liberadas text[];
  v_detalhes jsonb := '[]'::jsonb;
  v_pts integer;
begin
  if v_uid is null then raise exception 'Faça login para finalizar a sessão.' using errcode = '28000'; end if;
  v_perfil := public.gam_travar_perfil(v_uid);

  select * into v_s from public.gam_sessao where id = p_id_sessao and id_usuario = v_uid for update;
  if not found then raise exception 'Sessão não encontrada.' using errcode = 'P0002'; end if;

  v_liberadas := public.gam_recompensas_liberadas(v_uid);

  if v_s.finalizada_em is not null then
    return public.gam_resultado(v_uid, v_s.id, '[]'::jsonb, v_perfil.nivel, v_liberadas, true);
  end if;

  v_resumo := public.gam_validar_resumo(p_resumo, public.gam_regra_valor('resumo_obrigatorio') = 1);

  -- Tempo válido = o que o cliente reporta, limitado pelo relógio do servidor e pelo teto da regra.
  v_wall := floor(extract(epoch from (now() - v_s.iniciada_em)) / 60)::integer;
  v_min  := greatest(0, least(coalesce(p_minutos_focados, 0), v_wall, public.gam_regra_valor('minutos_maximos_pontuaveis')));
  v_elegivel  := v_min >= public.gam_regra_valor('minutos_minimos');
  v_concluida := v_elegivel and v_min >= ceil(v_s.minutos_planejados * public.gam_regra_valor('percentual_conclusao') / 100.0);

  update public.gam_sessao
     set finalizada_em = now(), minutos_validos = v_min, elegivel = v_elegivel, concluida = v_concluida,
         resumo = v_resumo, resumo_atualizado_em = case when v_resumo is null then null else now() end
   where id = v_s.id;

  if v_elegivel then
    v_pts := public.gam_conceder(v_uid, v_s.id, 'tempo', v_min * public.gam_regra_valor('pontos_por_minuto'),
                                 v_min || ' min de foco');
    if v_pts > 0 then v_detalhes := v_detalhes || jsonb_build_object('motivo', 'tempo', 'pontos', v_pts); end if;
    if v_concluida then
      v_pts := public.gam_conceder(v_uid, v_s.id, 'conclusao', public.gam_regra_valor('bonus_conclusao'), 'Pomodoro concluído');
      if v_pts > 0 then v_detalhes := v_detalhes || jsonb_build_object('motivo', 'conclusao', 'pontos', v_pts); end if;
    end if;
    if v_resumo is not null then
      v_pts := public.gam_conceder(v_uid, v_s.id, 'resumo', public.gam_regra_valor('bonus_resumo'), 'Resumo da sessão');
      if v_pts > 0 then v_detalhes := v_detalhes || jsonb_build_object('motivo', 'resumo', 'pontos', v_pts); end if;
    end if;
  end if;

  return public.gam_resultado(v_uid, v_s.id, v_detalhes, v_perfil.nivel, v_liberadas, false);
end $$;

-- Cria ou edita o resumo de uma sessão já finalizada. O bônus de resumo é pago no máximo uma vez.
create or replace function public.salvar_resumo(p_id_sessao uuid, p_resumo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_perfil public.gam_perfil;
  v_s public.gam_sessao;
  v_resumo text;
  v_liberadas text[];
  v_detalhes jsonb := '[]'::jsonb;
  v_pts integer;
begin
  if v_uid is null then raise exception 'Faça login para salvar o resumo.' using errcode = '28000'; end if;
  v_perfil := public.gam_travar_perfil(v_uid);

  select * into v_s from public.gam_sessao where id = p_id_sessao and id_usuario = v_uid for update;
  if not found then raise exception 'Sessão não encontrada.' using errcode = 'P0002'; end if;
  if v_s.finalizada_em is null then raise exception 'Finalize a sessão antes de editar o resumo.' using errcode = '55000'; end if;

  v_resumo := public.gam_validar_resumo(p_resumo, true);
  v_liberadas := public.gam_recompensas_liberadas(v_uid);

  update public.gam_sessao set resumo = v_resumo, resumo_atualizado_em = now() where id = v_s.id;

  if v_s.elegivel then
    v_pts := public.gam_conceder(v_uid, v_s.id, 'resumo', public.gam_regra_valor('bonus_resumo'), 'Resumo da sessão');
    if v_pts > 0 then v_detalhes := v_detalhes || jsonb_build_object('motivo', 'resumo', 'pontos', v_pts); end if;
  end if;

  return public.gam_resultado(v_uid, v_s.id, v_detalhes, v_perfil.nivel, v_liberadas, true);
end $$;

-- Resgata uma recompensa: valida requisitos, resgate único e saldo; debita e registra no histórico.
create or replace function public.resgatar_recompensa(p_codigo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_perfil public.gam_perfil;
  v_r public.gam_recompensa;
begin
  if v_uid is null then raise exception 'Faça login para resgatar recompensas.' using errcode = '28000'; end if;
  v_perfil := public.gam_travar_perfil(v_uid);

  select * into v_r from public.gam_recompensa where codigo = p_codigo and ativa;
  if not found then raise exception 'Recompensa não encontrada.' using errcode = 'P0002'; end if;

  if exists (select 1 from public.gam_resgate where id_usuario = v_uid and codigo = v_r.codigo) then
    raise exception 'Você já resgatou esta recompensa.' using errcode = '23505';
  end if;
  if v_perfil.nivel < v_r.nivel_minimo then
    raise exception 'Requer o nível %.', v_r.nivel_minimo using errcode = '42501';
  end if;
  if v_r.conquista_requerida is not null and not exists (
       select 1 from public.gam_conquista_usuario where id_usuario = v_uid and codigo = v_r.conquista_requerida) then
    raise exception 'Requer a conquista "%".',
      (select nome from public.gam_conquista where codigo = v_r.conquista_requerida) using errcode = '42501';
  end if;
  if v_perfil.saldo < v_r.custo_pontos then
    raise exception 'Saldo insuficiente: faltam % pontos.', v_r.custo_pontos - v_perfil.saldo using errcode = '53400';
  end if;

  insert into public.gam_resgate (id_usuario, codigo, custo) values (v_uid, v_r.codigo, v_r.custo_pontos);
  if v_r.custo_pontos > 0 then
    update public.gam_perfil set saldo = saldo - v_r.custo_pontos, atualizado_em = now() where id_usuario = v_uid;
    insert into public.gam_pontos_historico (id_usuario, motivo, pontos, descricao)
    values (v_uid, 'resgate', -v_r.custo_pontos, 'Resgate: ' || v_r.nome);
  end if;

  return jsonb_build_object('codigo', v_r.codigo, 'nome', v_r.nome, 'custo', v_r.custo_pontos,
                            'saldo', (select saldo from public.gam_perfil where id_usuario = v_uid));
end $$;

-- Tudo o que o painel precisa em uma chamada.
create or replace function public.gam_painel()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.gam_perfil;
  v_atual public.gam_nivel;
  v_prox public.gam_nivel;
begin
  if v_uid is null then raise exception 'Faça login para ver o painel.' using errcode = '28000'; end if;
  v_p := public.gam_travar_perfil(v_uid);
  select * into v_atual from public.gam_nivel where nivel = v_p.nivel;
  select * into v_prox  from public.gam_nivel where pontos_minimos > v_p.pontos_acumulados order by pontos_minimos limit 1;

  return jsonb_build_object(
    'perfil', jsonb_build_object('saldo', v_p.saldo, 'pontos_acumulados', v_p.pontos_acumulados,
                                 'nivel', v_p.nivel, 'nivel_nome', v_atual.nome),
    'niveis', (select coalesce(jsonb_agg(to_jsonb(n) order by n.nivel), '[]'::jsonb) from public.gam_nivel n),
    'historico', (select coalesce(jsonb_agg(h order by h.criado_em desc), '[]'::jsonb) from (
                    select motivo, pontos, descricao, criado_em from public.gam_pontos_historico
                     where id_usuario = v_uid order by criado_em desc, id desc limit 50) h),
    'conquistas', (select coalesce(jsonb_agg(jsonb_build_object(
                      'codigo', c.codigo, 'nome', c.nome, 'descricao', c.descricao, 'icone', c.icone,
                      'tipo_criterio', c.tipo_criterio, 'valor_criterio', c.valor_criterio, 'obtida_em', cu.obtida_em)
                      order by c.tipo_criterio, c.valor_criterio), '[]'::jsonb)
                     from public.gam_conquista c
                     left join public.gam_conquista_usuario cu on cu.codigo = c.codigo and cu.id_usuario = v_uid
                    where c.ativa),
    'recompensas', (select coalesce(jsonb_agg(jsonb_build_object(
                      'codigo', r.codigo, 'nome', r.nome, 'descricao', r.descricao, 'icone', r.icone,
                      'custo_pontos', r.custo_pontos, 'nivel_minimo', r.nivel_minimo,
                      'conquista_requerida', r.conquista_requerida,
                      'conquista_requerida_nome', cr.nome,
                      'estado', case
                        when g.id is not null then 'resgatada'
                        when v_p.nivel < r.nivel_minimo
                          or (r.conquista_requerida is not null and cu.codigo is null) then 'bloqueada'
                        when v_p.saldo < r.custo_pontos then 'sem_saldo'
                        else 'disponivel' end)
                      order by r.custo_pontos, r.codigo), '[]'::jsonb)
                     from public.gam_recompensa r
                     left join public.gam_conquista cr on cr.codigo = r.conquista_requerida
                     left join public.gam_conquista_usuario cu on cu.codigo = r.conquista_requerida and cu.id_usuario = v_uid
                     left join public.gam_resgate g on g.codigo = r.codigo and g.id_usuario = v_uid
                    where r.ativa)
  );
end $$;

revoke all on function public.iniciar_sessao(text, text, integer), public.finalizar_sessao(uuid, integer, text),
  public.salvar_resumo(uuid, text), public.resgatar_recompensa(text), public.gam_painel() from public, anon;
grant execute on function public.iniciar_sessao(text, text, integer), public.finalizar_sessao(uuid, integer, text),
  public.salvar_resumo(uuid, text), public.resgatar_recompensa(text), public.gam_painel() to authenticated;
