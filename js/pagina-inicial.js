// js/pagina-inicial.js
// Liga a página inicial aos dados reais: nome (estudante), pontos e nível (gam_perfil via gam_painel)
// e sessões (gam_sessao).
import { supabase } from "./supabaseClient.js";
import { exigirLogin } from "./protecao.js";
import { carregarPainel } from "./gamificacao.js";
import { FUSO_ESTUDOS, chaveLocal, minutosDaSemana, somarDias } from "./estudo-datas.js";

const META_SEMANAL_MIN = 360; // 6h. O banco ainda não guarda meta, então fica aqui.

const $ = id => document.getElementById(id);
const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_ESTUDOS, day: "numeric", month: "short", year: "numeric" });

const chaveDoDia = chaveLocal;

function formatarMinutos(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function rotuloData(finalizadaEm) {
  const chave = chaveDoDia(finalizadaEm);
  const hoje = chaveDoDia(new Date());
  const ontem = somarDias(hoje, -1);
  const data = fmtData.format(new Date(finalizadaEm));
  if (chave === hoje) return `Hoje, ${data}`;
  if (chave === ontem) return `Ontem, ${data}`;
  return data;
}

function mostrarErro(msg) { const el = $("erro-home"); el.textContent = msg; el.hidden = false; }

// ---------- Cartões ----------
function renderNome(nome) {
  $("saudacao").textContent = nome ? `Olá, ${nome}!` : "Seja bem-vindo(a)!";
}

function renderPainel(painel) {
  const { pontos_acumulados, nivel, nivel_nome } = painel.perfil;
  $("pontos-total").textContent = `${pontos_acumulados} pts`;
  $("nivel-texto").textContent = `Nível ${nivel} - `;
  $("nivel-nome").textContent = nivel_nome;
  $("badge-nivel").textContent = nivel_nome;
}

// ---------- Sessões ----------
function renderHoras(sessoes) {
  const total = sessoes.reduce((soma, s) => soma + (s.minutos_validos ?? 0), 0);
  $("horas-total").textContent = formatarMinutos(total);
  $("sessoes-total").textContent = String(sessoes.length);
}

function renderSemana(sessoes) {
  const { minutes: minutos } = minutosDaSemana(sessoes, new Date());
  const totalSemana = minutos.reduce((a, b) => a + b, 0);

  $("meta-texto").textContent = `${formatarMinutos(totalSemana)} de ${META_SEMANAL_MIN / 60}h da meta semanal`;
  $("meta-barra").style.width = `${Math.min(100, Math.round((totalSemana / META_SEMANAL_MIN) * 100))}%`;

  const escala = Math.max(60, ...minutos);
  minutos.forEach((min, i) => {
    const barra = $(`barra-${i}`);
    barra.className = "w-8 lg:w-10 rounded-t-md chart-bar " +
      (min > 0 ? "bg-gradient-to-t from-mint/80 to-mint" : "bg-white/20");
    barra.title = formatarMinutos(min);
    // 0% primeiro e depois o valor final, para a animação de subida
    barra.style.height = "0%";
    const alvo = min > 0 ? Math.max(10, Math.round((min / escala) * 100)) : 8;
    setTimeout(() => (barra.style.height = `${alvo}%`), 100);
  });
}

function renderOfensiva(value) {
  const days = Number(value) || 0;
  $("home-streak-count").textContent = days;
  $("home-streak-label").textContent = days === 1 ? "dia seguido estudando" : "dias seguidos estudando";
}

function itemSessao(s) {
  const linha = document.createElement("div");
  linha.className = "py-4 border-b border-gray-100 flex justify-between items-center rounded-lg px-2 -mx-2";

  const esquerda = document.createElement("div");
  const titulo = document.createElement("h4");
  titulo.className = "font-bold text-mint";
  titulo.textContent = s.disciplina;
  const sub = document.createElement("p");
  sub.className = "text-xs text-textMuted mt-1";
  sub.textContent = rotuloData(s.finalizada_em) + (s.conteudo ? ` · ${s.conteudo}` : "");
  esquerda.append(titulo, sub);

  const duracao = document.createElement("span");
  duracao.className = "font-bold text-darkBlue";
  duracao.textContent = `${s.minutos_validos} min`;

  linha.append(esquerda, duracao);
  return linha;
}

function renderUltimas(sessoes) {
  const lista = $("lista-sessoes");
  const recentes = sessoes.filter(s => (s.minutos_validos ?? 0) > 0).slice(0, 4); // já vêm da mais nova para a mais antiga
  if (recentes.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "text-sm text-textMuted text-center";
    vazio.textContent = "Você ainda não tem sessões. Que tal começar agora?";
    lista.replaceChildren(vazio);
    return;
  }
  lista.replaceChildren(...recentes.map(itemSessao));
}

// ---------- Carregamento ----------
async function buscarNome(userId) {
  const { data, error } = await supabase.from("estudante")
    .select("primeiro_nome").eq("id_usuario", userId).maybeSingle();
  if (error) { console.error(error); return null; }
  return data?.primeiro_nome ?? null;
}

async function buscarSessoes() {
  const sessoes = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("gam_sessao")
      .select("disciplina, conteudo, finalizada_em, minutos_validos")
      .not("finalizada_em", "is", null)
      .order("finalizada_em", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    sessoes.push(...data);
    if (data.length < pageSize) return sessoes;
  }
}

async function sair() {
  await supabase.auth.signOut();
  window.location.href = "../index.html";
}

let atualizando = false;
async function atualizarIndicadores() {
  if (atualizando) return;
  atualizando = true;
  try {
    const [painel, sessoes, ofensiva] = await Promise.allSettled([
      carregarPainel(), buscarSessoes(),
      supabase.rpc("gam_ofensiva").then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data;
      })
    ]);
    if (painel.status === "fulfilled") renderPainel(painel.value);
    if (sessoes.status === "fulfilled") {
      renderHoras(sessoes.value);
      renderSemana(sessoes.value);
      renderUltimas(sessoes.value);
    }
    if (ofensiva.status === "fulfilled") renderOfensiva(ofensiva.value);
  } finally {
    atualizando = false;
  }
}

