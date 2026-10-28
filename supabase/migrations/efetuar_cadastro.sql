-- =====================================================================
-- Studyholics — correção do gatilho de cadastro
--
-- Problema: o cadastro falhava com HTTP 500 porque existia no banco uma
-- função antiga, public.criar_perfil_usuario(), que gravava em
-- public.usuarios (tabela que NÃO existe). O erro derrubava o cadastro
-- inteiro.
--
-- O que este script faz: deixa o banco igual ao esquema oficial do
-- projeto (schema.sql), com UM único gatilho:
--     on_auth_user_created  ->  public.handle_new_user()
--
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run.
-- Combine com a equipe antes (o projeto é compartilhado / PRODUCTION).
--
-- Seguro de rodar mais de uma vez. Roda tudo ou nada (begin/commit):
-- se algo falhar no meio, nada é alterado.
-- NÃO rode o schema.sql inteiro de novo: ele só serve para banco vazio.
-- =====================================================================

begin;

-- 1) Remove qualquer gatilho de auth.users que chame uma das duas funções
--    (a antiga e a oficial). Assim evitamos dois gatilhos inserindo o
--    mesmo estudante duas vezes (o que daria erro de chave duplicada).
do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and p.proname in ('criar_perfil_usuario', 'handle_new_user')
  loop
    execute format('drop trigger %I on auth.users', r.tgname);
  end loop;
end
$$;

-- 2) Remove a função antiga (a que apontava para a tabela inexistente)
drop function if exists public.criar_perfil_usuario();

-- 3) Cria (ou atualiza) a função oficial, igual à do schema.sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.estudante
    (id_usuario, primeiro_nome, sobrenome, username, email, id_curso, semestre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'primeiro_nome', ''),
    coalesce(new.raw_user_meta_data ->> 'sobrenome', ''),
    new.raw_user_meta_data ->> 'username',
    new.email,
    nullif(new.raw_user_meta_data ->> 'id_curso', '')::integer,
    nullif(new.raw_user_meta_data ->> 'semestre', '')::smallint
  );
  return new;
end;
$$;

-- 4) Liga o gatilho oficial
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;

-- =====================================================================
-- Conferência (rode depois, separado). Deve voltar EXATAMENTE 1 linha:
--   on_auth_user_created | handle_new_user
--
-- select t.tgname as gatilho, p.proname as funcao
-- from pg_trigger t
-- join pg_proc p on p.oid = t.tgfoid
-- where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;
-- =====================================================================
