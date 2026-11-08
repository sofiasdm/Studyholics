-- Grupos de estudo. Aplicar depois da migração de gamificação.
-- As tabelas grupo_estudo e participacao já existem no banco atual.
begin;

do $$ begin
  if (select attidentity = '' from pg_attribute where attrelid = 'public.grupo_estudo'::regclass and attname = 'id_grupo') then
    create sequence if not exists public.grupo_estudo_id_grupo_seq;
    alter sequence public.grupo_estudo_id_grupo_seq owned by public.grupo_estudo.id_grupo;
    alter table public.grupo_estudo alter column id_grupo set default nextval('public.grupo_estudo_id_grupo_seq');
    perform setval('public.grupo_estudo_id_grupo_seq', greatest(coalesce((select max(id_grupo) from public.grupo_estudo), 0), 1),
      exists (select 1 from public.grupo_estudo));
  end if;
end $$;

alter table public.participacao add column if not exists organizador boolean not null default false;
alter table public.participacao add column if not exists ingressou_em timestamptz not null default now();
update public.participacao p set organizador = true
  from public.grupo_estudo g where g.id_grupo = p.id_grupo and g.id_criador = p.id_usuario;
insert into public.participacao (id_grupo, id_usuario, organizador)
  select g.id_grupo, g.id_criador, true from public.grupo_estudo g
  where not exists (select 1 from public.participacao p where p.id_grupo = g.id_grupo and p.id_usuario = g.id_criador)
  on conflict do nothing;
create unique index if not exists participacao_grupo_usuario_unique on public.participacao(id_grupo, id_usuario);

create table if not exists public.grupo_senha (
  id_grupo integer primary key references public.grupo_estudo(id_grupo) on delete cascade,
  senha text not null check (char_length(senha) between 6 and 80)
);
insert into public.grupo_senha(id_grupo,senha)
  select g.id_grupo, substr(replace(gen_random_uuid()::text,'-',''),1,12)
  from public.grupo_estudo g on conflict do nothing;
create table if not exists public.grupo_disciplina (
  id_grupo integer not null references public.grupo_estudo(id_grupo) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 100),
  primary key (id_grupo, nome)
);
create table if not exists public.grupo_mensagem (
  id bigint generated always as identity primary key,
  id_grupo integer not null references public.grupo_estudo(id_grupo) on delete cascade,
  id_usuario uuid not null references auth.users(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 2000),
  criada_em timestamptz not null default now()
);
create index if not exists grupo_mensagem_ordem on public.grupo_mensagem(id_grupo, id desc);
create index if not exists grupo_disciplina_nome on public.grupo_disciplina(nome);
create index if not exists participacao_usuario on public.participacao(id_usuario, id_grupo);

-- Todas as operações e leituras passam por funções que validam auth.uid().
alter table public.grupo_estudo enable row level security;
alter table public.participacao enable row level security;
alter table public.grupo_senha enable row level security;
alter table public.grupo_disciplina enable row level security;
alter table public.grupo_mensagem enable row level security;
revoke all on public.grupo_estudo, public.participacao, public.grupo_senha,
  public.grupo_disciplina, public.grupo_mensagem from anon, authenticated;
-- Remove políticas antigas, que poderiam expor dados por acesso direto.
do $$ declare v record; begin
  for v in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in
      ('grupo_estudo','participacao','grupo_senha','grupo_disciplina','grupo_mensagem')
  loop execute format('drop policy %I on %I.%I', v.policyname, v.schemaname, v.tablename); end loop;
end $$;

create or replace function public.grupo_eh_membro(p_grupo integer, p_usuario uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.participacao where id_grupo = p_grupo and id_usuario = p_usuario);
$$;
create or replace function public.grupo_eh_organizador(p_grupo integer, p_usuario uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.participacao where id_grupo = p_grupo and id_usuario = p_usuario and organizador);
$$;
revoke all on function public.grupo_eh_membro(integer,uuid), public.grupo_eh_organizador(integer,uuid) from public, anon, authenticated;

