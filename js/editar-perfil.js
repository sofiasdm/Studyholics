// js/editar-perfil.js
// Tela "Editar perfil" (pages/editar-perfil.html): nome, sobrenome, curso, semestre, campus e foto.
// Fluxo: carrega os dados atuais -> valida (perfil-util.js) -> envia a foto (se trocou) -> grava (perfil.js).
import { supabase } from "./supabaseClient.js";
import { exigirLogin } from "./protecao.js";
import { buscarPerfil, buscarCursos, enviarFoto, salvarPerfil } from "./perfil.js";
import { validarPerfil, validarFoto, CAMPI, LIMITES } from "./perfil-util.js";

const $ = id => document.getElementById(id);
const CAMPOS = ["nome", "sobrenome", "curso", "semestre", "campus"];

let userId = null;
let arquivoFoto = null;   // foto escolhida e ainda não enviada
let urlPrevia = null;     // endereço temporário da pré-visualização

// ---------- Mensagens ----------
function mostrarStatus(texto, tipo = "ok") {
  const el = $("status");
  el.textContent = texto;
  el.className = "mt-4 rounded-xl px-4 py-3 text-sm font-semibold " +
    (tipo === "erro" ? "bg-red-50 text-red-700" : "bg-mintLight text-darkBlue");
  el.hidden = false;
}
function limparStatus() { $("status").hidden = true; }

function mostrarErroCampo(campo, msg) {
  const p = document.querySelector(`[data-erro="${campo}"]`);
  if (p) p.textContent = msg;
  const input = $(campo);
  if (input) input.classList.toggle("border-red-400", Boolean(msg));
}
function limparErros() { [...CAMPOS, "foto"].forEach(c => mostrarErroCampo(c, "")); }

// ---------- Preenchimento ----------
function preencherSelect(select, opcoes, selecionado) {
  const primeiro = select.options[0];            // mantém a opção vazia ("Selecione…")
  select.replaceChildren(primeiro, ...opcoes.map(([valor, texto]) => new Option(texto, valor)));
  select.value = selecionado == null ? "" : String(selecionado);
}

function mostrarFoto(url) {
  const img = $("avatar-img");
  img.onerror = () => { img.hidden = true; $("avatar-icone").hidden = false; };
  img.src = url;
  img.hidden = false;
  $("avatar-icone").hidden = true;
}

function habilitarFormulario(ligado) {
  CAMPOS.forEach(c => ($(c).disabled = !ligado));
  $("btn-salvar").disabled = !ligado;
}

// ---------- Foto ----------
function escolherFoto() {
  const arquivo = $("foto").files[0];
  if (!arquivo) return;
  const erro = validarFoto(arquivo);
  mostrarErroCampo("foto", erro);
  if (erro) { $("foto").value = ""; arquivoFoto = null; return; }
  arquivoFoto = arquivo;
  if (urlPrevia) URL.revokeObjectURL(urlPrevia);
  urlPrevia = URL.createObjectURL(arquivo);
  mostrarFoto(urlPrevia);
}

// ---------- Salvar ----------
async function salvar(e) {
  e.preventDefault();
  limparErros();
  limparStatus();

  const v = validarPerfil({
    nome: $("nome").value,
    sobrenome: $("sobrenome").value,
    idCurso: $("curso").value,
    semestre: $("semestre").value,
    campus: $("campus").value,
  });
  if (!v.ok) {
    Object.entries(v.erros).forEach(([campo, msg]) => mostrarErroCampo(campo, msg));
    $(Object.keys(v.erros)[0]).focus();
    return;
  }

  const botao = $("btn-salvar"), texto = $("btn-salvar-texto");
  botao.disabled = true;
  texto.textContent = "Salvando…";
  try {
    const campos = { ...v.valores };
    if (arquivoFoto) campos.foto_url = await enviarFoto(arquivoFoto, userId);
    await salvarPerfil(userId, campos);
    mostrarStatus("Perfil atualizado com sucesso!");
    texto.textContent = "Salvo!";
    setTimeout(() => (window.location.href = "perfil.html"), 900);
  } catch (err) {
    console.error(err);
    mostrarStatus(err.message || "Não foi possível salvar. Tente novamente.", "erro");
    botao.disabled = false;
    texto.textContent = "Salvar alterações";
  }
}

async function sair() {
  await supabase.auth.signOut();
  window.location.href = "../index.html";
}

// ---------- Início ----------
async function iniciar() {
  const sessao = await exigirLogin();
  if (!sessao) return;
  userId = sessao.user.id;
  $("btn-sair").addEventListener("click", e => { e.preventDefault(); sair(); });

  $("btn-foto").addEventListener("click", () => $("foto").click());
  $("btn-camera").addEventListener("click", () => $("foto").click());
  $("foto").addEventListener("change", escolherFoto);
  $("form-perfil").addEventListener("submit", salvar);
  CAMPOS.forEach(c => $(c).addEventListener("input", () => { mostrarErroCampo(c, ""); limparStatus(); }));

  let perfil, cursos;
  try {
    [perfil, cursos] = await Promise.all([buscarPerfil(userId), buscarCursos()]);
  } catch (err) {
    console.error(err);
    return mostrarStatus("Não foi possível carregar seus dados. " + err.message, "erro");
  }
  if (!perfil) return mostrarStatus("Não encontramos os dados do seu perfil.", "erro");

  $("nome").value = perfil.primeiro_nome ?? "";
  $("sobrenome").value = perfil.sobrenome ?? "";
  $("nome").maxLength = LIMITES.nome;
  $("sobrenome").maxLength = LIMITES.sobrenome;

  preencherSelect($("curso"), cursos.map(c => [c.id_curso, c.nome_curso]), perfil.id_curso);
  $("curso").options[0].textContent = "Selecione seu curso";
  preencherSelect($("semestre"), Array.from({ length: 10 }, (_, i) => [i + 1, `${i + 1}º`]), perfil.semestre);

  // Se o campus gravado não estiver na lista (ex.: valor antigo), ele aparece mesmo assim
  const campi = perfil.campus && !CAMPI.includes(perfil.campus) ? [...CAMPI, perfil.campus] : CAMPI;
  preencherSelect($("campus"), campi.map(c => [c, c]), perfil.campus);

  if (perfil.foto_url) mostrarFoto(perfil.foto_url);
  habilitarFormulario(true);
}
iniciar();