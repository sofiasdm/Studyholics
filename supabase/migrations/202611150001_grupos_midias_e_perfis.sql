-- Aplicar após 202611080001_grupos.sql e 202611080002_grupos_descoberta.sql.
begin;

alter table public.grupo_estudo add column foto_grupo text;
alter table public.grupo_mensagem
  add column midia text,
  add column midia_tipo text,
  alter column texto drop not null,
  add constraint grupo_mensagem_conteudo check (texto is not null or midia is not null);
alter table public.grupo_postagem
  add column midia text,
  add column midia_tipo text,
  drop constraint grupo_postagem_check,
  add constraint grupo_postagem_conteudo check (texto is not null or link is not null or midia is not null);

-- Preserva nomes, descrições e publicações antigos. Os novos limites valem nas gravações.
create function public.grupo_validar_textos()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.nome_grupo is distinct from old.nome_grupo then
    if char_length(btrim(new.nome_grupo)) > 20 then
      raise exception 'O nome do grupo deve ter até 20 caracteres.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'INSERT' or new.descricao is distinct from old.descricao then
    if char_length(new.descricao) > 200 then
      raise exception 'A descrição deve ter até 200 caracteres.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger grupo_validar_textos
before insert or update of nome_grupo, descricao on public.grupo_estudo
for each row execute function public.grupo_validar_textos();

create function public.grupo_validar_feed()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'grupo_postagem' then
    if char_length(new.titulo) > 50 then
      raise exception 'O título deve ter até 50 caracteres.' using errcode = '22023';
    end if;
  end if;
  if char_length(new.texto) > 500 then
    raise exception 'O texto deve ter até 500 caracteres.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger grupo_validar_postagem before insert on public.grupo_postagem
for each row execute function public.grupo_validar_feed();
create trigger grupo_validar_comentario before insert on public.grupo_comentario
for each row execute function public.grupo_validar_feed();

create or replace function public.grupo_criar(p_nome text, p_descricao text, p_senha text, p_disciplinas text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id integer; v_disc text;
begin
  if v_uid is null then raise exception 'Faça login.'; end if;
  if char_length(btrim(coalesce(p_nome,''))) not between 3 and 20 then raise exception 'O nome deve ter de 3 a 20 caracteres.'; end if;
  if char_length(coalesce(p_descricao,'')) > 200 then raise exception 'A descrição deve ter até 200 caracteres.'; end if;
  if coalesce(p_senha, '') !~ '^[0-9]{8}$' then
    raise exception 'A senha deve ter exatamente 8 números.' using errcode = '22023';
  end if;
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

create or replace function public.grupo_alterar_descricao(p_grupo integer, p_descricao text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.participacao
  where id_grupo = p_grupo and id_usuario = auth.uid() and organizador
  for share;
  if not found then
    raise exception 'Somente organizadores podem alterar a descrição.' using errcode = '42501';
  end if;

  if char_length(coalesce(p_descricao, '')) > 200 then
    raise exception 'A descrição deve ter até 200 caracteres.' using errcode = '22023';
  end if;

  update public.grupo_estudo
  set descricao = nullif(btrim(p_descricao), '')
  where id_grupo = p_grupo;
end;
$$;

create or replace function public.grupo_alterar_senha(p_grupo integer, p_senha text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.participacao
  where id_grupo = p_grupo and id_usuario = auth.uid() and organizador
  for share;
  if not found then
    raise exception 'Somente organizadores podem alterar a senha.' using errcode = '42501';
  end if;

  if coalesce(p_senha, '') !~ '^[0-9]{8}$' then
    raise exception 'A senha deve ter exatamente 8 números.' using errcode = '22023';
  end if;

  insert into public.grupo_senha (id_grupo, senha) values (p_grupo, p_senha)
  on conflict (id_grupo) do update set senha = excluded.senha;
end;
$$;

create or replace function public.grupo_listar()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id_grupo,'nome',g.nome_grupo,'descricao',g.descricao,'foto_grupo',g.foto_grupo,
    'membros',(select count(*) from public.participacao p2 where p2.id_grupo=g.id_grupo),
    'disciplinas',(select coalesce(jsonb_agg(d.nome order by d.nome),'[]'::jsonb) from public.grupo_disciplina d where d.id_grupo=g.id_grupo)
  ) order by g.nome_grupo),'[]'::jsonb)
  from public.grupo_estudo g join public.participacao p on p.id_grupo=g.id_grupo
  where p.id_usuario=auth.uid();
$$;

