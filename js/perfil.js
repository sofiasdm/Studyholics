// js/perfil.js
// Chamadas ao Supabase do perfil. As telas (perfil-pagina.js e editar-perfil.js) só usam estas funções.
// Quem protege os dados é o RLS do banco: cada estudante só lê e edita a própria linha.
import { supabase } from "./supabaseClient.js";

// Dados do próprio estudante + nome do curso (o curso vem da tabela CURSO pela chave id_curso)
export async function buscarPerfil(userId) {
  const { data, error } = await supabase.from("estudante")
    .select("primeiro_nome, sobrenome, semestre, campus, foto_url, id_curso, curso(nome_curso)")
    .eq("id_usuario", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data; // null se a linha não existir
}

// Números do cartão de estatísticas. Fonte: gam_sessao (gamificação), a mesma da página inicial.
//  - horas: soma dos minutos válidos de todas as sessões finalizadas
//  - sessoes: sessões que pontuaram (elegivel = ficou o mínimo de minutos da regra)
//  - resumos: sessões com resumo escrito
export async function buscarEstatisticas() {
  const [horas, sessoes, resumos] = await Promise.all([
    supabase.from("gam_sessao").select("minutos_validos").not("finalizada_em", "is", null).limit(1000),
    supabase.from("gam_sessao").select("id", { count: "exact", head: true }).eq("elegivel", true),
    supabase.from("gam_sessao").select("id", { count: "exact", head: true }).not("resumo", "is", null),
  ]);
  const erro = horas.error ?? sessoes.error ?? resumos.error;
  if (erro) throw new Error(erro.message);
  return {
    minutos: horas.data.reduce((soma, s) => soma + (s.minutos_validos ?? 0), 0),
    sessoes: sessoes.count ?? 0,
    resumos: resumos.count ?? 0,
  };
}

// Cursos para o <select> (tabela CURSO, leitura liberada no banco)
export async function buscarCursos() {
  const { data, error } = await supabase.from("curso")
    .select("id_curso, nome_curso, duracao_periodos")
    .eq("ativo", true)
    .order("nome_curso");
  if (error) throw new Error(error.message);
  return data;
}

// Envia a foto para o bucket "avatars" (pasta com o id do usuário) e devolve a URL pública.
// NÃO grava no banco: quem grava é salvarPerfil, junto com os outros campos.
export async function enviarFoto(arquivo, userId) {
  const caminho = `${userId}/avatar`;
  const { error } = await supabase.storage.from("avatars")
    .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
  if (error) throw new Error("Não foi possível enviar a foto. Tente novamente.");
  const { data } = supabase.storage.from("avatars").getPublicUrl(caminho);
  return `${data.publicUrl}?v=${Date.now()}`; // ?v= evita mostrar a foto antiga (cache)
}

// Atualiza a linha do estudante. Só as colunas liberadas no GRANT do banco são aceitas:
// primeiro_nome, sobrenome, username, id_curso, semestre, foto_url e campus.
export async function salvarPerfil(userId, campos) {
  const { data, error } = await supabase.from("estudante")
    .update(campos)
    .eq("id_usuario", userId)
    .select("id_usuario"); // sem isto, uma regra RLS que bloqueie a edição passaria em silêncio (0 linhas)
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Perfil não encontrado. Saia e entre de novo.");
}