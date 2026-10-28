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
async function carregarCursos() {
  const select = $('select[name="course"]');
  const { data, error } = await supabase
    .from("curso")
    .select("id_curso, nome_curso")
    .order("nome_curso");
  if (error) {
    console.error(error);
    select.options[0].textContent = "Não foi possível carregar os cursos";
    return;
  }
  select.innerHTML = '<option value="">Selecione seu curso</option>';
  data.forEach(c => select.append(new Option(c.nome_curso, c.id_curso)));
}

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
        id_curso: Number(etapa2.get("course")),
        semestre: Number(etapa2.get("semester")),
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
carregarCursos();
mostrarEtapa(1);