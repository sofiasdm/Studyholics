-- Aplicar após 202611150001_grupos_midias_e_perfis.sql.
begin;

-- O texto comum conserva o limite de 500 caracteres. Resumos têm campo próprio,
-- sem limite de caracteres, e preservam a versão publicada mesmo após edição da sessão.
alter table public.grupo_postagem
  add column id_sessao uuid references public.gam_sessao(id) on delete cascade,
  add column resumo_texto text,
  drop constraint grupo_postagem_texto_check,
  drop constraint grupo_postagem_conteudo,
  add constraint grupo_postagem_conteudo check (texto is not null or link is not null or midia is not null or resumo_texto is not null),
  add constraint grupo_postagem_resumo_consistente check ((id_sessao is null and resumo_texto is null) or (id_sessao is not null and resumo_texto is not null and btrim(resumo_texto) <> ''));
create unique index grupo_postagem_resumo_unico on public.grupo_postagem (id_grupo, id_sessao) where id_sessao is not null;

create or replace function public.grupo_validar_feed()
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

create function public.grupo_publicar_resumo(
  p_grupo integer, p_sessao uuid, p_titulo text, p_resumo text, p_link text, p_midia text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sessao public.gam_sessao%rowtype;
  v_autor text;
  v_postagem public.grupo_postagem%rowtype;
begin
  select * into v_sessao from public.gam_sessao
  where id = p_sessao and id_usuario = auth.uid() and finalizada_em is not null;
  if not found or nullif(btrim(coalesce(v_sessao.resumo, '')), '') is null then
    raise exception 'Sessão com resumo não encontrada.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.grupo_disciplina
    where id_grupo = p_grupo and lower(btrim(nome)) = lower(btrim(v_sessao.disciplina))
  ) then
    raise exception 'O grupo não corresponde à disciplina da sessão.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_resumo, '')), '') is null then
    raise exception 'O resumo não pode ficar vazio.' using errcode = '22023';
  end if;
  v_autor := public.grupo_feed_autor(p_grupo); -- Confirma a participação no grupo.
  insert into public.grupo_postagem
    (id_grupo, id_autor, autor, titulo, resumo_texto, id_sessao, link, midia, midia_tipo)
  values
    (p_grupo, auth.uid(), v_autor, nullif(btrim(p_titulo), ''), p_resumo, p_sessao,
     nullif(btrim(p_link), ''), p_midia, public.grupo_validar_arquivo(p_grupo, p_midia, 'media'))
  returning * into v_postagem;
  return to_jsonb(v_postagem);
end;
$$;

-- Retorna apenas as publicações de resumos de sessões pertencentes ao usuário.
create function public.gam_resumos_compartilhados(p_sessoes uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id_sessao', p.id_sessao, 'id_grupo', p.id_grupo,
    'grupo', g.nome_grupo, 'id_postagem', p.id
  ) order by p.criada_em desc), '[]'::jsonb)
  from public.grupo_postagem p
  join public.gam_sessao s on s.id = p.id_sessao
  join public.grupo_estudo g on g.id_grupo = p.id_grupo
  where p.id_sessao = any(p_sessoes) and s.id_usuario = auth.uid();
$$;

-- Conta a sequência de dias com tempo válido, no fuso apresentado ao usuário.
create function public.gam_ofensiva()
returns integer language sql stable security definer set search_path = '' as $$
  with dias as (
    select distinct (finalizada_em at time zone 'America/Recife')::date as dia
    from public.gam_sessao
    where id_usuario = auth.uid() and finalizada_em is not null and minutos_validos > 0
  ), ancora as (
    select max(dia) as dia from dias
  ), sequencia as (
    select dia, row_number() over (order by dia desc) - 1 as distancia from dias
  )
  select case
    when (select dia from ancora) < (now() at time zone 'America/Recife')::date - 1 then 0
    else count(*) filter (where dia = (select dia from ancora) - distancia::integer)::integer
  end
  from sequencia;
$$;

revoke all on function public.grupo_publicar_resumo(integer, uuid, text, text, text, text),
  public.gam_resumos_compartilhados(uuid[]), public.gam_ofensiva() from public, anon, authenticated;
grant execute on function public.grupo_publicar_resumo(integer, uuid, text, text, text, text),
  public.gam_resumos_compartilhados(uuid[]), public.gam_ofensiva() to authenticated;

commit;