async function iniciar() {
  if (!(await exigirLogin())) return;
  $("btn-sair").addEventListener("click", e => { e.preventDefault(); sair(); });

  const { data: { session } } = await supabase.auth.getSession();
  const [nome, painel, sessoes, ofensiva] = await Promise.allSettled([
    session ? buscarNome(session.user.id) : null,
    carregarPainel(),
    buscarSessoes(),
    supabase.rpc("gam_ofensiva").then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return data;
    }),
  ]);

  renderNome(nome.status === "fulfilled" ? nome.value : null);
  if (painel.status === "fulfilled") renderPainel(painel.value);
  else mostrarErro("Não foi possível carregar seus pontos. " + painel.reason.message);

  if (sessoes.status === "fulfilled") {
    renderHoras(sessoes.value);
    renderSemana(sessoes.value);
    renderUltimas(sessoes.value);
  } else {
    mostrarErro("Não foi possível carregar suas sessões. " + sessoes.reason.message);
  }
  if (ofensiva.status === "fulfilled") renderOfensiva(ofensiva.value);
  else $("home-streak-count").textContent = "—";

  if (session) {
    supabase.channel(`home-sessoes-${session.user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "gam_sessao", filter: `id_usuario=eq.${session.user.id}`
      }, atualizarIndicadores)
      .subscribe();
    setInterval(() => { if (!document.hidden) atualizarIndicadores(); }, 60000);
    document.addEventListener?.("visibilitychange", () => {
      if (!document.hidden) atualizarIndicadores();
    });
  }
}
iniciar();
