import { supabase } from "./supabaseClient.js";
import { exigirLogin } from "./protecao.js";
import { startGroupFeed, stopGroupFeed, refreshGroupFeed } from "./grupos-feed.js";

const $ = id => document.getElementById(id);
const state = { userId: null, groups: [], group: null, tab: "conversas", messages: new Map() };
const pageSize = 24;
let directoryRequest = 0;
let directoryCursor = null;
let searchRequest = 0;
let searchTimer;
let searchResults = [];
let activeOption = -1;
let selectedGroup = null;
let previewGroup = null;
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Recife" });

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const failure = new Error(error.message || "Não foi possível concluir a operação.");
    failure.code = error.code;
    throw failure;
  }
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
    list.replaceChildren(el("p", "groups-empty", query ? "Nenhum grupo corresponde à busca." : "Você ainda não participa de grupos. Crie um ou entre com a senha de acesso."));
    return;
  }
  list.replaceChildren(...groups.map(g => groupCard(g, () => openGroup(g.id))));
}

function groupCard(group, onClick) {
  const button = el("button", "group-list-item");
  button.type = "button";
  const icon = el("i", "fa-solid fa-users group-list-icon");
  icon.setAttribute("aria-hidden", "true");
  const copy = el("div", "group-list-copy");
  copy.append(el("strong", "", group.nome));
  if (group.membros != null) {
    copy.append(el("small", "", `${group.membros} ${group.membros === 1 ? "membro" : "membros"}`));
  }
  const summary = group.descricao || group.disciplinas?.join(", ");
  if (summary) copy.append(el("span", "", summary));
  const arrow = el("i", "fa-solid fa-chevron-right group-list-arrow");
  arrow.setAttribute("aria-hidden", "true");
  button.append(icon, copy, arrow);
  button.addEventListener("click", onClick);
  return button;
}

async function loadList() {
  try {
    state.groups = await rpc("grupo_listar");
    renderList();
  } catch (e) {
    $("groups-list").replaceChildren(el("p", "groups-empty", "Não foi possível carregar seus grupos."));
    throw e;
  }
}

function exploreGroups(name = "", before = null) {
  return rpc("grupo_explorar", { p_nome: name, p_antes: before });
}

async function loadDirectory(before = null) {
  const request = ++directoryRequest;
  const list = $("explore-list");
  const more = $("explore-more");
  more.disabled = true;
  if (before === null) {
    more.hidden = true;
    list.replaceChildren(el("p", "groups-empty", "Carregando grupos…"));
  }
  try {
    const groups = await exploreGroups("", before);
    if (request !== directoryRequest) return;
    const cards = groups.map(group => groupCard(group, () => openPreview(group)));
    if (before !== null) list.append(...cards);
    else list.replaceChildren(...(cards.length ? cards : [el("p", "groups-empty", "Nenhum grupo disponível para explorar.")]));
    directoryCursor = groups.at(-1)?.id ?? null;
    more.hidden = groups.length < pageSize;
    more.textContent = "Mostrar mais grupos";
    if (before !== null && more.hidden) list.lastElementChild?.focus();
  } catch (e) {
    if (request !== directoryRequest) return;
    if (before === null) {
      const message = e.code === "PGRST202"
        ? "A lista de grupos existentes ainda não está disponível."
        : "Não foi possível carregar os grupos existentes.";
      list.replaceChildren(el("p", "groups-empty", message));
      directoryCursor = null;
    } else {
      error(e);
    }
    more.textContent = "Tentar novamente";
    more.hidden = false;
  } finally {
    if (request === directoryRequest) more.disabled = false;
  }
}

function openPreview(group) {
  previewGroup = group;
  $("preview-name").textContent = group.nome;
  $("preview-description").textContent = group.descricao || "Sem descrição.";
  $("preview-subjects").replaceChildren(...(group.disciplinas.length
    ? group.disciplinas.map(name => el("span", "subject-chip", name))
    : [el("p", "", "Nenhuma disciplina cadastrada.")]));
  $("preview-form").reset();
  $("preview-form").hidden = true;
  $("preview-feedback").textContent = "";
  $("preview-start").hidden = false;
  $("explore-dialog").showModal();
  $("preview-start").focus();
}

function highlightOption(index) {
  activeOption = index;
  const options = $("join-options").children;
  for (const [position, option] of Array.from(options).entries()) {
    option.setAttribute("aria-selected", String(position === index));
  }
  if (index < 0) {
    $("join-name").removeAttribute("aria-activedescendant");
  } else {
    $("join-name").setAttribute("aria-activedescendant", options[index].id);
    options[index].scrollIntoView({ block: "nearest" });
  }
}

