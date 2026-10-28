import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const raiz = (caminho) => fileURLToPath(new URL(caminho, import.meta.url));

// O Vite só expõe ao navegador variáveis que começam com VITE_.
// Como o .env.local do projeto usa NEXT_PUBLIC_, liberamos os dois prefixos.
export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  build: {
    rollupOptions: {
      // Cada página HTML precisa estar listada aqui, senão não vai para o build
      // (e dá 404 no Vercel). Página nova com conteúdo = uma linha nova.
      input: {
        main: raiz("./index.html"),
        cadastro: raiz("./pages/cadastro.html"),
        pomodoro: raiz("./pages/pomodoro.html"),
        sessao: raiz("./pages/sessao-estudo.html"),
        conclusao: raiz("./pages/conclusao-sessao.html"),
        gamificacao: raiz("./pages/gamificacao.html"),
      },
    },
  },
});