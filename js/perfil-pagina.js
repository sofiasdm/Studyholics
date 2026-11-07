// js/perfil-pagina.js
// Tela "Meu perfil" (pages/perfil.html): mostra os dados reais do estudante logado.
//  - nome, foto, curso, semestre e campus  -> tabela estudante
//  - e-mail                                -> conta de login (Supabase Auth)
//  - nível e pontos                        -> gam_perfil (via gam_painel)
//  - horas, sessões e resumos              -> gam_sessao
import { supabase } from "./supabaseClient.js";
import { exigirLogin } from "./protecao.js";
import { carregarPainel } from "./gamificacao.js";
import { progressoNivel } from "./gamificacao-util.js";
import { buscarPerfil, buscarEstatisticas } from "./perfil.js";
import { formatarMinutos, rotuloSemestre, textoXp } from "./perfil-util.js";

const $ = id => document.getElementById(id);

function mostrarErro(msg) {
  const el = $("erro-perfil");
  el.textContent = el.textContent ? `${el.textContent} ${msg}` : msg;
  el.hidden = false;
}

// textContent: o que vem do banco nunca vira HTML
function renderPerfil(perfil, email) {
  $("email").textContent = email ?? "";
  if (!perfil) {
    $("nome-completo").textContent = "Estudante";
    ["info-curso", "info-semestre", "info-campus"].forEach(id => ($(id).textContent = "Não informado"));
    return mostrarErro("Não encontramos os dados do seu perfil.");
  }
  $("nome-completo").textContent = `${perfil.primeiro_nome} ${perfil.sobrenome}`.trim() || "Estudante";
  $("info-curso").textContent = perfil.curso?.nome_curso ?? "Não informado";
  $("info-semestre").textContent = rotuloSemestre(perfil.semestre);
  $("info-campus").textContent = perfil.campus ?? "Não informado";

  if (perfil.foto_url) {
    const img = $("avatar-img");
    img.onerror = () => { img.hidden = true; $("avatar-icone").hidden = false; }; // foto quebrada: volta ao ícone
    img.src = perfil.foto_url;
    img.hidden = false;
    $("avatar-icone").hidden = true;
  }
}

function renderNivel(painel) {
  const { pontos_acumulados, nivel, nivel_nome } = painel.perfil;
  const progresso = progressoNivel(pontos_acumulados, painel.niveis);
  $("nivel-numero").textContent = nivel;
  $("nivel-nome").textContent = nivel_nome;
  $("xp-texto").textContent = textoXp(pontos_acumulados, progresso.proximo);
  $("xp-barra").style.width = `${progresso.percentual}%`;
}

function renderEstatisticas(est) {
  $("stat-horas").textContent = formatarMinutos(est.minutos);
  $("stat-sessoes").textContent = est.sessoes;
  $("stat-resumos").textContent = est.resumos;
}

async function sair() {
  await supabase.auth.signOut();
  window.location.href = "../index.html";
}

async function iniciar() {
  const sessao = await exigirLogin();
  if (!sessao) return;
  $("btn-sair").addEventListener("click", e => { e.preventDefault(); sair(); });

  const [perfil, painel, estatisticas] = await Promise.allSettled([
    buscarPerfil(sessao.user.id),
    carregarPainel(),
    buscarEstatisticas(),
  ]);

  if (perfil.status === "fulfilled") renderPerfil(perfil.value, sessao.user.email);
  else { renderPerfil(null, sessao.user.email); mostrarErro(perfil.reason.message); }

  if (painel.status === "fulfilled") renderNivel(painel.value);
  else mostrarErro("Não foi possível carregar seu nível. " + painel.reason.message);

  if (estatisticas.status === "fulfilled") renderEstatisticas(estatisticas.value);
  else mostrarErro("Não foi possível carregar suas estatísticas. " + estatisticas.reason.message);
}
iniciar();