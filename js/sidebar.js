// js/sidebar.js
// Barra lateral única (a mesma da página inicial) + menu inferior do celular.
// Uso em cada página:  <aside id="sidebar"></aside>  e  <script type="module" src="../js/sidebar.js"></script>
// (colocar ANTES do script da própria página, para o botão "Sair" já existir quando ele for ligado).
const MENU = [
  ["pagina-inicial.html", "fa-home", "Início"],
  ["pomodoro.html", "fa-book-open", "Estudar"],
  ["grupos.html", "fa-users", "Grupos"],
  ["perfil.html", "fa-user", "Perfil"],
];
// Páginas que pertencem a um item do menu
const PERTENCE = {
  "editar-perfil.html": "perfil.html",
  "sessao-estudo.html": "pomodoro.html",
  "conclusao-sessao.html": "pomodoro.html",
};

const atual = location.pathname.split("/").pop() || "";
const ativa = PERTENCE[atual] ?? atual;

function montar() {
  const aside = document.getElementById("sidebar");
  if (!aside) return;
  aside.className = "sh-sidebar";
  aside.setAttribute("aria-label", "Menu principal");
  aside.innerHTML = `
    <div>
      <div class="sh-logo">
        <div class="sh-logo-img"><img src="../assets/imagens/studyholics-mark.png" alt="Studyholics"></div>
        <h1>Study<span>holics</span></h1>
        <p>Estude. Evolua. Compartilhe</p>
      </div>
      <nav class="sh-nav">
        ${MENU.map(([href, icone, nome]) => `
        <a href="${href}" class="nav-link sh-link${href === ativa ? " ativo" : ""}"${href === ativa ? ' aria-current="page"' : ""}>
          <i class="fas ${icone}" aria-hidden="true"></i>${nome}
        </a>`).join("")}
      </nav>
    </div>
    <div class="sh-baixo">
      <a href="editar-perfil.html" class="nav-link"><i class="fas fa-cog" aria-hidden="true"></i>Configurações</a>
      <a href="#" id="btn-sair" class="nav-link"><i class="fas fa-sign-out-alt" aria-hidden="true"></i>Sair</a>
    </div>`;

  const bottom = document.createElement("nav");
  bottom.className = "sh-bottom";
  bottom.setAttribute("aria-label", "Principal no celular");
  bottom.innerHTML = MENU.map(([href, icone, nome]) => `
    <a href="${href}" class="${href === ativa ? "ativo" : ""}"><i class="fas ${icone}" aria-hidden="true"></i><span>${nome}</span></a>`).join("");
  document.body.append(bottom);
}
montar();

import "./topbar.js"; // botões do topo: perfil e notificações
import "./auto-altura.js"; // caixas de texto que crescem com o conteúdo
