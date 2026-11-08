import { supabase } from "./supabaseClient.js";
import { exigirLogin } from "./protecao.js";

const $ = id => document.getElementById(id);
const state = { userId: null, groups: [], group: null, tab: "conversas", messages: new Map(), loading: false };
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Recife" });

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || "Não foi possível concluir a operação.");
  return data;
}
function status(message, kind = "success") {
  const el = $("groups-status");
  el.textContent = message;
  el.dataset.kind = kind;
  el.hidden = !message;
  if (message) window.scrollTo({ top: 0, behavior: "smooth" });
}
function error(e) { status(e.message || "Algo deu errado. Tente novamente.", "error"); }
function setBusy(form, busy) {
  form.querySelectorAll("button,input,textarea").forEach(el => { el.disabled = busy; });
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function show(view) {
  for (const name of ["list", "create", "detail"]) $(`view-${name}`).hidden = name !== view;
  $("busca-grupos").closest("label").hidden = view !== "list";
  status("");
  window.scrollTo(0, 0);
}
function minutes(value) {
  const n = Number(value) || 0;
  return n >= 60 ? `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, "0")}min` : `${n} min`;
}

function renderList() {
  const query = $("busca-grupos").value.trim().toLocaleLowerCase("pt-BR");
  const groups = state.groups.filter(g => [g.nome, g.descricao, ...(g.disciplinas || [])].join(" ").toLocaleLowerCase("pt-BR").includes(query));
  const list = $("groups-list");
  if (!groups.length) {
    list.replaceChildren(el("p", "groups-empty", query ? "Nenhum grupo corresponde à busca." : "Você ainda não participa de grupos. Crie um ou entre com o número e a senha de acesso."));
    return;
  }
  list.replaceChildren(...groups.map(g => {
    const button = el("button", "group-list-item");
    button.type = "button";
    const icon = el("i", "fa-solid fa-users group-list-icon");
    icon.setAttribute("aria-hidden", "true");
    const copy = el("div", "group-list-copy");
    copy.append(el("strong", "", g.nome), el("small", "", `${g.membros} ${g.membros === 1 ? "membro" : "membros"}`), el("span", "", g.descricao || (g.disciplinas || []).join(", ")));
    button.append(icon, copy, el("i", "fa-solid fa-chevron-right group-list-arrow"));
    button.addEventListener("click", () => openGroup(g.id));
    return button;
  }));
}
async function loadList() {
  state.groups = await rpc("grupo_listar");
  renderList();
}

function selectTab(tab) {
  state.tab = tab;
  document.querySelectorAll("[data-tab]").forEach(button => {
    const selected = button.dataset.tab === tab;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-current", selected ? "page" : "false");
  });
  for (const name of ["conversas", "estudos", "membros", "sobre"]) $(`tab-${name}`).hidden = name !== tab;
  if (tab === "estudos") refreshStudy().catch(error);
  if (tab === "membros" || tab === "sobre") reloadDetail().catch(error);
}

function renderDetail() {
  const g = state.group;
  $("group-name").textContent = g.nome;
  $("group-count").textContent = `${g.membros.length} ${g.membros.length === 1 ? "membro" : "membros"}`;
  $("group-description").textContent = g.descricao || "Grupo de estudo";
  $("about-date").textContent = g.criado_em ? dateOnly.format(new Date(g.criado_em)) : "Não informada";
  $("about-subjects").textContent = g.disciplinas.join(", ") || "Nenhuma";
  $("about-id").textContent = `#${g.id}`;
  $("leave-group").hidden = g.criador === state.userId;
  $("organizer-card").hidden = !g.sou_organizador;
  $("delete-group").hidden = g.criador !== state.userId;
  $("invite-form").hidden = !g.sou_organizador;
  $("group-password").value = g.senha || "";
  $("edit-subjects").value = g.disciplinas.join(", ");
  $("group-password").type = "password";
  $("show-password").textContent = "Mostrar";
  $("members-heading").textContent = `Membros (${g.membros.length})`;
  $("study-subjects").replaceChildren(...g.disciplinas.map(d => el("span", "subject-chip", d)));
  $("study-link").href = `pomodoro.html?disciplina=${encodeURIComponent(g.disciplinas[0] || "")}`;
  renderMembers();
}
function renderMembers() {
  const g = state.group;
  $("members-list").replaceChildren(...g.membros.map(m => {
    const row = el("div", "member-row");
    const avatar = el("span", "person-avatar");
    avatar.append(el("i", "fa-solid fa-user"));
    const copy = el("div", "member-copy");
    copy.append(el("strong", "", m.nome || "Estudante"), el("small", "", m.id === g.criador ? "Criador · Organizador" : m.organizador ? "Organizador" : "Membro"));
    row.append(avatar, copy);
    if (m.id !== g.criador && m.id !== state.userId && g.sou_organizador) {
      const actions = el("div", "member-actions");
      if (g.criador === state.userId) {
        const role = el("button", "", m.organizador ? "Remover organização" : "Tornar organizador");
        role.type = "button";
        role.addEventListener("click", async () => {
          try { await rpc("grupo_definir_organizador", { p_grupo: g.id, p_usuario: m.id, p_organizador: !m.organizador }); await reloadDetail(); status("Permissão atualizada."); } catch (e) { error(e); }
        });
        actions.append(role);
      }
      const remove = el("button", "danger", "Remover");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (!confirm(`Remover ${m.nome || "este membro"} do grupo?`)) return;
        try { await rpc("grupo_remover_membro", { p_grupo: g.id, p_usuario: m.id }); await reloadDetail(); status("Membro removido."); } catch (e) { error(e); }
      });
      actions.append(remove); row.append(actions);
    }
    return row;
  }));
}

