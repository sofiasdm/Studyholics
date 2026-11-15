-- A entrada em grupos exige a senha; organizadores não podem adicionar por e-mail.
revoke execute on function public.grupo_adicionar_por_email(integer, text)
  from public, anon, authenticated;