function closeSuggestions() {
  clearTimeout(searchTimer);
  searchRequest++;
  $("join-options").hidden = true;
  $("join-name").setAttribute("aria-expanded", "false");
  highlightOption(-1);
}

function chooseGroup(group) {
  selectedGroup = group;
  $("join-name").value = group.nome;
  $("join-feedback").textContent = "";
  closeSuggestions();
  $("join-password").focus();
}

async function suggestGroups(name, request) {
  try {
    const groups = await exploreGroups(name);
    if (request !== searchRequest || document.activeElement !== $("join-name")) return;
    searchResults = groups;
    const options = groups.map((group, index) => {
      const option = el("li", "", group.nome);
      option.id = `join-option-${index}`;
      option.setAttribute("role", "option");
      if (group.descricao) option.append(el("small", "", group.descricao));
      option.append(el("small", "", `Grupo #${group.id}`));
      option.addEventListener("mousedown", event => event.preventDefault());
      option.addEventListener("click", () => chooseGroup(group));
      return option;
    });
    $("join-options").replaceChildren(...options);
    $("join-options").hidden = !groups.length;
    $("join-name").setAttribute("aria-expanded", String(groups.length > 0));
    highlightOption(-1);
    $("join-feedback").textContent = groups.length ? "" : "Grupo não encontrado.";
  } catch (e) {
    if (request !== searchRequest) return;
    $("join-feedback").textContent = e.code === "PGRST202"
      ? "A busca de grupos ainda não está disponível."
      : "Não foi possível buscar grupos.";
  }
}

function queueGroupSearch() {
  closeSuggestions();
  const name = $("join-name").value.trim();
  $("join-feedback").textContent = "";
  if (!name || selectedGroup) return;
  const request = searchRequest;
  searchTimer = setTimeout(() => suggestGroups(name, request), 200);
}

async function joinGroup(group, password, form, feedback) {
  feedback.textContent = "";
  setBusy(form, true);
  try {
    const result = await rpc("grupo_entrar_com_senha", { p_grupo: group.id, p_senha: password });
    if (result === "entrou") return true;
    const messages = {
      grupo_inexistente: "Grupo não encontrado.",
      senha_incorreta: "A senha de acesso está incorreta.",
      limite: "Muitas tentativas. Aguarde até 10 minutos e tente novamente."
    };
    feedback.textContent = messages[result] ?? "Não foi possível entrar no grupo.";
  } catch (e) {
    feedback.textContent = e.message;
  } finally {
    setBusy(form, false);
  }
  return false;
}

function selectTab(tab) {
  state.tab = tab;
  document.querySelectorAll("[data-tab]").forEach(button => {
    const selected = button.dataset.tab === tab;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-current", selected ? "page" : "false");
  });
  for (const name of ["conversas", "feed", "estudos", "membros", "sobre"]) $(`tab-${name}`).hidden = name !== tab;
  if (tab === "feed") startGroupFeed(state.group.id);
  if (tab === "estudos") refreshStudy().catch(error);
  if (tab === "membros" || tab === "sobre") reloadDetail().catch(error);
}

function renderDetail(resetForms = false) {
  const g = state.group;
  $("group-name").textContent = g.nome;
  $("group-count").textContent = `${g.membros.length} ${g.membros.length === 1 ? "membro" : "membros"}`;
  $("group-description").textContent = g.descricao || "Grupo de estudo";
  $("about-description").textContent = g.descricao || "Sem descrição.";
  $("about-date").textContent = g.criado_em ? dateOnly.format(new Date(g.criado_em)) : "Não informada";
  $("about-subjects").textContent = g.disciplinas.join(", ") || "Nenhuma";
  $("leave-group").hidden = g.criador === state.userId;
  $("organizer-card").hidden = !g.sou_organizador;
  $("invite-form").hidden = !g.sou_organizador;
  if (resetForms || !g.sou_organizador) {
    $("invite-form").reset();
    $("invite-feedback").textContent = "";
  }
  $("delete-group").hidden = g.criador !== state.userId;
  $("group-password").value = g.senha || "";
  for (const [id, value] of [["edit-description", g.descricao || ""], ["edit-subjects", g.disciplinas.join(", ")]]) {
    const field = $(id);
    if (resetForms || field.value === field.defaultValue) field.value = value;
    field.defaultValue = value;
  }
  if (resetForms || !g.sou_organizador) $("password-form").reset();
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
  const group = await rpc("grupo_detalhes", { p_grupo: id });
  if (state.group?.id !== id) return;
  state.group = group;
  renderDetail();
}
async function openGroup(id) {
  try {
    const group = await rpc("grupo_detalhes", { p_grupo: id });
    if (!group) throw new Error("Grupo não encontrado.");
    stopGroupFeed();
    state.group = group;
    state.messages.clear();
    renderDetail(true);
    show("detail");
    selectTab("conversas");
    history.replaceState(null, "", `?grupo=${encodeURIComponent(id)}`);
    await refreshMessages();
    return true;
  } catch (e) { error(e); }
}
function backToList() {
  stopGroupFeed();
  state.group = null; state.messages.clear();
  history.replaceState(null, "", location.pathname);
  show("list");
  loadList().catch(error);
  loadDirectory();
}