function renderMessages() {
  const box = $("messages");
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  const messages = [...state.messages.values()].sort((a, b) => a.id - b.id);
  if (!messages.length) { box.replaceChildren(el("p", "message-empty", "Ainda não há mensagens. Inicie a conversa!")); return; }
  box.replaceChildren(...messages.map(m => {
    const own = m.id_usuario === state.userId;
    const item = el("article", `message${own ? " own" : ""}`);
    item.append(el("div", "message-meta", `${own ? "Você" : m.nome} · ${dateTime.format(new Date(m.criada_em))}`), el("div", "message-bubble", m.texto));
    return item;
  }));
  if (nearBottom) box.scrollTop = box.scrollHeight;
}
async function refreshMessages(older = false) {
  if (!state.group) return;
  const id = state.group.id;
  const before = older ? Math.min(...state.messages.keys()) : null;
  const rows = await rpc("grupo_mensagens", { p_grupo: id, p_antes: Number.isFinite(before) ? before : null });
  if (!state.group || state.group.id !== id) return;
  rows.forEach(m => state.messages.set(m.id, m));
  $("older-messages").hidden = older ? rows.length < 50 : state.messages.size < 50;
  renderMessages();
}
async function refreshStudy() {
  if (!state.group) return;
  const id = state.group.id;
  const rows = await rpc("grupo_estudos", { p_grupo: id });
  if (!state.group || state.group.id !== id) return;
  $("study-ranking").replaceChildren(...rows.map((m, i) => {
    const item = el("li");
    item.append(el("span", "rank-number", `${i + 1}º`), el("span", "rank-name", m.nome + (m.id === state.userId ? " (você)" : "")), el("span", "rank-time", minutes(m.minutos)));
    return item;
  }));
  const active = rows.filter(m => m.estudando);
  $("studying-now").replaceChildren(...(active.length ? active.map(m => {
    const item = el("div", "study-active");
    const avatar = el("span", "person-avatar"); avatar.append(el("i", "fa-solid fa-book-open"));
    const copy = el("div"); copy.append(el("strong", "", m.nome), el("span", "", `Estudando ${m.estudando}`));
    item.append(avatar, copy); return item;
  }) : [el("p", "groups-empty", "Ninguém está estudando uma disciplina do grupo agora.")]));
}
async function reloadDetail() {
  const id = state.group?.id;
  if (!id) return;
  state.group = await rpc("grupo_detalhes", { p_grupo: id });
  renderDetail();
}
async function openGroup(id) {
  try {
    const group = await rpc("grupo_detalhes", { p_grupo: id });
    if (!group) throw new Error("Grupo não encontrado.");
    state.group = group;
    state.messages.clear();
    renderDetail();
    show("detail");
    selectTab("conversas");
    history.replaceState(null, "", `?grupo=${encodeURIComponent(id)}`);
    await refreshMessages();
  } catch (e) { error(e); }
}
function backToList() {
  state.group = null; state.messages.clear();
  history.replaceState(null, "", location.pathname);
  show("list");
  loadList().catch(error);
}

