import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const raiz = (caminho) => fileURLToPath(new URL(caminho, import.meta.url));

// O Vite só expõe ao navegador variáveis que começam com VITE_.
// Como o .env.local do projeto usa NEXT_PUBLIC_, liberamos os dois prefixos.
export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  build: {
    // Cada página HTML precisa estar listada, senão não vai para o build.
    rollupOptions: {
      input: {
        main: raiz("./index.html"),
        pomodoro: raiz("./pages/pomodoro.html"),
        sessao: raiz("./pages/sessao-estudo.html"),
        conclusao: raiz("./pages/conclusao-sessao.html"),
        gamificacao: raiz("./pages/gamificacao.html"),
      },
    },
  },
});
