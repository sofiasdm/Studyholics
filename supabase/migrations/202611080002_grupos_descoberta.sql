-- Aplicar depois de 202611080001_grupos.sql.
begin;

alter table public.grupo_estudo add column if not exists descricao text;

create function public.grupo_explorar(p_nome text, p_antes integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(grupo) order by grupo.id desc), '[]'::jsonb)
  from (
    select g.id_grupo as id, g.nome_grupo as nome, g.descricao,
      (
        select coalesce(jsonb_agg(d.nome order by d.nome), '[]'::jsonb)
        from public.grupo_disciplina d
        where d.id_grupo = g.id_grupo
      ) as disciplinas
    from public.grupo_estudo g
    where auth.uid() is not null
      and (p_antes is null or g.id_grupo < p_antes)
      and strpos(lower(g.nome_grupo), lower(btrim(coalesce(p_nome, '')))) > 0
      and not exists (
        select 1 from public.participacao p
        where p.id_grupo = g.id_grupo and p.id_usuario = auth.uid()
      )
    order by g.id_grupo desc
    limit 24
  ) grupo;
$$;

create function public.grupo_alterar_descricao(p_grupo integer, p_descricao text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.participacao
  where id_grupo = p_grupo and id_usuario = auth.uid() and organizador
  for share;
  if not found then
    raise exception 'Somente organizadores podem alterar a descrição.' using errcode = '42501';
  end if;

  if char_length(coalesce(p_descricao, '')) > 500 then
    raise exception 'A descrição deve ter até 500 caracteres.' using errcode = '22023';
  end if;

  update public.grupo_estudo
  set descricao = nullif(btrim(p_descricao), '')
  where id_grupo = p_grupo;
end;
$$;

create function public.grupo_alterar_senha(p_grupo integer, p_senha text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.participacao
  where id_grupo = p_grupo and id_usuario = auth.uid() and organizador
  for share;
  if not found then
    raise exception 'Somente organizadores podem alterar a senha.' using errcode = '42501';
  end if;

  if char_length(coalesce(p_senha, '')) not between 6 and 80 then
    raise exception 'A senha deve ter de 6 a 80 caracteres.' using errcode = '22023';
  end if;

  insert into public.grupo_senha (id_grupo, senha) values (p_grupo, p_senha)
  on conflict (id_grupo) do update set senha = excluded.senha;
end;
$$;

-- Uma linha por conta limita tentativas mesmo quando a pessoa alterna entre grupos.
create table public.grupo_tentativas_entrada (
  id_usuario uuid primary key references auth.users(id) on delete cascade,
  inicio_janela timestamptz not null default now(),
  falhas integer not null default 0 check (falhas between 0 and 8)
);
alter table public.grupo_tentativas_entrada enable row level security;
revoke all on public.grupo_tentativas_entrada from public, anon, authenticated;

create function public.grupo_entrar_com_senha(p_grupo integer, p_senha text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid := auth.uid();
  v_agora timestamptz;
  v_tentativas public.grupo_tentativas_entrada%rowtype;
  v_senha text;
begin
  if v_usuario is null then
    raise exception 'Faça login.' using errcode = '42501';
  end if;

  perform 1 from public.grupo_estudo where id_grupo = p_grupo for key share;
  if not found then
    return 'grupo_inexistente';
  end if;

  insert into public.grupo_tentativas_entrada (id_usuario) values (v_usuario)
  on conflict (id_usuario) do nothing;

  select * into v_tentativas
  from public.grupo_tentativas_entrada where id_usuario = v_usuario for update;

  v_agora := clock_timestamp();
  if v_tentativas.inicio_janela <= v_agora - interval '10 minutes' then
    update public.grupo_tentativas_entrada
    set inicio_janela = v_agora, falhas = 0
    where id_usuario = v_usuario;
  elsif v_tentativas.falhas >= 8 then
    return 'limite';
  end if;

  -- Serializa a leitura da senha com a troca feita pelo organizador.
  select senha into v_senha from public.grupo_senha where id_grupo = p_grupo for share;
  if v_senha is null or p_senha is distinct from v_senha then
    update public.grupo_tentativas_entrada set falhas = falhas + 1
    where id_usuario = v_usuario;
    return 'senha_incorreta';
  end if;

  insert into public.participacao (id_grupo, id_usuario) values (p_grupo, v_usuario)
  on conflict (id_grupo, id_usuario) do nothing;
  return 'entrou';
end;
$$;

revoke all on function public.grupo_explorar(text, integer),
  public.grupo_alterar_descricao(integer, text), public.grupo_alterar_senha(integer, text),
  public.grupo_entrar_com_senha(integer, text) from public, anon, authenticated;

grant execute on function public.grupo_explorar(text, integer),
  public.grupo_alterar_descricao(integer, text), public.grupo_alterar_senha(integer, text),
  public.grupo_entrar_com_senha(integer, text) to authenticated;

-- A entrada voluntária por senha passa pela função que limita tentativas.
revoke execute on function public.grupo_entrar(integer, text) from public, anon, authenticated;
-- A adição direta por e-mail continua restrita aos organizadores pela função original.
revoke execute on function public.grupo_adicionar_por_email(integer, text) from public, anon;
grant execute on function public.grupo_adicionar_por_email(integer, text) to authenticated;

create table public.grupo_postagem (
  id bigint generated always as identity primary key,
  id_grupo integer not null references public.grupo_estudo(id_grupo) on delete cascade,
  id_autor uuid references auth.users(id) on delete set null,
  autor text not null,
  titulo text check (char_length(titulo) <= 120),
  texto text check (char_length(texto) <= 4000 and texto ~ '[^[:space:]]'),
  link text check (char_length(link) <= 2048 and link ~* '^https?://[^[:space:]]+$'),
  criada_em timestamptz not null default clock_timestamp(),
  check (texto is not null or link is not null),
  unique (id_grupo, id)
);

create table public.grupo_comentario (
  id bigint generated always as identity primary key,
  id_grupo integer not null,
  id_postagem bigint not null,
  id_autor uuid references auth.users(id) on delete set null,
  autor text not null,
  texto text not null check (char_length(texto) <= 2000 and texto ~ '[^[:space:]]'),
  criada_em timestamptz not null default clock_timestamp(),
  foreign key (id_grupo, id_postagem) references public.grupo_postagem(id_grupo, id) on delete cascade
);

create index grupo_postagem_ordem on public.grupo_postagem (id_grupo, criada_em desc, id desc);
create index grupo_comentario_postagem_ordem
  on public.grupo_comentario (id_grupo, id_postagem, criada_em desc, id desc);

alter table public.grupo_postagem enable row level security;
alter table public.grupo_comentario enable row level security;
revoke all on public.grupo_postagem, public.grupo_comentario from public, anon, authenticated;
grant select on public.grupo_postagem, public.grupo_comentario to authenticated;

-- A política verifica a participação da própria conta, inclusive ao entregar eventos Realtime.
create function public.grupo_feed_eh_membro(p_grupo integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.grupo_eh_membro(p_grupo, auth.uid());
$$;

create policy grupo_postagem_leitura_membros on public.grupo_postagem
  for select to authenticated using (public.grupo_feed_eh_membro(id_grupo));
create policy grupo_comentario_leitura_membros on public.grupo_comentario
  for select to authenticated using (public.grupo_feed_eh_membro(id_grupo));

-- Nome obtido no servidor e preservado no histórico, mesmo que o perfil mude.
create function public.grupo_feed_autor(p_grupo integer)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_autor text;
begin
  perform 1 from public.participacao
  where id_grupo = p_grupo and id_usuario = v_uid
  for share;
  if not found then
    raise exception 'Você não faz parte deste grupo.' using errcode = '42501';
  end if;

  select nullif(btrim(concat_ws(' ', primeiro_nome, sobrenome)), '')
  into v_autor from public.estudante where id_usuario = v_uid;
  return coalesce(v_autor, 'Estudante');
end;
$$;

create function public.grupo_publicar(p_grupo integer, p_titulo text, p_texto text, p_link text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_autor text := public.grupo_feed_autor(p_grupo);
  v_postagem public.grupo_postagem%rowtype;
begin
  insert into public.grupo_postagem (id_grupo, id_autor, autor, titulo, texto, link)
  values (p_grupo, auth.uid(), v_autor, nullif(btrim(p_titulo), ''),
    nullif(btrim(p_texto), ''), nullif(btrim(p_link), ''))
  returning * into v_postagem;
  return to_jsonb(v_postagem);
end;
$$;

create function public.grupo_comentar(p_grupo integer, p_postagem bigint, p_texto text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_autor text := public.grupo_feed_autor(p_grupo);
  v_comentario public.grupo_comentario%rowtype;
begin
  insert into public.grupo_comentario (id_grupo, id_postagem, id_autor, autor, texto)
  values (p_grupo, p_postagem, auth.uid(), v_autor, btrim(p_texto))
  returning * into v_comentario;
  return to_jsonb(v_comentario);
end;
$$;

revoke all on function public.grupo_feed_autor(integer), public.grupo_feed_eh_membro(integer),
  public.grupo_publicar(integer, text, text, text), public.grupo_comentar(integer, bigint, text)
  from public, anon, authenticated;
grant execute on function public.grupo_feed_eh_membro(integer),
  public.grupo_publicar(integer, text, text, text), public.grupo_comentar(integer, bigint, text)
  to authenticated;

-- Adiciona o feed à publicação do Supabase, preservando as tabelas que já estão nela.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'grupo_postagem'
  ) then
    alter publication supabase_realtime add table public.grupo_postagem;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'grupo_comentario'
  ) then
    alter publication supabase_realtime add table public.grupo_comentario;
  end if;
end;
$$;

commit;