$("busca-grupos").addEventListener("input", renderList);
$("open-create").addEventListener("click", () => show("create"));
document.querySelectorAll("[data-back]").forEach(button => button.addEventListener("click", backToList));
document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => selectTab(button.dataset.tab)));
$("show-password").addEventListener("click", () => { const input = $("group-password"); input.type = input.type === "password" ? "text" : "password"; $("show-password").textContent = input.type === "password" ? "Mostrar" : "Ocultar"; });
$("older-messages").addEventListener("click", () => refreshMessages(true).catch(error));
$("btn-sair").addEventListener("click", async () => { await supabase.auth.signOut(); location.href = "../index.html"; });

$("create-form").addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget;
  const values = new FormData(form);
  const subjects = [...new Set(String(values.get("disciplinas")).split(",").map(s => s.trim()).filter(Boolean))];
  if (!subjects.length) { status("Informe ao menos uma disciplina.", "error"); return; }
  setBusy(form, true);
  try {
    const id = await rpc("grupo_criar", { p_nome: values.get("nome"), p_descricao: values.get("descricao"), p_senha: values.get("senha"), p_disciplinas: subjects });
    form.reset(); await loadList(); await openGroup(id); status("Grupo criado. Compartilhe o número e a senha de acesso com os participantes.");
  } catch (e) { error(e); } finally { setBusy(form, false); }
});
$("join-form").addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget;
  const id = Number($("join-id").value);
  setBusy(form, true);
  try { await rpc("grupo_entrar", { p_grupo: id, p_senha: $("join-password").value }); form.reset(); await loadList(); await openGroup(id); status("Você entrou no grupo."); }
  catch (e) { error(e); } finally { setBusy(form, false); }
});
$("message-form").addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget;
  const text = $("message-text").value.trim(); if (!text) return;
  setBusy(form, true);
  try { await rpc("grupo_enviar_mensagem", { p_grupo: state.group.id, p_texto: text }); $("message-text").value = ""; await refreshMessages(); $("messages").scrollTop = $("messages").scrollHeight; }
  catch (e) { error(e); } finally { setBusy(form, false); }
});
$("invite-form").addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget; setBusy(form, true);
  try { await rpc("grupo_adicionar_por_email", { p_grupo: state.group.id, p_email: $("invite-email").value }); form.reset(); await reloadDetail(); status("Pessoa adicionada ao grupo."); }
  catch (e) { error(e); } finally { setBusy(form, false); }
});
$("subjects-form").addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget;
  const subjects = [...new Set($("edit-subjects").value.split(",").map(s => s.trim()).filter(Boolean))];
  if (!subjects.length) { status("Informe ao menos uma disciplina.", "error"); return; }
  setBusy(form, true);
  try { await rpc("grupo_definir_disciplinas", { p_grupo: state.group.id, p_disciplinas: subjects }); await reloadDetail(); status("Disciplinas atualizadas."); }
  catch (e) { error(e); } finally { setBusy(form, false); }
});
$("leave-group").addEventListener("click", async () => {
  if (!confirm("Sair deste grupo?")) return;
  try { await rpc("grupo_sair", { p_grupo: state.group.id }); backToList(); status("Você saiu do grupo."); } catch (e) { error(e); }
});
$("delete-group").addEventListener("click", async () => {
  if (!confirm("Excluir este grupo, todas as mensagens e participações? Esta ação não pode ser desfeita.")) return;
  try { await rpc("grupo_excluir", { p_grupo: state.group.id }); backToList(); status("Grupo excluído."); } catch (e) { error(e); }
});

function refreshCurrent() {
  if (document.hidden || !state.group) return;
  refreshMessages().catch(error);
  if (state.tab === "estudos") refreshStudy().catch(error);
  if (state.tab === "membros") reloadDetail().catch(error);
}
document.addEventListener("visibilitychange", refreshCurrent);
setInterval(refreshCurrent, 15000);

async function init() {
  const session = await exigirLogin(); if (!session) return;
  state.userId = session.user.id;
  try {
    await loadList();
    const id = Number(new URLSearchParams(location.search).get("grupo"));
    if (id > 0) await openGroup(id);
  } catch (e) { error(e); $("groups-list").replaceChildren(el("p", "groups-empty", "Não foi possível carregar os grupos. Verifique se a migração de grupos foi aplicada no Supabase.")); }
}
init();
