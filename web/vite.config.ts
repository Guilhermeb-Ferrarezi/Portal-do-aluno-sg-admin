import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(process.env.VITE_API_URL),
    "process.env.API_URL": JSON.stringify(process.env.VITE_API_URL),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@monaco-editor")) return "vendor-monaco";
          if (id.includes("framer-motion") || id.includes("animate-ui")) return "vendor-motion";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("/react-router/") || id.includes("/react-router-dom/")) {
            return "vendor-react-router";
          }
          if (id.includes("/@radix-ui/") || id.includes("/radix-ui/")) {
            return "vendor-radix";
          }
          if (
            id.includes("/clsx/") ||
            id.includes("/class-variance-authority/") ||
            id.includes("/tailwind-merge/") ||
            id.includes("/tw-animate-css/")
          ) {
            return "vendor-ui-utils";
          }
          return "vendor-misc";
        },
      },
    },
  },
});
