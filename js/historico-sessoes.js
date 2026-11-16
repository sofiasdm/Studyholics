import { supabase } from "./supabaseClient.js";
import { exigirLogin } from "./protecao.js";
import { chaveLocal, inicioDiaUtc, semanaLocal, somarDias } from "./estudo-datas.js";

const $ = id => document.getElementById(id);
const PAGE_SIZE = 20;
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Recife"
});
const state = { sessions: [], shares: new Map(), groups: [], groupError: false,
  selected: null, offset: 0, busy: false, requestId: 0, from: null, until: null };

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function dateTime(value) { return dateTimeFormat.format(new Date(value)); }
function minutes(value) {
  const total = Number(value) || 0;
  return total >= 60 ? `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}min` : `${total} min`;
}
function subject(value) { return String(value || "").trim().toLocaleLowerCase("pt-BR"); }
function feedback(message) { $("history-feedback").textContent = message; }

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

function sharesFor(sessionId) { return state.shares.get(sessionId) || []; }

function sessionCard(session) {
  const button = node("button", "history-item");
  button.type = "button";
  button.dataset.sessionId = session.id;
  button.setAttribute("aria-current", String(state.selected === session.id));
  const top = node("div", "history-item-top");
  const title = node("strong", "", session.disciplina);
  const time = node("time", "", dateTime(session.finalizada_em));
  time.dateTime = session.finalizada_em;
  top.append(title, time);
  const meta = node("div", "history-item-meta");
  meta.append(node("span", "", `⏱ ${minutes(session.minutos_validos)}`), node("span", "", `★ ${session.pontos_ganhos || 0} pontos`));
  const summary = node("p", "history-item-summary", session.resumo?.trim() || "Sem resumo nesta sessão");
  button.append(top, meta, summary);
  button.addEventListener("click", () => selectSession(session.id));
  return button;
}

function renderList() {
  $("sessions-list").replaceChildren(...(state.sessions.length
    ? state.sessions.map(sessionCard)
    : [node("p", "history-list-empty", state.from
      ? "Nenhuma sessão concluída neste período."
      : "Você ainda não tem sessões concluídas.")]));
}

function closeDetail() {
  state.selected = null;
  $("session-detail").hidden = true;
  $("session-detail").replaceChildren();
  $("session-detail").closest(".history-layout").classList.remove("detail-open");
  $("sessions-list").querySelectorAll(".history-item").forEach(item => item.setAttribute("aria-current", "false"));
}

function selectSession(id) {
  const session = state.sessions.find(item => item.id === id);
  if (!session) return;
  state.selected = id;
  $("sessions-list").querySelectorAll(".history-item").forEach(item => {
    item.setAttribute("aria-current", String(item.dataset.sessionId === id));
  });
  const detail = $("session-detail");
  detail.hidden = false;
  detail.closest(".history-layout").classList.add("detail-open");
  const header = node("div", "history-detail-header");
  const headingBlock = node("div");
  const heading = node("h2", "", session.disciplina);
  heading.id = "detail-heading";
  const time = node("time", "history-detail-date", `Concluída em ${dateTime(session.finalizada_em)}`);
  time.dateTime = session.finalizada_em;
  headingBlock.append(heading, time);
  const close = node("button", "", "Fechar detalhes");
  close.type = "button";
  close.addEventListener("click", closeDetail);
  header.append(headingBlock, close);
  const grid = node("dl", "history-detail-grid");
  for (const [label, value] of [
    ["Disciplina", session.disciplina],
    ["Conteúdo estudado", session.conteudo || "Não informado"],
    ["Tempo estudado", minutes(session.minutos_validos)],
    ["Pontos gerados", `${session.pontos_ganhos || 0} pontos`],
    ["Iniciada em", dateTime(session.iniciada_em)],
    ["Concluída em", dateTime(session.finalizada_em)]
  ]) {
    const cell = node("div");
    cell.append(node("dt", "", label), node("dd", "", value));
    grid.append(cell);
  }
  const summaryTitle = node("h3", "", "Resumo da sessão");
  const summary = node("div", session.resumo?.trim() ? "history-summary" : "history-no-summary",
    session.resumo?.trim() || "Nenhum resumo foi registrado nesta sessão.");
  const sharingTitle = node("h3", "", "Compartilhamento");
  const sharing = node("div", "history-sharing");
  const publications = sharesFor(id);
  if (publications.length) {
    sharing.append(node("p", "", "Publicado em:"));
    for (const publication of publications) {
      const link = node("a", "", publication.grupo);
      link.href = `grupos.html?grupo=${encodeURIComponent(publication.id_grupo)}&aba=feed`;
      sharing.append(link);
    }
  } else sharing.append(node("p", "", "Este resumo ainda não foi compartilhado em grupos."));
  detail.replaceChildren(header, grid, summaryTitle, summary, sharingTitle, sharing);

  if (!session.resumo?.trim()) return;
  const shareForm = node("form", "history-share");
  const label = node("label", "", "Compartilhar resumo no feed de um grupo");
  label.htmlFor = "share-group";
  const select = node("select");
  select.id = "share-group";
  select.required = true;
  const available = state.groups.filter(group =>
    group.disciplinas?.some(name => subject(name) === subject(session.disciplina)) &&
    !publications.some(publication => publication.id_grupo === group.id)
  );
  const placeholder = node("option", "", "Selecione um grupo da mesma disciplina");
  placeholder.value = "";
  select.append(placeholder, ...available.map(group => {
    const option = node("option", "", group.nome);
    option.value = group.id;
    return option;
  }));
  const submit = node("button", "primary-button", "Continuar no feed");
  submit.type = "submit";
  const help = node("p", "", state.groupError
    ? "Não foi possível carregar seus grupos. Recarregue a página para tentar novamente."
    : available.length ? "Você poderá editar o resumo antes de publicar."
      : "Nenhum outro grupo seu estuda esta disciplina.");
  const error = node("p", "history-share-feedback");
  error.setAttribute("role", "status");
  shareForm.append(label, select, submit, help, error);
  select.disabled = submit.disabled = !available.length;
  shareForm.addEventListener("submit", event => {
    event.preventDefault();
    const group = available.find(item => String(item.id) === select.value);
    if (!group) { error.textContent = "Selecione um grupo válido."; return; }
    location.href = `grupos.html?grupo=${encodeURIComponent(group.id)}&aba=feed&sessao=${encodeURIComponent(id)}`;
  });
  detail.append(shareForm);
}