create or replace function public.grupo_explorar(p_nome text, p_antes integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(grupo) order by grupo.id desc), '[]'::jsonb)
  from (
    select g.id_grupo as id, g.nome_grupo as nome, g.descricao, g.foto_grupo,
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

create or replace function public.grupo_detalhes(p_grupo integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.grupo_eh_membro(p_grupo,auth.uid()) then raise exception 'Você não faz parte deste grupo.'; end if;
  select jsonb_build_object(
    'id',g.id_grupo,'nome',g.nome_grupo,'descricao',g.descricao,'foto_grupo',g.foto_grupo,'criado_em',g.data_criacao,
    'criador',g.id_criador,'sou_organizador',public.grupo_eh_organizador(p_grupo,auth.uid()),
    'senha',case when public.grupo_eh_organizador(p_grupo,auth.uid()) then (select s.senha from public.grupo_senha s where s.id_grupo=p_grupo) else null end,
    'disciplinas',(select coalesce(jsonb_agg(d.nome order by d.nome),'[]'::jsonb) from public.grupo_disciplina d where d.id_grupo=p_grupo),
    'membros',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id_usuario,'nome',nullif(btrim(coalesce(e.primeiro_nome,'')||' '||coalesce(e.sobrenome,'')),''),
      'organizador',p.organizador,'foto_url',e.foto_url) order by p.organizador desc,e.primeiro_nome),'[]'::jsonb)
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
    select gm.id,gm.id_usuario,gm.texto,gm.criada_em,gm.midia,gm.midia_tipo,
      coalesce(nullif(btrim(coalesce(e.primeiro_nome,'')||' '||coalesce(e.sobrenome,'')),''),'Estudante') as nome
    from public.grupo_mensagem gm left join public.estudante e on e.id_usuario=gm.id_usuario
    where gm.id_grupo=p_grupo and (p_antes is null or gm.id<p_antes)
    order by gm.id desc limit 50
  ) m;
  return v_result;
end $$;

create function public.grupo_perfil_participante(p_grupo integer, p_usuario uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'nome', coalesce(nullif(btrim(concat_ws(' ', e.primeiro_nome, e.sobrenome)), ''), 'Estudante'),
    'username', e.username, 'foto_url', e.foto_url, 'curso', c.nome_curso, 'semestre', e.semestre,
    'nivel', n.nivel, 'nivel_nome', n.nome, 'pontos', coalesce(gp.pontos_acumulados, 0)
  )
  from public.participacao p
  left join public.estudante e on e.id_usuario = p.id_usuario
  left join public.curso c on c.id_curso = e.id_curso
  left join public.gam_perfil gp on gp.id_usuario = p.id_usuario
  left join public.gam_nivel n on n.nivel = coalesce(gp.nivel, 1)
  where p.id_grupo = p_grupo and p.id_usuario = p_usuario
    and public.grupo_eh_membro(p_grupo, auth.uid());
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midias-de-grupos', 'midias-de-grupos', false, 20971520, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/webm'
]);

