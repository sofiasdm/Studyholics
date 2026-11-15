// js/cadastro.js
// Tela de cadastro (pages/cadastro.html), em 3 etapas, integrada ao Supabase.
import { supabase } from "./supabaseClient.js";
import {
  $, $$, ativarMostrarSenha, ligarFormulario,
  setError, setStatus, withBusy, authMessage,
} from "./auth.js";

// Para onde o botão "voltar" leva na etapa 1 (e para onde ir quando é preciso confirmar o e-mail).
// Troque para "login.html" quando a página pages/login.html estiver pronta.
const PAGINA_LOGIN = "../index.html";
// Para onde ir quando o cadastro já deixa a pessoa logada (mesma pasta: pages/)
const PAGINA_HOME = "pagina-inicial.html";

// Limites da foto (iguais aos do bucket "avatars" no Supabase)
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
const MAX_FOTO = 2 * 1024 * 1024; // 2 MB

// ---------- Navegação entre as etapas ----------
let etapaAtual = 1;

function mostrarEtapa(etapa) {
  etapaAtual = etapa;
  $("#signup").dataset.step = etapa;
  $$(".step").forEach(form => (form.hidden = Number(form.dataset.step) !== etapa));
  $$(".progress li").forEach((bolinha, i) => {
    bolinha.className = i + 1 < etapa ? "done" : i + 1 === etapa ? "current" : "";
  });
  window.scrollTo(0, 0);
}

$("#back").addEventListener("click", () => {
  if (etapaAtual === 1) window.location.href = PAGINA_LOGIN;
  else mostrarEtapa(etapaAtual - 1);
});

// Etapas 1 e 2 só avançam; a etapa 3 envia o cadastro
$$("form.step").forEach(form => {
  const etapa = Number(form.dataset.step);
  ligarFormulario(form, () => {
    if (etapa < 3) return mostrarEtapa(etapa + 1);
    withBusy(form, () => cadastrar(form));
  });
});

// ---------- Cursos (vêm da tabela CURSO) ----------
// ---------- Campus, curso e período ----------
const CAMPUS_ATIVO = "UFRPE - Dois Irmãos"; // os outros campi aparecem como "Em breve"
const CAMPI = [
  CAMPUS_ATIVO,
  "UFRPE - Garanhuns (UAG)",
  "UFRPE - Cabo de Santo Agostinho (UACSA)",
  "UFRPE - Serra Talhada (UAST)",
  "UFRPE - Belo Jardim (UABJ)",
];
let cursos = []; // duracao_periodos null = período não se aplica (mestrado)

const campoCampus = () => $('select[name="campus"]');
const campoCurso = () => $('select[name="course"]');
const campoPeriodo = () => $('select[name="semester"]');

function bloquear(select, texto, exigido = false) {
  select.replaceChildren(new Option(texto, ""));
  select.disabled = true;
  select.required = exigido;
  setError(select, "");
}

async function carregarCursos() {
  const { data, error } = await supabase
    .from("curso")
    .select("id_curso, nome_curso, duracao_periodos")
    .eq("ativo", true)
    .order("nome_curso");
  if (error) { console.error(error); bloquear(campoCurso(), "Não foi possível carregar os cursos", true); return; }
  cursos = data;
  atualizarCurso();
}

function carregarCampi() {
  CAMPI.forEach(nome => campoCampus().append(new Option(nome, nome)));
}

function atualizarCurso() {
  const campus = campoCampus().value, select = campoCurso(), anterior = select.value;
  if (!campus) bloquear(select, "Selecione o campus primeiro", true);
  else if (campus !== CAMPUS_ATIVO) bloquear(select, "Em breve");
  else {
    select.replaceChildren(new Option("Selecione seu curso", ""), ...cursos.map(c => new Option(c.nome_curso, c.id_curso)));
    select.disabled = false;
    select.required = true;
    select.value = anterior;
  }
  atualizarPeriodo();
}

