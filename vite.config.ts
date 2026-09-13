import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" || mode === "web" ? "/pathforge/" : "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@mui") || id.includes("@emotion")) return "mui";
          if (id.includes("jspdf") || id.includes("html2canvas")) return "pdf";
          if (id.includes("react")) return "react";
        },
      },
    },
  },
}));