create or replace function public.grupo_criar(p_nome text, p_descricao text, p_senha text, p_disciplinas text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id integer; v_disc text;
begin
  if v_uid is null then raise exception 'Faça login.'; end if;
  if char_length(btrim(coalesce(p_nome,''))) not between 3 and 100 then raise exception 'O nome deve ter de 3 a 100 caracteres.'; end if;
  if char_length(coalesce(p_descricao,'')) > 500 then raise exception 'A descrição deve ter até 500 caracteres.'; end if;
  if char_length(coalesce(p_senha,'')) not between 6 and 80 then raise exception 'A senha deve ter de 6 a 80 caracteres.'; end if;
  if coalesce(array_length(p_disciplinas,1),0) < 1 then raise exception 'Escolha ao menos uma disciplina.'; end if;
  insert into public.grupo_estudo(nome_grupo, descricao, id_criador)
    values(btrim(p_nome), nullif(btrim(p_descricao),''), v_uid) returning id_grupo into v_id;
  insert into public.grupo_senha values(v_id, p_senha);
  insert into public.participacao(id_grupo,id_usuario,organizador) values(v_id,v_uid,true);
  foreach v_disc in array p_disciplinas loop
    if char_length(btrim(coalesce(v_disc,''))) not between 1 and 100 then raise exception 'Disciplina inválida.'; end if;
    insert into public.grupo_disciplina values(v_id,btrim(v_disc)) on conflict do nothing;
  end loop;
  return v_id;
end $$;

create or replace function public.grupo_entrar(p_grupo integer, p_senha text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  if not exists(select 1 from public.grupo_senha where id_grupo = p_grupo and senha = p_senha) then
    raise exception 'Grupo ou senha inválidos.';
  end if;
  insert into public.participacao(id_grupo,id_usuario) values(p_grupo,auth.uid()) on conflict do nothing;
end $$;

create or replace function public.grupo_adicionar_por_email(p_grupo integer, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if not public.grupo_eh_organizador(p_grupo,auth.uid()) then raise exception 'Somente organizadores podem adicionar membros.'; end if;
  select id_usuario into v_uid from public.estudante where lower(email) = lower(btrim(p_email)) limit 1;
  if v_uid is null then raise exception 'Nenhum usuário cadastrado com este e-mail.'; end if;
  insert into public.participacao(id_grupo,id_usuario) values(p_grupo,v_uid) on conflict do nothing;
end $$;

create or replace function public.grupo_sair(p_grupo integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.grupo_eh_membro(p_grupo,auth.uid()) then raise exception 'Você não faz parte deste grupo.'; end if;
  if exists(select 1 from public.grupo_estudo where id_grupo = p_grupo and id_criador = auth.uid()) then
    raise exception 'O criador deve excluir o grupo em vez de sair.';
  end if;
  delete from public.participacao where id_grupo = p_grupo and id_usuario = auth.uid();
end $$;

create or replace function public.grupo_remover_membro(p_grupo integer, p_usuario uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.grupo_eh_organizador(p_grupo,auth.uid()) then raise exception 'Somente organizadores podem remover membros.'; end if;
  if exists(select 1 from public.grupo_estudo where id_grupo = p_grupo and id_criador = p_usuario) then raise exception 'O criador não pode ser removido.'; end if;
  delete from public.participacao where id_grupo = p_grupo and id_usuario = p_usuario;
end $$;

create or replace function public.grupo_definir_organizador(p_grupo integer, p_usuario uuid, p_organizador boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.grupo_estudo where id_grupo = p_grupo and id_criador = auth.uid()) then
    raise exception 'Somente o criador pode definir organizadores.';
  end if;
  if p_usuario = auth.uid() and not p_organizador then raise exception 'O criador deve permanecer organizador.'; end if;
  update public.participacao set organizador = p_organizador where id_grupo = p_grupo and id_usuario = p_usuario;
  if not found then raise exception 'Membro não encontrado.'; end if;
end $$;

create or replace function public.grupo_definir_disciplinas(p_grupo integer, p_disciplinas text[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_disc text;
begin
  if not public.grupo_eh_organizador(p_grupo,auth.uid()) then raise exception 'Somente organizadores podem definir disciplinas.'; end if;
  if coalesce(array_length(p_disciplinas,1),0) < 1 then raise exception 'Escolha ao menos uma disciplina.'; end if;
  delete from public.grupo_disciplina where id_grupo=p_grupo;
  foreach v_disc in array p_disciplinas loop
    if char_length(btrim(coalesce(v_disc,''))) not between 1 and 100 then raise exception 'Disciplina inválida.'; end if;
    insert into public.grupo_disciplina values(p_grupo,btrim(v_disc)) on conflict do nothing;
  end loop;
end $$;

create or replace function public.grupo_excluir(p_grupo integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.grupo_estudo where id_grupo = p_grupo and id_criador = auth.uid()) then
    raise exception 'Somente o criador pode excluir o grupo.';
  end if;
  delete from public.participacao where id_grupo = p_grupo;
  delete from public.grupo_estudo where id_grupo = p_grupo;
end $$;

create or replace function public.grupo_enviar_mensagem(p_grupo integer, p_texto text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not public.grupo_eh_membro(p_grupo,auth.uid()) then raise exception 'Você não faz parte deste grupo.'; end if;
  if char_length(btrim(coalesce(p_texto,''))) not between 1 and 2000 then raise exception 'A mensagem deve ter de 1 a 2000 caracteres.'; end if;
  insert into public.grupo_mensagem(id_grupo,id_usuario,texto) values(p_grupo,auth.uid(),btrim(p_texto)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.grupo_listar()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id_grupo,'nome',g.nome_grupo,'descricao',g.descricao,
    'membros',(select count(*) from public.participacao p2 where p2.id_grupo=g.id_grupo),
    'disciplinas',(select coalesce(jsonb_agg(d.nome order by d.nome),'[]'::jsonb) from public.grupo_disciplina d where d.id_grupo=g.id_grupo)
  ) order by g.nome_grupo),'[]'::jsonb)
  from public.grupo_estudo g join public.participacao p on p.id_grupo=g.id_grupo
  where p.id_usuario=auth.uid();
$$;

create or replace function public.grupo_detalhes(p_grupo integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.grupo_eh_membro(p_grupo,auth.uid()) then raise exception 'Você não faz parte deste grupo.'; end if;
  select jsonb_build_object(
    'id',g.id_grupo,'nome',g.nome_grupo,'descricao',g.descricao,'criado_em',g.data_criacao,
    'criador',g.id_criador,'sou_organizador',public.grupo_eh_organizador(p_grupo,auth.uid()),
    'senha',case when public.grupo_eh_organizador(p_grupo,auth.uid()) then (select s.senha from public.grupo_senha s where s.id_grupo=p_grupo) else null end,
    'disciplinas',(select coalesce(jsonb_agg(d.nome order by d.nome),'[]'::jsonb) from public.grupo_disciplina d where d.id_grupo=p_grupo),
    'membros',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id_usuario,'nome',nullif(btrim(coalesce(e.primeiro_nome,'')||' '||coalesce(e.sobrenome,'')),''),
      'organizador',p.organizador) order by p.organizador desc,e.primeiro_nome),'[]'::jsonb)
      from public.participacao p left join public.estudante e on e.id_usuario=p.id_usuario where p.id_grupo=p_grupo)
  ) into v_result from public.grupo_estudo g where g.id_grupo=p_grupo;
  return v_result;
end $$;

create or replace function public.grupo_mensagens(p_grupo integer, p_antes bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.grupo_eh_membro(p_grupo,auth.uid()) then raise exception 'Você não faz parte deste grupo.'; end if;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) into v_result from (
    select gm.id,gm.id_usuario,gm.texto,gm.criada_em,
      coalesce(nullif(btrim(coalesce(e.primeiro_nome,'')||' '||coalesce(e.sobrenome,'')),''),'Estudante') as nome
    from public.grupo_mensagem gm left join public.estudante e on e.id_usuario=gm.id_usuario
    where gm.id_grupo=p_grupo and (p_antes is null or gm.id<p_antes)
    order by gm.id desc limit 50
  ) m;
  return v_result;
end $$;

-- Segunda-feira 00h no fuso de Recife. Somente sessões finalizadas, com
-- tempo validado pelo servidor, após a entrada no grupo e na disciplina dele.
create or replace function public.grupo_estudos(p_grupo integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb; v_inicio timestamptz;
begin
  if not public.grupo_eh_membro(p_grupo,auth.uid()) then raise exception 'Você não faz parte deste grupo.'; end if;
  v_inicio := (date_trunc('week', now() at time zone 'America/Recife') at time zone 'America/Recife');
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id_usuario,'nome',coalesce(nullif(btrim(coalesce(e.primeiro_nome,'')||' '||coalesce(e.sobrenome,'')),''),'Estudante'),
    'minutos',coalesce((select sum(s.minutos_validos) from public.gam_sessao s
      where exists(select 1 from public.grupo_disciplina d where d.id_grupo=p_grupo and lower(d.nome)=lower(s.disciplina))
        and s.id_usuario=p.id_usuario and s.finalizada_em>=greatest(v_inicio,p.ingressou_em)
        and s.minutos_validos>0),0),
    'estudando',(select s.disciplina from public.gam_sessao s
      where exists(select 1 from public.grupo_disciplina d where d.id_grupo=p_grupo and lower(d.nome)=lower(s.disciplina))
        and s.id_usuario=p.id_usuario and s.finalizada_em is null and s.iniciada_em >= p.ingressou_em
        and s.iniciada_em > now()-interval '5 hours' order by s.iniciada_em desc limit 1)
  ) order by coalesce((select sum(s.minutos_validos) from public.gam_sessao s
      where exists(select 1 from public.grupo_disciplina d where d.id_grupo=p_grupo and lower(d.nome)=lower(s.disciplina))
        and s.id_usuario=p.id_usuario and s.finalizada_em>=greatest(v_inicio,p.ingressou_em)
        and s.minutos_validos>0),0) desc),'[]'::jsonb) into v_result
  from public.participacao p left join public.estudante e on e.id_usuario=p.id_usuario where p.id_grupo=p_grupo;
  return v_result;
end $$;

revoke all on function public.grupo_criar(text,text,text,text[]), public.grupo_entrar(integer,text),
  public.grupo_adicionar_por_email(integer,text), public.grupo_sair(integer),
  public.grupo_remover_membro(integer,uuid), public.grupo_definir_organizador(integer,uuid,boolean),
  public.grupo_definir_disciplinas(integer,text[]),
  public.grupo_excluir(integer), public.grupo_enviar_mensagem(integer,text),
  public.grupo_listar(), public.grupo_detalhes(integer), public.grupo_mensagens(integer,bigint),
  public.grupo_estudos(integer) from public,anon;
grant execute on function public.grupo_criar(text,text,text,text[]), public.grupo_entrar(integer,text),
  public.grupo_adicionar_por_email(integer,text), public.grupo_sair(integer),
  public.grupo_remover_membro(integer,uuid), public.grupo_definir_organizador(integer,uuid,boolean),
  public.grupo_definir_disciplinas(integer,text[]),
  public.grupo_excluir(integer), public.grupo_enviar_mensagem(integer,text),
  public.grupo_listar(), public.grupo_detalhes(integer), public.grupo_mensagens(integer,bigint),
  public.grupo_estudos(integer) to authenticated;

commit;
