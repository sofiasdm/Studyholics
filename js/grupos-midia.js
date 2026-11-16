import { supabase } from "./supabaseClient.js";

const bucket = supabase.storage.from("midias-de-grupos");
const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const mediaTypes = [...imageTypes, "video/mp4", "video/webm", "audio/mpeg", "audio/ogg", "audio/mp4", "audio/wav", "audio/webm"];
const avatarLimit = 3 * 1024 * 1024;
const mediaLimit = 20 * 1024 * 1024;

for (const input of document.querySelectorAll("[data-group-file]")) {
  const avatar = input.dataset.groupFile === "avatar";
  input.accept = (avatar ? imageTypes : mediaTypes).join(",");
  const help = document.createElement("small");
  help.textContent = avatar ? "Imagem de até 3 MB." : "Imagem, vídeo ou áudio de até 20 MB.";
  input.closest("label").append(help);
}

export async function uploadGroupFile(groupId, file, kind = "media") {
  const avatar = kind === "avatar";
  if (!(avatar ? imageTypes : mediaTypes).includes(file.type)) throw new Error("Formato de arquivo incompatível.");
  if (file.size > (avatar ? avatarLimit : mediaLimit)) {
    throw new Error(`O arquivo deve ter até ${avatar ? 3 : 20} MB.`);
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Entre na sua conta para anexar arquivos.");

  const path = `${groupId}/${kind}/${user.id}/${crypto.randomUUID()}`;
  const { error } = await bucket.upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeUnusedGroupFile(path) {
  if (path) await bucket.remove([path]);
}

export function setGroupAvatar(container, path) {
  const fallback = document.createElement("i");
  fallback.className = "fa-solid fa-users";
  fallback.setAttribute("aria-hidden", "true");
  container.replaceChildren(fallback);

  // Garante formato circular perfeito (esfera) sem achatar
  Object.assign(container.style, {
    borderRadius: "50%",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    flexShrink: "0",
    cursor: path ? "pointer" : ""
  });

  if (!path) {
    container.onclick = null;
    return;
  }

  const image = document.createElement("img");
  image.alt = "Foto do grupo (clique para ampliar)";
  image.className = "group-avatar-image";
  Object.assign(image.style, {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "50%",
    display: "block"
  });
  image.hidden = true;
  container.append(image);

  image.addEventListener("load", () => {
    fallback.hidden = true;
    image.hidden = false;
  }, { once: true });

  container.onclick = e => {
    e.stopPropagation();
    if (!image.src || image.hidden) return;
    let dlg = document.getElementById("sh-avatar-preview-dialog");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "sh-avatar-preview-dialog";
      Object.assign(dlg.style, {
        border: "none",
        borderRadius: "1.25rem",
        padding: "1.25rem",
        background: "#ffffff",
        boxShadow: "0 20px 45px rgba(0, 0, 0, 0.35)",
        maxWidth: "90vw",
        maxHeight: "90vh",
        textAlign: "center"
      });
      dlg.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:0.75rem;">
          <strong style="font-size:0.95rem;color:#0B1F44;">Foto do grupo</strong>
          <button type="button" aria-label="Fechar imagem" style="background:none;border:none;font-size:1.5rem;line-height:1;cursor:pointer;color:#0B1F44;">&times;</button>
        </div>
        <img alt="Foto do grupo ampliada" style="width:min(360px, 75vw);height:min(360px, 75vw);border-radius:50%;object-fit:cover;display:block;margin:0 auto;border:4px solid #f1f5f9;">
      `;
      dlg.querySelector("button").addEventListener("click", () => dlg.close());
      dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
      document.body.append(dlg);
    }
    dlg.querySelector("img").src = image.src;
    dlg.showModal();
  };

  bucket.createSignedUrl(path, 600).then(({ data }) => {
    if (data) image.src = data.signedUrl;
  });
}

export function groupAttachment(path, type) {
  const wrapper = document.createElement("div");
  wrapper.className = "group-attachment";
  const open = document.createElement("button");
  open.type = "button";
  open.className = "secondary-button";
  const imageFile = type?.startsWith("image/");
  const audio = type?.startsWith("audio/");
  open.textContent = imageFile ? "Ver imagem" : audio ? "Ouvir áudio" : "Ver vídeo";
  wrapper.append(open);
  open.addEventListener("click", async () => {
    open.disabled = true;
    const { data } = await bucket.createSignedUrl(path, 600);
    open.disabled = false;
    if (!data) {
      open.textContent = "Tentar carregar mídia novamente";
      return;
    }
    const media = document.createElement(imageFile ? "img" : audio ? "audio" : "video");
    if (imageFile) media.alt = "Imagem anexada";
    else {
      media.controls = true;
      media.preload = "metadata";
    }
    media.addEventListener("error", () => {
      open.textContent = "Tentar carregar mídia novamente";
      wrapper.replaceChildren(open);
    }, { once: true });
    media.src = data.signedUrl;
    wrapper.replaceChildren(media);
  });
  return wrapper;
}