function showDateFields() {
  const mode = $("period-preset").value;
  $("filter-start-field").hidden = !["day", "range"].includes(mode);
  $("filter-end-field").hidden = mode !== "range";
  $("filter-start").required = ["day", "range"].includes(mode);
  $("filter-end").required = mode === "range";
}

function applyFilter(event) {
  event?.preventDefault();
  const mode = $("period-preset").value;
  const today = chaveLocal(new Date());
  let start = null;
  let end = null;
  if (mode === "today") start = end = today;
  if (mode === "week") [start, end] = [semanaLocal()[0], semanaLocal()[6]];
  if (mode === "month") {
    start = `${today.slice(0, 7)}-01`;
    const [year, month] = today.split("-").map(Number);
    end = somarDias(new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10), -1);
  }
  if (mode === "day" || mode === "range") {
    start = $("filter-start").value;
    end = mode === "day" ? start : $("filter-end").value;
  }
  const error = $("filter-error");
  error.hidden = true;
  if (mode !== "all" && (!start || !end || start > end)) {
    error.textContent = "Informe um período válido, com a data inicial anterior ou igual à final.";
    error.hidden = false;
    return;
  }
  state.from = start ? inicioDiaUtc(start) : null;
  state.until = end ? inicioDiaUtc(somarDias(end, 1)) : null;
  state.sessions = [];
  state.shares.clear();
  state.offset = 0;
  state.requestId++;
  state.busy = false;
  closeDetail();
  $("sessions-list").replaceChildren();
  feedback("Carregando sessões…");
  loadSessions();
}

async function loadSessions() {
  if (state.busy) return;
  const requestId = state.requestId;
  state.busy = true;
  $("load-more").disabled = true;
  try {
    let query = supabase.from("gam_sessao")
      .select("id, disciplina, conteudo, iniciada_em, finalizada_em, minutos_validos, pontos_ganhos, resumo")
      .not("finalizada_em", "is", null)
      .order("finalizada_em", { ascending: false })
      .order("id", { ascending: false });
    if (state.from) query = query.gte("finalizada_em", state.from);
    if (state.until) query = query.lt("finalizada_em", state.until);
    const { data, error } = await query.range(state.offset, state.offset + PAGE_SIZE - 1);
    if (requestId !== state.requestId) return;
    if (error) throw new Error(error.message);
    const shares = data.length ? await rpc("gam_resumos_compartilhados", { p_sessoes: data.map(item => item.id) }) : [];
    if (requestId !== state.requestId) return;
    for (const publication of shares) {
      const list = state.shares.get(publication.id_sessao) || [];
      list.push(publication);
      state.shares.set(publication.id_sessao, list);
    }
    state.sessions.push(...data);
    state.offset += data.length;
    $("load-more").hidden = data.length < PAGE_SIZE;
    renderList();
    feedback("");
  } catch (error) {
    if (requestId !== state.requestId) return;
    feedback(`Não foi possível carregar o histórico. ${error.message}`);
    $("load-more").hidden = false;
  } finally {
    if (requestId === state.requestId) {
      state.busy = false;
      $("load-more").disabled = false;
    }
  }
}

async function init() {
  if (!(await exigirLogin())) return;
  $("btn-sair").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "../index.html";
  });
  $("load-more").addEventListener("click", loadSessions);
  $("period-preset").addEventListener("change", showDateFields);
  $("history-filters").addEventListener("submit", applyFilter);
  $("filter-clear").addEventListener("click", () => {
    $("history-filters").reset();
    showDateFields();
    applyFilter();
  });
  const results = await Promise.allSettled([rpc("gam_ofensiva"), rpc("grupo_listar"), loadSessions()]);
  if (results[0].status === "fulfilled") {
    const count = results[0].value || 0;
    $("streak-count").textContent = count;
    $("streak-label").textContent = count === 1 ? "dia seguido estudando" : "dias seguidos estudando";
  } else $("streak-count").textContent = "—";
  if (results[1].status === "fulfilled") state.groups = results[1].value || [];
  else state.groupError = true;
}
init();
