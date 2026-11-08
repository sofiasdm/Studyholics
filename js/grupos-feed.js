import { supabase } from "./supabaseClient.js";

const PAGE_SIZE = 20;
const $ = id => document.getElementById(id);
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Recife"
});
let activeFeed = null;
let channelNumber = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function safeLink(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function setBusy(form, busy) {
  for (const field of form.elements) field.disabled = busy;
}

async function save(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

function timeline(config) {
  return { ...config, rows: new Map(), oldest: null, syncedNewest: null, loaded: false, busy: false, syncQueued: false };
}

// A data define a ordem, com o ID para desempatar.
function newestFirst(a, b) {
  return Date.parse(b.criada_em) - Date.parse(a.criada_em) || Number(b.id) - Number(a.id);
}

function addRows(target, rows) {
  for (const row of rows) {
    const key = String(row.id);
    if (target.rows.has(key)) continue;
    const node = target.render(row);
    node.dataset.rowId = key;
    const before = Array.from(target.list.children).find(child => {
      const order = newestFirst(row, target.rows.get(child.dataset.rowId));
      return target.postId == null ? order < 0 : order > 0;
    });
    target.rows.set(key, row);
    target.list.insertBefore(node, before ?? null);
  }
  if (target.rows.size) target.feedback.textContent = "";
}

async function readPage(feed, target, before) {
  let query = supabase.from(target.table).select("*")
    .eq("id_grupo", feed.groupId)
    .order("criada_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (target.postId != null) query = query.eq("id_postagem", target.postId);
  if (before) {
    const { criada_em: date, id } = before;
    query = query.or(`criada_em.lt.${date},and(criada_em.eq.${date},id.lt.${id})`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { rows: data.slice(0, PAGE_SIZE), hasMore: data.length > PAGE_SIZE };
}

async function loadTimeline(feed, target, older = false) {
  if (target.busy) {
    if (!older) target.syncQueued = true;
    return;
  }

  target.busy = true;
  target.more.disabled = true;
  if (!target.loaded && !target.rows.size) target.feedback.textContent = "Carregando…";

  try {
    const firstPage = !target.loaded || target.oldest === null;
    let page = await readPage(feed, target, older ? target.oldest : null);
    if (activeFeed !== feed) return;
    addRows(target, page.rows);

    if (firstPage || older) {
      target.oldest = page.rows.at(-1) ?? target.oldest;
      target.more.hidden = !page.hasMore;
      target.more.textContent = target.moreLabel;
    }

    if (!older || firstPage) {
      const newest = page.rows[0] ?? null;
      const previous = target.syncedNewest;
      let oldest = page.rows.at(-1);
      // Recupera também o intervalo perdido se a conexão caiu por mais de uma página.
      while (previous && page.hasMore && newestFirst(oldest, previous) < 0) {
        page = await readPage(feed, target, oldest);
        if (activeFeed !== feed) return;
        addRows(target, page.rows);
        oldest = page.rows.at(-1);
      }
      target.syncedNewest = newest;
    }

    target.loaded = true;
    target.feedback.textContent = target.rows.size ? "" : target.emptyText;
  } catch {
    if (activeFeed !== feed) return;
    target.feedback.textContent = target.errorText;
    if (!target.loaded) {
      target.more.textContent = "Tentar novamente";
      target.more.hidden = false;
    }
  } finally {
    target.busy = false;
    if (activeFeed === feed) {
      target.more.disabled = false;
      if (target.syncQueued) {
        target.syncQueued = false;
        loadTimeline(feed, target);
      }
    }
  }
}

function authorLine(row) {
  const date = new Date(row.criada_em);
  const line = element("div", "feed-meta");
  const time = element("time", "", dateTime.format(date));
  time.dateTime = date.toISOString();
  line.append(element("strong", "", row.autor), time);
  return line;
}

function renderComment(row) {
  const comment = element("article", "feed-comment");
  comment.append(authorLine(row), element("p", "feed-body", row.texto));
  return comment;
}

function renderPost(feed, row) {
  const post = element("article", "info-card feed-post");
  post.append(authorLine(row));
  if (row.titulo) post.append(element("h3", "feed-title", row.titulo));
  if (row.texto) post.append(element("p", "feed-body", row.texto));
  const href = safeLink(row.link);
  if (href) {
    const link = element("a", "feed-link", row.link);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    post.append(link);
  }

  const thread = element("details", "feed-thread");
  const summary = element("summary", "", "Comentários");
  const list = element("div", "feed-comments");
  const feedback = element("p", "feed-list-feedback");
  feedback.setAttribute("role", "status");
  const moreLabel = "Ver comentários anteriores";
  const more = element("button", "secondary-button feed-more", moreLabel);
  more.type = "button";
  more.hidden = true;
  const comments = timeline({
    table: "grupo_comentario", postId: row.id, list, feedback, more, moreLabel, render: renderComment,
    emptyText: "Ainda não há comentários.", errorText: "Não foi possível carregar os comentários."
  });
  feed.threads.set(String(row.id), { thread, comments });

  const form = element("form", "organizer-form feed-comment-form");
  const text = element("textarea");
  text.rows = 2;
  text.maxLength = 2000;
  text.required = true;
  text.placeholder = "Escreva um comentário…";
  text.setAttribute("aria-label", "Seu comentário");
  const submit = element("button", "primary-button", "Comentar");
  const formFeedback = element("p", "group-form-feedback");
  formFeedback.setAttribute("role", "status");
  form.append(text, submit, formFeedback);
  thread.append(summary, more, feedback, list, form);
  post.append(thread);

  thread.addEventListener("toggle", () => {
    if (thread.open && activeFeed === feed) loadTimeline(feed, comments);
  });
  more.addEventListener("click", () => loadTimeline(feed, comments, true));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const content = text.value.trim();
    if (!content) {
      formFeedback.textContent = "Escreva um comentário.";
      return;
    }
    formFeedback.textContent = "";
    setBusy(form, true);
    try {
      const comment = await save("grupo_comentar", {
        p_grupo: feed.groupId, p_postagem: row.id, p_texto: content
      });
      if (activeFeed !== feed) return;
      addRows(comments, [comment]);
      form.reset();
    } catch (error) {
      formFeedback.textContent = error.message;
    } finally {
      setBusy(form, false);
    }
  });
  return post;
}

export function refreshGroupFeed(force = false) {
  const feed = activeFeed;
  if (!feed || (feed.connected && !force)) return;
  loadTimeline(feed, feed.posts);
  for (const { thread, comments } of feed.threads.values()) {
    if (thread.open) loadTimeline(feed, comments);
  }
}

export function stopGroupFeed() {
  const feed = activeFeed;
  if (!feed) return;
  activeFeed = null;
  supabase.removeChannel(feed.channel);
  $("feed-list").replaceChildren();
  $("feed-list-feedback").textContent = "";
  $("feed-form-feedback").textContent = "";
  $("feed-connection").hidden = true;
  $("feed-more").hidden = true;
  $("feed-form").reset();
  setBusy($("feed-form"), false);
}

export function startGroupFeed(groupId) {
  if (activeFeed?.groupId === groupId) {
    refreshGroupFeed(true);
    return;
  }
  stopGroupFeed();
  const feed = { groupId, threads: new Map(), connected: false };
  feed.posts = timeline({
    table: "grupo_postagem", list: $("feed-list"), feedback: $("feed-list-feedback"), more: $("feed-more"),
    moreLabel: "Ver publicações anteriores", render: row => renderPost(feed, row),
    emptyText: "Ainda não há publicações. Que tal abrir a primeira discussão?",
    errorText: "Não foi possível carregar o feed do grupo."
  });
  activeFeed = feed;

  const changes = table => ({ event: "INSERT", schema: "public", table, filter: `id_grupo=eq.${groupId}` });
  feed.channel = supabase.channel(`grupo-feed-${groupId}-${++channelNumber}`)
    .on("postgres_changes", changes("grupo_postagem"), ({ new: post }) => {
      if (activeFeed === feed) addRows(feed.posts, [post]);
    })
    .on("postgres_changes", changes("grupo_comentario"), ({ new: comment }) => {
      if (activeFeed !== feed) return;
      const thread = feed.threads.get(String(comment.id_postagem));
      if (thread?.thread.open) addRows(thread.comments, [comment]);
    })
    .subscribe(status => {
      if (activeFeed !== feed) return;
      feed.connected = status === "SUBSCRIBED";
      const notice = $("feed-connection");
      notice.hidden = feed.connected;
      notice.textContent = "Atualização ao vivo indisponível. Buscando novas interações periodicamente.";
      if (feed.connected) refreshGroupFeed(true);
    });
  loadTimeline(feed, feed.posts);
}

$("feed-more").addEventListener("click", () => {
  const feed = activeFeed;
  if (feed) loadTimeline(feed, feed.posts, true);
});

$("feed-form").addEventListener("submit", async event => {
  event.preventDefault();
  const feed = activeFeed;
  if (!feed) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const titulo = fields.get("titulo").trim();
  const texto = fields.get("texto").trim();
  const link = fields.get("link").trim();
  const url = link ? safeLink(link) : null;
  const feedback = $("feed-form-feedback");
  if (link && !url) {
    feedback.textContent = "Informe um link que comece com https:// ou http://.";
    return;
  }
  if (!texto && !link) {
    feedback.textContent = "Escreva um texto ou informe um link para publicar.";
    return;
  }
  feedback.textContent = "";
  setBusy(form, true);
  try {
    const post = await save("grupo_publicar", { p_grupo: feed.groupId, p_titulo: titulo, p_texto: texto, p_link: url ?? "" });
    if (activeFeed !== feed) return;
    addRows(feed.posts, [post]);
    form.reset();
  } catch (error) {
    if (activeFeed === feed) feedback.textContent = error.message;
  } finally {
    if (activeFeed === feed) setBusy(form, false);
  }
});
