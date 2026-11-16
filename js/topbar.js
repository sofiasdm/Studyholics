// js/topbar.js
// Barra do topo (busca, sino e foto): o botão de perfil abre o Perfil e o sino abre o pop-up de notificações.
// Carregado pelo sidebar.js; se a página não tiver esses botões, não faz nada.
import { supabase } from "./supabaseClient.js";

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

  // Garante a bolinha vermelha indicadora (cria se não existir no HTML)
  let badge = sino.querySelector(".bg-red-500");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-pageBg";
    sino.append(badge);
  }

  // Cria o pop-up estilizado (funciona tanto em telas com Tailwind quanto com CSS puro)
  const painel = document.createElement("div");
  painel.className = "sh-notif";
  painel.hidden = true;
  painel.setAttribute("role", "dialog");
  painel.setAttribute("aria-label", "Notificações");
  Object.assign(painel.style, {
    position: "absolute",
    top: "calc(100% + 12px)",
    right: "0",
    width: "320px",
    maxWidth: "calc(100vw - 2rem)",
    backgroundColor: "#ffffff",
    borderRadius: "1rem",
    boxShadow: "0 15px 35px rgba(11, 31, 68, 0.16)",
    border: "1px solid #e5e7eb",
    zIndex: "50",
    overflow: "hidden",
    fontFamily: "'Nunito', sans-serif",
    color: "#0B1F44",
  });

  sino.parentElement.style.position = "relative";
  sino.parentElement.append(painel);

  const CHAVE_LIDAS = "studyholics_notif_lidas";
  let itens = [];

  function renderizarPainel() {
    const lidas = new Set(JSON.parse(localStorage.getItem(CHAVE_LIDAS) || "[]"));
    const naoLidas = itens.filter(n => !lidas.has(n.id));
    badge.hidden = naoLidas.length === 0;

    const listaHtml = itens.length
      ? itens.map(n => {
          const lida = lidas.has(n.id);
          return `
            <a href="${n.link}" style="display:flex;gap:12px;align-items:flex-start;padding:12px 16px;text-decoration:none;color:inherit;background:${lida ? "#ffffff" : "#f0fdf9"};border-bottom:1px solid #f3f4f6;transition:background .15s;">
              <div style="width:34px;height:34px;border-radius:50%;background:${n.corBg};color:${n.corIcone};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
                <i class="fas ${n.icone}" style="font-size:14px;"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <p style="margin:0;font-size:13px;font-weight:${lida ? "700" : "800"};color:#0B1F44;line-height:1.3;">${n.titulo}</p>
                <p style="margin:3px 0 0;font-size:12px;color:#6b7280;line-height:1.35;">${n.descricao}</p>
              </div>
              ${lida ? "" : '<span style="width:8px;height:8px;border-radius:50%;background:#44BBA4;flex-shrink:0;margin-top:6px;"></span>'}
            </a>`;
        }).join("")
      : `<p style="padding:24px 16px;margin:0;text-align:center;font-size:13px;color:#6b7280;">Você não tem notificações no momento.</p>`;

    painel.innerHTML = `
      <div style="padding:14px 16px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;">
        <strong style="font-size:14px;font-weight:800;color:#0B1F44;">Notificações</strong>
        ${naoLidas.length > 0 ? '<button type="button" id="sh-marcar-lidas" style="background:none;border:none;color:#44BBA4;font-size:12px;font-weight:700;cursor:pointer;padding:0;">Marcar como lidas</button>' : ""}
      </div>
      <div style="max-height:300px;overflow-y:auto;">${listaHtml}</div>
    `;

    painel.querySelector("#sh-marcar-lidas")?.addEventListener("click", e => {
      e.stopPropagation();
      localStorage.setItem(CHAVE_LIDAS, JSON.stringify(itens.map(n => n.id)));
      renderizarPainel();
    });
  }

  async function carregarNotificacoes() {
    const hoje = new Date().toISOString().slice(0, 10);
    const lista = [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const [{ data: ofensiva }, { data: grupos }] = await Promise.all([
          supabase.rpc("gam_ofensiva"),
          supabase.from("membro_grupo").select("id_grupo").eq("id_usuario", session.user.id),
        ]);

        const dias = Number(ofensiva) || 0;
        if (dias > 0) {
          lista.push({
            id: `ofensiva-${hoje}-${dias}`,
            icone: "fa-fire",
            corBg: "#ffedd5",
            corIcone: "#ea580c",
            titulo: `Ofensiva de ${dias} ${dias === 1 ? "dia" : "dias"}!`,
            descricao: "Continue estudando hoje para manter sua sequência ativa.",
            link: "pomodoro.html",
          });
        } else {
          lista.push({
            id: `lembrete-${hoje}`,
            icone: "fa-clock",
            corBg: "#ccfbf1",
            corIcone: "#0d9488",
            titulo: "Hora de focar nos estudos",
            descricao: "Inicie uma sessão Pomodoro hoje para iniciar sua ofensiva.",
            link: "pomodoro.html",
          });
        }

        if (!grupos || grupos.length === 0) {
          lista.push({
            id: "dica-grupos",
            icone: "fa-users",
            corBg: "#e0e7ff",
            corIcone: "#4338ca",
            titulo: "Estude em comunidade",
            descricao: "Entre ou crie um grupo de estudos para disputar o ranking semanal.",
            link: "grupos.html",
          });
        }
      }
    } catch (err) {
      console.warn("Não foi possível carregar notificações dinâmicas:", err);
    }

    lista.push({
      id: "boas-vindas-v1",
      icone: "fa-star",
      corBg: "#fef3c7",
      corIcone: "#d97706",
      titulo: "Bem-vindo(a) ao Studyholics!",
      descricao: "Complete sessões e escreva resumos para subir de nível.",
      link: "perfil.html",
    });

    itens = lista;
    renderizarPainel();
  }

  const fechar = () => { painel.hidden = true; sino.setAttribute("aria-expanded", "false"); };
  sino.addEventListener("click", e => {
    e.stopPropagation();
    painel.hidden = !painel.hidden;
    sino.setAttribute("aria-expanded", String(!painel.hidden));
  });
  document.addEventListener("click", e => { if (!painel.contains(e.target)) fechar(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); });

  carregarNotificacoes();
}