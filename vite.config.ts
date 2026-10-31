import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const androidBuild = mode === "android";

  return {
    base: androidBuild ? "./" : "/mygram-app/",
    plugins: [react()],
    build: {
      outDir: "dist",
      sourcemap: !androidBuild,
      emptyOutDir: true,
    },
  };
});
