// js/gamificacao-util.js
// Funções PURAS da gamificação (sem Supabase/DOM), por isso testáveis em Node.
// O cálculo oficial de pontos fica no banco (supabase/migrations/...gamificacao.sql);
// aqui só validamos entrada, calculamos o progresso de nível e montamos as mensagens.

// Converte as linhas da tabela gam_regra ([{chave, valor}]) em { chave: valor }
export function regrasComoObjeto(linhas) {
  return Object.fromEntries((linhas ?? []).map(l => [l.chave, Number(l.valor)]));
}

// Mesma regra do servidor: espaços das pontas não contam; vazio é opcional/obrigatório conforme a regra.
export function validarResumo(texto, regras) {
  const limpo = String(texto ?? "").trim();
  const min = regras.resumo_min_caracteres ?? 10;
  const max = regras.resumo_max_caracteres ?? 1000;
  if (!limpo) {
    return regras.resumo_obrigatorio === 1
      ? { ok: false, texto: null, erro: "O resumo é obrigatório." }
      : { ok: true, texto: null, erro: "" };
  }
  if (limpo.length < min) return { ok: false, texto: limpo, erro: `O resumo precisa ter pelo menos ${min} caracteres.` };
  if (limpo.length > max) return { ok: false, texto: limpo, erro: `O resumo pode ter no máximo ${max} caracteres.` };
  return { ok: true, texto: limpo, erro: "" };
}

// Nível correspondente a um total de pontos (niveis = [{nivel, nome, pontos_minimos}])
export function nivelDe(pontos, niveis) {
  const ordenados = [...niveis].sort((a, b) => a.pontos_minimos - b.pontos_minimos);
  let atual = ordenados[0];
  for (const n of ordenados) if (pontos >= n.pontos_minimos) atual = n;
  return atual;
}

// Progresso até o próximo nível: { atual, proximo|null, percentual 0-100, faltam }
export function progressoNivel(pontos, niveis) {
  const atual = nivelDe(pontos, niveis);
  const proximo = [...niveis]
    .sort((a, b) => a.pontos_minimos - b.pontos_minimos)
    .find(n => n.pontos_minimos > atual.pontos_minimos) ?? null;
  if (!proximo) return { atual, proximo: null, percentual: 100, faltam: 0 };
  const faixa = proximo.pontos_minimos - atual.pontos_minimos;
  const feito = pontos - atual.pontos_minimos;
  return { atual, proximo, percentual: Math.min(100, Math.floor((feito / faixa) * 100)), faltam: proximo.pontos_minimos - pontos };
}

const ROTULO_MOTIVO = { tempo: "Tempo de foco", conclusao: "Pomodoro concluído", resumo: "Resumo da sessão", resgate: "Resgate de recompensa" };
export const rotuloMotivo = motivo => ROTULO_MOTIVO[motivo] ?? motivo;

// Transforma o resultado de finalizar_sessao/salvar_resumo em avisos para a tela.
// Cada aviso: { tipo: 'pontos'|'nivel'|'conquista'|'recompensa'|'info', icone, texto }
export function mensagensDeResultado(res) {
  const msgs = [];
  if (res.pontos_ganhos_agora > 0) {
    msgs.push({ tipo: "pontos", icone: "⭐", texto: `+${res.pontos_ganhos_agora} pontos` });
  } else if (res.ja_finalizada) {
    msgs.push({ tipo: "info", icone: "ℹ️", texto: "Nenhum ponto novo: esta sessão já foi pontuada." });
  } else if (!res.elegivel) {
    msgs.push({ tipo: "info", icone: "ℹ️", texto: "Sessão curta demais para pontuar. Tente focar um pouco mais na próxima." });
  } else {
    msgs.push({ tipo: "info", icone: "ℹ️", texto: "Você atingiu o limite de pontos de hoje. Volte amanhã!" });
  }
  if (res.subiu_de_nivel) msgs.push({ tipo: "nivel", icone: "🚀", texto: `Novo nível: ${res.nivel.nome} (nível ${res.nivel.nivel})!` });
  for (const c of res.conquistas_novas ?? []) msgs.push({ tipo: "conquista", icone: c.icone, texto: `Conquista desbloqueada: ${c.nome}` });
  for (const r of res.recompensas_liberadas ?? []) msgs.push({ tipo: "recompensa", icone: r.icone, texto: `Recompensa liberada: ${r.nome}` });
  return msgs;
}

// Texto curto do estado de uma recompensa (usado no painel)
export function textoEstadoRecompensa(r) {
  switch (r.estado) {
    case "resgatada": return "Resgatada";
    case "disponivel": return r.custo_pontos > 0 ? `Resgatar por ${r.custo_pontos} pts` : "Resgatar grátis";
    case "sem_saldo": return `Faltam pontos (${r.custo_pontos} pts)`;
    default: {
      const req = [];
      if (r.nivel_minimo > 1) req.push(`nível ${r.nivel_minimo}`);
      if (r.conquista_requerida_nome) req.push(`conquista "${r.conquista_requerida_nome}"`);
      return `Bloqueada: requer ${req.join(" e ")}`;
    }
  }
}