const help = $("groups-help");
const helpButton = $("groups-help-button");
const helpText = $("groups-help-text");

function setHelpOpen(open) {
  helpText.hidden = !open;
  helpButton.setAttribute("aria-expanded", String(open));
}

help.addEventListener("pointerenter", event => {
  if (event.pointerType === "mouse") setHelpOpen(true);
});
help.addEventListener("pointerleave", event => {
  if (event.pointerType === "mouse" && !helpButton.matches(":focus-visible")) setHelpOpen(false);
});
helpButton.addEventListener("focus", () => {
  if (helpButton.matches(":focus-visible")) setHelpOpen(true);
});
helpButton.addEventListener("blur", () => setHelpOpen(false));
helpButton.addEventListener("click", event => {
  setHelpOpen(event.pointerType === "mouse" || helpText.hidden);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !helpText.hidden) setHelpOpen(false);
});

$("busca-grupos").addEventListener("input", renderList);
$("open-create").addEventListener("click", () => show("create"));
$("explore-more").addEventListener("click", () => loadDirectory(directoryCursor));
$("join-name").addEventListener("input", () => {
  selectedGroup = null;
  queueGroupSearch();
});
$("join-name").addEventListener("focus", queueGroupSearch);
$("join-name").addEventListener("keydown", event => {
  if (event.key === "Escape" || event.key === "Tab") {
    closeSuggestions();
    return;
  }
  if ($("join-options").hidden) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const last = searchResults.length - 1;
    const next = event.key === "ArrowDown"
      ? (activeOption >= last ? 0 : activeOption + 1)
      : (activeOption <= 0 ? last : activeOption - 1);
    highlightOption(next);
  } else if (event.key === "Enter" && activeOption >= 0) {
    event.preventDefault();
    chooseGroup(searchResults[activeOption]);
  }
});
document.addEventListener("pointerdown", event => {
  if (!help.contains(event.target)) setHelpOpen(false);
  if (!$("join-search").contains(event.target)) closeSuggestions();
});
$("preview-start").addEventListener("click", () => {
  $("preview-start").hidden = true;
  $("preview-form").hidden = false;
  $("preview-password").focus();
});
$("explore-dialog").addEventListener("cancel", event => {
  if ($("preview-password").disabled) event.preventDefault();
});
$("explore-dialog").addEventListener("close", () => {
  $("preview-form").reset();
  previewGroup = null;
});
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
    form.reset();
    if (await openGroup(id)) status("Grupo criado. Compartilhe o nome e a senha de acesso com os participantes.");
  } catch (e) { error(e); } finally { setBusy(form, false); }
});
$("join-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const group = selectedGroup;
  const feedback = $("join-feedback");
  if (!group || group.nome !== $("join-name").value) {
    selectedGroup = null;
    const name = $("join-name").value.trim();
    $("join-name").focus();
    closeSuggestions();
    if (!name) {
      feedback.textContent = "Informe o nome do grupo.";
      return;
    }
    const request = searchRequest;
    await suggestGroups(name, request);
    if (request === searchRequest && !$("join-options").hidden) feedback.textContent = "Selecione um grupo da lista.";
    return;
  }
  const joined = await joinGroup(group, $("join-password").value, form, feedback);
  if (!joined) {
    $("join-password").focus();
    return;
  }
  form.reset();
  selectedGroup = null;
  if (await openGroup(group.id)) status("Você entrou no grupo.");
});
$("preview-form").addEventListener("submit", async event => {
  event.preventDefault();
  const group = previewGroup;
  const dialog = $("explore-dialog");
  const closeButton = dialog.querySelector('[method="dialog"] button');
  closeButton.disabled = true;
  const joined = await joinGroup(group, $("preview-password").value, event.currentTarget, $("preview-feedback"));
  closeButton.disabled = false;
  if (!joined) {
    $("preview-password").focus();
    return;
  }
  dialog.close();
  $("join-form").reset();
  $("join-feedback").textContent = "";
  selectedGroup = null;
  if (await openGroup(group.id)) status("Você entrou no grupo.");
});
$("message-form").addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget;
  const text = $("message-text").value.trim(); if (!text) return;
  setBusy(form, true);
  try { await rpc("grupo_enviar_mensagem", { p_grupo: state.group.id, p_texto: text }); $("message-text").value = ""; await refreshMessages(); $("messages").scrollTop = $("messages").scrollHeight; }
  catch (e) { error(e); } finally { setBusy(form, false); }
});
$("invite-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const groupId = state.group.id;
  const email = $("invite-email").value.trim();
  const feedback = $("invite-feedback");
  feedback.textContent = "";
  setBusy(form, true);
  try {
    await rpc("grupo_adicionar_por_email", { p_grupo: groupId, p_email: email });
    if (state.group?.id !== groupId) return;
    form.reset();
    await reloadDetail();
    status("Membro adicionado pelo e-mail de cadastro.");
  } catch (e) {
    if (state.group?.id === groupId) feedback.textContent = e.message;
  } finally {
    setBusy(form, false);
  }
});
$("description-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const groupId = state.group.id;
  const field = $("edit-description");
  const description = field.value;
  setBusy(form, true);
  try {
    await rpc("grupo_alterar_descricao", { p_grupo: groupId, p_descricao: description });
    if (state.group?.id !== groupId) return;
    field.defaultValue = field.value;
    await reloadDetail();
    status("Descrição atualizada.");
  } catch (e) {
    error(e);
  } finally {
    setBusy(form, false);
  }
});
$("password-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const groupId = state.group.id;
  const password = $("edit-password").value;
  setBusy(form, true);
  try {
    await rpc("grupo_alterar_senha", { p_grupo: groupId, p_senha: password });
    if (state.group?.id !== groupId) return;
    form.reset();
    await reloadDetail();
    status("Senha de acesso atualizada.");
  } catch (e) {
    error(e);
  } finally {
    setBusy(form, false);
  }
});
$("subjects-form").addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget;
  const subjects = [...new Set($("edit-subjects").value.split(",").map(s => s.trim()).filter(Boolean))];
  if (!subjects.length) { status("Informe ao menos uma disciplina.", "error"); return; }
  setBusy(form, true);
  try {
    await rpc("grupo_definir_disciplinas", { p_grupo: state.group.id, p_disciplinas: subjects });
    $("edit-subjects").defaultValue = $("edit-subjects").value;
    await reloadDetail();
    status("Disciplinas atualizadas.");
  }
  catch (e) { error(e); } finally { setBusy(form, false); }
});
$("leave-group").addEventListener("click", async () => {
  if (!confirm("Sair deste grupo?")) return;
  try { await rpc("grupo_sair", { p_grupo: state.group.id }); backToList(); status("Você saiu do grupo."); } catch (e) { error(e); }
});
$("delete-group").addEventListener("click", async () => {
  if (!confirm("Excluir o grupo, incluindo mensagens, publicações, comentários e participações? Esta ação não pode ser desfeita.")) return;
  try { await rpc("grupo_excluir", { p_grupo: state.group.id }); backToList(); status("Grupo excluído."); } catch (e) { error(e); }
});

function refreshCurrent(forceFeed = false) {
  if (document.hidden || !state.group) return;
  refreshMessages().catch(error);
  if (state.tab === "feed") refreshGroupFeed(forceFeed);
  if (state.tab === "estudos") refreshStudy().catch(error);
  if (state.tab === "membros") reloadDetail().catch(error);
}
document.addEventListener("visibilitychange", () => refreshCurrent(true));
setInterval(refreshCurrent, 15000);

async function init() {
  const session = await exigirLogin(); if (!session) return;
  state.userId = session.user.id;
  loadDirectory();
  try {
    await loadList();
    const id = Number(new URLSearchParams(location.search).get("grupo"));
    if (id > 0) await openGroup(id);
  } catch (e) { error(e); }
}
init();
