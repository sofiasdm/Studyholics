-- Retorna somente se o e-mail está livre; não expõe dados da conta existente.
create or replace function public.email_disponivel(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from auth.users as u
    where lower(u.email) = lower(trim(p_email))
  );
$$;

revoke all on function public.email_disponivel(text) from public;
grant execute on function public.email_disponivel(text) to anon, authenticated;
