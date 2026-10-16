import { defineConfig } from "vite";

// O Vite só expõe ao navegador variáveis que começam com VITE_.
// Como o .env.local do projeto usa NEXT_PUBLIC_, liberamos os dois prefixos.
export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
});
