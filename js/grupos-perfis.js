import { supabase } from "./supabaseClient.js";

const $ = id => document.getElementById(id);
const dialog = $("participant-dialog");
let request = 0;

function avatar(photo) {
  const wrapper = document.createElement("span");
  wrapper.className = "person-avatar";
  wrapper.setAttribute("aria-hidden", "true");
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-user";
  wrapper.append(icon);
  if (typeof photo === "string" && /^https?:\/\//i.test(photo)) {
    const image = document.createElement("img");
    image.alt = "";
    image.src = photo;
    image.addEventListener("error", () => wrapper.replaceChildren(icon), { once: true });
    wrapper.replaceChildren(image);
  }
  return wrapper;
}

async function openProfile(groupId, userId) {
  const current = ++request;
  const summary = $("participant-summary");
  const status = $("participant-feedback");
  summary.hidden = true;
  status.textContent = "Carregando perfil…";
  dialog.showModal();

  const { data, error } = await supabase.rpc("grupo_perfil_participante", {
    p_grupo: groupId, p_usuario: userId
  });
  if (!dialog.open || current !== request) return;
  if (error || !data) {
    status.textContent = error?.message || "Este perfil não está disponível no grupo.";
    return;
  }
  const name = document.createElement("strong");
  name.textContent = data.nome;
  $("participant-identity").replaceChildren(avatar(data.foto_url), name);
  $("participant-username").textContent = data.username ? `@${data.username}` : "Não informado";
  $("participant-course").textContent = data.curso || "Não informado";
  $("participant-semester").textContent = data.semestre ? `${data.semestre}º` : "Não informado";
  $("participant-level").textContent = data.nivel_nome ? `${data.nivel} · ${data.nivel_nome}` : data.nivel;
  $("participant-points").textContent = Number(data.pontos).toLocaleString("pt-BR");
  status.textContent = "";
  summary.hidden = false;
}

export function participantLink(groupId, userId, name, photo, own = false) {
  const control = document.createElement(own ? "a" : userId ? "button" : "span");
  control.className = "participant-link";
  const label = document.createElement("strong");
  label.textContent = name;
  control.append(avatar(photo), label);
  if (own) control.href = "perfil.html";
  else if (userId) {
    control.type = "button";
    control.addEventListener("click", () => openProfile(groupId, userId));
  }
  return control;
}