function atualizarPeriodo() {
  const select = campoPeriodo(), campus = campoCampus().value;
  const curso = cursos.find(c => String(c.id_curso) === campoCurso().value);
  if (campus && campus !== CAMPUS_ATIVO) return bloquear(select, "Em breve");
  if (!curso) return bloquear(select, "Selecione o curso primeiro", true);
  if (curso.duracao_periodos === null) return bloquear(select, "Não se aplica");
  select.replaceChildren(new Option("Selecione seu período", ""),
    ...Array.from({ length: curso.duracao_periodos }, (_, i) => new Option(`${i + 1}º`, i + 1)));
  select.disabled = false;
  select.required = true;
  setError(select, "");
}
campoCampus().addEventListener("change", atualizarCurso);
campoCurso().addEventListener("change", atualizarPeriodo);
// ---------- Cadastro ----------
async function cadastrar(form) {
  const etapa1 = new FormData($('form[data-step="1"]'));
  const etapa2 = new FormData($('form[data-step="2"]'));
  const username = form.elements.username.value.trim();

  // 1) o nome de usuário está livre?
  const { data: livre, error: erroUser } = await supabase.rpc("username_disponivel", { p_username: username });
  if (erroUser) throw erroUser;
  if (!livre) return setError(form.elements.username, "Esse nome de usuário já está em uso.");

  // 2) cria a conta no Supabase Auth. Os campos extras vão em options.data;
  //    o gatilho handle_new_user (SQL) usa isso para criar a linha em ESTUDANTE.
  const { data, error } = await supabase.auth.signUp({
    email: etapa1.get("email").trim(),
    password: etapa1.get("password"),
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        primeiro_nome: etapa1.get("name").trim(),
        sobrenome: etapa1.get("sobrenome").trim(),
        username,
        id_curso: etapa2.get("course") ? Number(etapa2.get("course")) : null,
        semestre: etapa2.get("semester") ? Number(etapa2.get("semester")) : null,
        campus: etapa2.get("campus"),
      },
    },
  });
  if (error) return setStatus(form, authMessage(error), "error");

  // E-mail já existente: com confirmação ligada o Supabase não dá erro,
  // devolve o usuário com a lista identities vazia.
  if (data.user && data.user.identities?.length === 0)
    return setStatus(form, "Este e-mail já está cadastrado.", "error");

  // 3) sem sessão = confirmação de e-mail ligada: a pessoa precisa confirmar antes
  //    e depois entrar pelo login. (A foto escolhida não é enviada, porque ainda não há login.)
  if (!data.session) {
    setStatus(form, "Conta criada! Enviamos um link de confirmação para o seu e-mail. Levando você ao login…");
    setTimeout(() => (window.location.href = PAGINA_LOGIN), 4000);
    return;
  }

  // 4) com sessão: envia a foto (opcional). Falha na foto não cancela o cadastro.
  let mensagem = "Conta criada com sucesso! Bem-vindo(a) ao Studyholics.";
  const foto = $('input[name="photo"]', form).files[0];
  if (foto) {
    try { await uploadFoto(foto, data.user.id); }
    catch (e) { console.error(e); mensagem = "Conta criada! (A foto não pôde ser enviada.)"; }
  }
  setStatus(form, mensagem);
  setTimeout(() => (window.location.href = PAGINA_HOME), 1200);
}

async function uploadFoto(file, userId) {
  const caminho = `${userId}/avatar`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(caminho, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(caminho);
  const url = `${data.publicUrl}?v=${Date.now()}`; // ?v= evita cache da foto antiga
  const { error: erroUpdate } = await supabase
    .from("estudante").update({ foto_url: url }).eq("id_usuario", userId);
  if (erroUpdate) throw erroUpdate;
}

// ---------- Foto de perfil (pré-visualização e validação) ----------
$(".avatar input").addEventListener("change", e => {
  const arquivo = e.target.files[0];
  const img = $(".avatar img");
  const form = e.target.closest("form");
  if (!arquivo) return;
  if (!TIPOS_FOTO.includes(arquivo.type) || arquivo.size > MAX_FOTO) {
    e.target.value = "";
    img.hidden = true;
    return setStatus(form, "Use uma foto JPG, PNG ou WebP de até 2 MB.", "error");
  }
  img.src = URL.createObjectURL(arquivo);
  img.hidden = false;
});

// ---------- Início ----------
ativarMostrarSenha();
carregarCampi();
carregarCursos();
mostrarEtapa(1);