-- O caminho inclui grupo, finalidade, autor e identificador aleatório.
create function public.grupo_pode_enviar_arquivo(p_caminho text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_grupo bigint;
begin
  if auth.uid() is null or
    p_caminho !~ '^[0-9]{1,10}/(avatar|media)/[0-9a-f-]{36}/[0-9a-f-]{36}$' or
    split_part(p_caminho, '/', 3) <> auth.uid()::text then
    return false;
  end if;
  v_grupo := split_part(p_caminho, '/', 1)::bigint;
  if v_grupo > 2147483647 then return false; end if;
  if split_part(p_caminho, '/', 2) = 'avatar' then
    return public.grupo_eh_organizador(v_grupo::integer, auth.uid());
  end if;
  return public.grupo_eh_membro(v_grupo::integer, auth.uid());
end;
$$;

create function public.grupo_arquivo_em_uso(p_caminho text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.grupo_estudo where foto_grupo = p_caminho)
    or exists (select 1 from public.grupo_mensagem where midia = p_caminho)
    or exists (select 1 from public.grupo_postagem where midia = p_caminho);
$$;

create function public.grupo_pode_ler_arquivo(p_caminho text, p_dono text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_grupo bigint;
begin
  if auth.uid() is null or
    p_caminho !~ '^[0-9]{1,10}/(avatar|media)/[0-9a-f-]{36}/[0-9a-f-]{36}$' then return false; end if;
  if p_dono = auth.uid()::text and not public.grupo_arquivo_em_uso(p_caminho) then return true; end if;
  v_grupo := split_part(p_caminho, '/', 1)::bigint;
  if v_grupo > 2147483647 then return false; end if;
  if split_part(p_caminho, '/', 2) = 'avatar' then
    return exists (select 1 from public.grupo_estudo where id_grupo = v_grupo and foto_grupo = p_caminho);
  end if;
  return public.grupo_eh_membro(v_grupo::integer, auth.uid()) and public.grupo_arquivo_em_uso(p_caminho);
end;
$$;

create index grupo_foto_caminho on public.grupo_estudo (foto_grupo) where foto_grupo is not null;
create index grupo_mensagem_midia_caminho on public.grupo_mensagem (midia) where midia is not null;
create index grupo_postagem_midia_caminho on public.grupo_postagem (midia) where midia is not null;

create policy grupo_storage_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'midias-de-grupos' and public.grupo_pode_enviar_arquivo(name));
create policy grupo_storage_ler on storage.objects for select to authenticated
  using (bucket_id = 'midias-de-grupos' and public.grupo_pode_ler_arquivo(name, owner_id));
create policy grupo_storage_descartar on storage.objects for delete to authenticated
  using (bucket_id = 'midias-de-grupos' and owner_id = (select auth.uid())::text
    and not public.grupo_arquivo_em_uso(name));

create function public.grupo_validar_arquivo(p_grupo integer, p_caminho text, p_finalidade text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text;
  v_tamanho bigint;
begin
  if p_caminho is null then return null; end if;
  if not public.grupo_pode_enviar_arquivo(p_caminho)
    or split_part(p_caminho, '/', 1) <> p_grupo::text
    or split_part(p_caminho, '/', 2) <> p_finalidade then
    raise exception 'Arquivo inválido para este grupo.' using errcode = '22023';
  end if;
  select metadata->>'mimetype', (metadata->>'size')::bigint
  into v_tipo, v_tamanho
  from storage.objects
  where bucket_id = 'midias-de-grupos' and name = p_caminho and owner_id = auth.uid()::text;

  if v_tipo is null or (p_finalidade = 'avatar' and
    (v_tipo not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
      or coalesce(v_tamanho, 3145729) > 3145728)) then
    raise exception 'Arquivo não encontrado ou incompatível.' using errcode = '22023';
  end if;
  return v_tipo;
end;
$$;

create function public.grupo_salvar_foto(p_grupo integer, p_caminho text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.participacao
  where id_grupo = p_grupo and id_usuario = auth.uid() and organizador
  for share;
  if not found then
    raise exception 'Somente organizadores podem alterar a foto.' using errcode = '42501';
  end if;
  perform public.grupo_validar_arquivo(p_grupo, p_caminho, 'avatar');
  update public.grupo_estudo set foto_grupo = p_caminho where id_grupo = p_grupo;
end;
$$;

create function public.grupo_enviar_mensagem_com_midia(p_grupo integer, p_texto text, p_midia text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
begin
  perform 1 from public.participacao where id_grupo = p_grupo and id_usuario = auth.uid() for share;
  if not found then
    raise exception 'Você não faz parte deste grupo.' using errcode = '42501';
  end if;
  insert into public.grupo_mensagem (id_grupo, id_usuario, texto, midia, midia_tipo)
  values (p_grupo, auth.uid(), nullif(btrim(p_texto), ''), p_midia,
    public.grupo_validar_arquivo(p_grupo, p_midia, 'media'))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.grupo_publicar_com_midia(p_grupo integer, p_titulo text, p_texto text, p_link text, p_midia text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_autor text := public.grupo_feed_autor(p_grupo);
  v_postagem public.grupo_postagem%rowtype;
begin
  insert into public.grupo_postagem (id_grupo, id_autor, autor, titulo, texto, link, midia, midia_tipo)
  values (p_grupo, auth.uid(), v_autor, nullif(btrim(p_titulo), ''), nullif(btrim(p_texto), ''),
    nullif(btrim(p_link), ''), p_midia, public.grupo_validar_arquivo(p_grupo, p_midia, 'media'))
  returning * into v_postagem;
  return to_jsonb(v_postagem);
end;
$$;

revoke all on function public.grupo_validar_textos(), public.grupo_validar_feed(),
  public.grupo_pode_enviar_arquivo(text), public.grupo_pode_ler_arquivo(text, text),
  public.grupo_arquivo_em_uso(text), public.grupo_validar_arquivo(integer, text, text),
  public.grupo_salvar_foto(integer, text), public.grupo_perfil_participante(integer, uuid),
  public.grupo_enviar_mensagem_com_midia(integer, text, text),
  public.grupo_publicar_com_midia(integer, text, text, text, text) from public, anon, authenticated;

grant execute on function public.grupo_pode_enviar_arquivo(text), public.grupo_pode_ler_arquivo(text, text),
  public.grupo_arquivo_em_uso(text), public.grupo_salvar_foto(integer, text),
  public.grupo_perfil_participante(integer, uuid), public.grupo_enviar_mensagem_com_midia(integer, text, text),
  public.grupo_publicar_com_midia(integer, text, text, text, text) to authenticated;

commit;
