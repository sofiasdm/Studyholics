import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Converte um caminho relativo (a partir desta pasta) em caminho absoluto
const pagina = caminho => fileURLToPath(new URL(caminho, import.meta.url));

// O Vite só expõe ao navegador variáveis que começam com VITE_.
// Como o .env.local do projeto usa NEXT_PUBLIC_, liberamos os dois prefixos.
export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  build: {
    rollupOptions: {
      // No "npm run dev" qualquer página abre. No "npm run build" (o que o Vercel
      // executa), só entram as páginas listadas aqui. Quando uma página nova ganhar
      // conteúdo (login, perfil, dashboard...), adicione uma linha para ela.
      input: {
        index: pagina("./index.html"),
        cadastro: pagina("./pages/cadastro.html"),
      },
    },
  },
});