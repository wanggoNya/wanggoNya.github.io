import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// 빌드 결과물은 Jekyll이 그대로 서빙하는 assets/editor/ 로 나감 (파일명 고정, 해시 없음)
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: fileURLToPath(new URL("../assets/editor", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: fileURLToPath(new URL("./src/main.jsx", import.meta.url)),
      output: {
        entryFileNames: "editor.js",
        // 코드 하이라이트·이모지 데이터 등은 쓸 때만 불러오도록 별도 조각으로 둠
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "editor[extname]",
      },
    },
  },
});
