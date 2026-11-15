-- Execute como administrador no SQL Editor. O resultado final lista as senhas para exportação.
begin;

lock table public.grupo_estudo in share mode;
lock table public.grupo_senha in share row exclusive mode;

do $$
declare
  v_grupo record;
  v_senha text;
  v_aleatorio bytea;
begin
  -- Compatibilidade se a versão anterior com comprimento variável já estiver aplicada.
  if to_regclass('public.grupo_senha_formato') is not null then
    update public.grupo_senha_formato set comprimento = 8 where id = 1;
  end if;

  -- A restrição marca a rotação concluída. Executar de novo só retorna a lista atual.
  if exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.grupo_senha'::regclass and conname = 'grupo_senha_formato_oito_digitos'
  ) then
    return;
  end if;

  for v_grupo in
    select g.id_grupo, s.senha
    from public.grupo_estudo g
    left join public.grupo_senha s on s.id_grupo = g.id_grupo
  loop
    loop
      v_aleatorio := uuid_send(gen_random_uuid());
      v_senha := lpad(mod(
        get_byte(v_aleatorio, 0)::bigint * 16777216 +
        get_byte(v_aleatorio, 1)::bigint * 65536 +
        get_byte(v_aleatorio, 2)::bigint * 256 +
        get_byte(v_aleatorio, 3)::bigint,
        100000000::bigint
      )::text, 8, '0');
      exit when v_senha is distinct from v_grupo.senha;
    end loop;

    insert into public.grupo_senha (id_grupo, senha) values (v_grupo.id_grupo, v_senha)
    on conflict (id_grupo) do update set senha = excluded.senha;
  end loop;

  alter table public.grupo_senha add constraint grupo_senha_formato_oito_digitos
    check (senha ~ '^[0-9]{8}$');
end;
$$;

commit;

-- Consulta administrativa. Mantenha a coluna senha como texto para preservar zeros à esquerda.
select g.id_grupo, g.nome_grupo as grupo, s.senha
from public.grupo_estudo g
join public.grupo_senha s on s.id_grupo = g.id_grupo
order by g.nome_grupo, g.id_grupo;
