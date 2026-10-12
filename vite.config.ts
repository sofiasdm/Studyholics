import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      router: {
        routesDirectory: "./routes",
        generatedRouteTree: "./routeTree.gen.ts",
      },
    }),
    react(),
  ],
});
