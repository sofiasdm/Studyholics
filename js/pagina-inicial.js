// js/pagina-inicial.js
// Liga a página inicial aos dados reais: nome (estudante), pontos e nível (gam_perfil via gam_painel)
// e sessões (gam_sessao).
import { supabase } from "./supabaseClient.js";
import { exigirLogin } from "./protecao.js";
import { carregarPainel } from "./gamificacao.js";

const FUSO = "America/Sao_Paulo";
const META_SEMANAL_MIN = 360; // 6h. O banco ainda não guarda meta, então fica aqui.

const $ = id => document.getElementById(id);
const fmtChave = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }); // AAAA-MM-DD
const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "numeric", month: "short", year: "numeric" });

const chaveDoDia = data => fmtChave.format(new Date(data));
const DIA_MS = 86400000;

function formatarMinutos(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

// Chaves AAAA-MM-DD de segunda a domingo da semana atual (fuso de São Paulo)
function semanaAtual() {
  const [a, m, d] = chaveDoDia(new Date()).split("-").map(Number);
  const hoje = Date.UTC(a, m - 1, d);
  const segunda = hoje - ((new Date(hoje).getUTCDay() + 6) % 7) * DIA_MS;
  return Array.from({ length: 7 }, (_, i) => new Date(segunda + i * DIA_MS).toISOString().slice(0, 10));
}

function rotuloData(finalizadaEm) {
  const chave = chaveDoDia(finalizadaEm);
  const [a, m, d] = chaveDoDia(new Date()).split("-").map(Number);
  const hoje = Date.UTC(a, m - 1, d);
  const ontem = new Date(hoje - DIA_MS).toISOString().slice(0, 10);
  const data = fmtData.format(new Date(finalizadaEm));
  if (chave === new Date(hoje).toISOString().slice(0, 10)) return `Hoje, ${data}`;
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
}

function renderSemana(sessoes) {
  const dias = semanaAtual();
  const porDia = Object.fromEntries(dias.map(d => [d, 0]));
  for (const s of sessoes) {
    const k = chaveDoDia(s.finalizada_em);
    if (k in porDia) porDia[k] += s.minutos_validos ?? 0;
  }
  const minutos = dias.map(d => porDia[d]);
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
  const { data, error } = await supabase.from("gam_sessao")
    .select("disciplina, conteudo, finalizada_em, minutos_validos")
    .not("finalizada_em", "is", null)
    .order("finalizada_em", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return data;
}

async function sair() {
  await supabase.auth.signOut();
  window.location.href = "../index.html";
}

async function iniciar() {
  if (!(await exigirLogin())) return;
  $("btn-sair").addEventListener("click", e => { e.preventDefault(); sair(); });

  const { data: { session } } = await supabase.auth.getSession();
  const [nome, painel, sessoes] = await Promise.allSettled([
    session ? buscarNome(session.user.id) : null,
    carregarPainel(),
    buscarSessoes(),
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
}
iniciar();