import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/mygram-app/",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true, emptyOutDir: true },
});
