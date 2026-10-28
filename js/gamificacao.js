// js/gamificacao.js
// Chamadas ao Supabase da gamificação. Toda escrita passa por RPCs (o banco calcula e valida);
// as tabelas gam_* só aceitam leitura do próprio usuário (RLS).
import { supabase } from "./supabaseClient.js";
import { regrasComoObjeto } from "./gamificacao-util.js";

async function rpc(nome, args) {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw new Error(error.message || "Não foi possível concluir. Tente novamente.");
  return data;
}

export async function carregarRegras() {
  const { data, error } = await supabase.from("gam_regra").select("chave, valor");
  if (error) throw new Error(error.message);
  return regrasComoObjeto(data);
}

export const iniciarSessao = (disciplina, conteudo, minutosPlanejados) =>
  rpc("iniciar_sessao", { p_disciplina: disciplina, p_conteudo: conteudo, p_minutos_planejados: minutosPlanejados });

export const finalizarSessao = (idSessao, minutosFocados, resumo) =>
  rpc("finalizar_sessao", { p_id_sessao: idSessao, p_minutos_focados: minutosFocados, p_resumo: resumo });

export const salvarResumo = (idSessao, resumo) =>
  rpc("salvar_resumo", { p_id_sessao: idSessao, p_resumo: resumo });

export const resgatarRecompensa = codigo => rpc("resgatar_recompensa", { p_codigo: codigo });
export const carregarPainel = () => rpc("gam_painel");

// Sessão do próprio usuário (a RLS filtra)
export async function buscarSessao(id) {
  const { data, error } = await supabase.from("gam_sessao")
    .select("id, disciplina, conteudo, minutos_planejados, finalizada_em, minutos_validos, resumo, pontos_ganhos")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Resumos já escritos, mais recentes primeiro
export async function listarResumos(limite = 20) {
  const { data, error } = await supabase.from("gam_sessao")
    .select("id, disciplina, conteudo, resumo, finalizada_em, pontos_ganhos")
    .not("resumo", "is", null)
    .order("finalizada_em", { ascending: false }).limit(limite);
  if (error) throw new Error(error.message);
  return data;
}
