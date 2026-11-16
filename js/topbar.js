// js/topbar.js
// Barra do topo (busca, sino e foto): o botão de perfil abre o Perfil e o sino abre a lista de notificações.
// Carregado pelo sidebar.js; se a página não tiver esses botões, não faz nada.
const cabecalho = document.querySelector("header");
const sino = cabecalho?.querySelector(".fa-bell")?.closest("button");
const usuario = cabecalho?.querySelector(".fa-user")?.closest("button");

if (usuario) {
  usuario.type = "button";
  usuario.title = "Meu perfil";
  usuario.setAttribute("aria-label", "Meu perfil");
  usuario.addEventListener("click", () => { location.href = "perfil.html"; });
}

if (sino) {
  sino.type = "button";
  sino.setAttribute("aria-label", "Notificações");
  sino.setAttribute("aria-expanded", "false");
  sino.querySelector(".bg-red-500")?.remove();      // ainda não há notificações: sem bolinha vermelha

  const painel = document.createElement("div");
  painel.className = "sh-notif";
  painel.hidden = true;
  painel.setAttribute("role", "status");
  painel.innerHTML = "<strong>Notificações</strong><p>Você não tem notificações no momento.</p>";
  sino.parentElement.style.position = "relative";
  sino.parentElement.append(painel);

  const fechar = () => { painel.hidden = true; sino.setAttribute("aria-expanded", "false"); };
  sino.addEventListener("click", e => {
    e.stopPropagation();
    painel.hidden = !painel.hidden;
    sino.setAttribute("aria-expanded", String(!painel.hidden));
  });
  document.addEventListener("click", e => { if (!painel.contains(e.target)) fechar(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); });
}
