import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

const raiz = (caminho) => fileURLToPath(new URL(caminho, import.meta.url));

// Expõe somente estas duas variáveis sem prefixo ao código do navegador.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    define: {
      "import.meta.env.SUPABASE_URL": JSON.stringify(env.SUPABASE_URL || ""),
      "import.meta.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY || ""),
    },
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    build: {
      // Cada página HTML precisa estar listada, senão não vai para o build.
      rollupOptions: {
        input: {
          main: raiz("./index.html"),
          cadastro: raiz("./pages/cadastro.html"),
          pagina_inicial: raiz("./pages/pagina-inicial.html"),
          pomodoro: raiz("./pages/pomodoro.html"),
          sessao: raiz("./pages/sessao-estudo.html"),
          conclusao: raiz("./pages/conclusao-sessao.html"),
          gamificacao: raiz("./pages/gamificacao.html"),
          grupos: raiz("./pages/grupos.html"),
          perfil: raiz("./pages/perfil.html"),
          historico_sessoes: raiz("./pages/historico-sessoes.html"),
          editar_perfil: raiz("./pages/editar-perfil.html"),
          login: raiz("./pages/login.html"),
          dashboard: raiz("./pages/dashboard.html"),
        },
      },
    },
  };
});
