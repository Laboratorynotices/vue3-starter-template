import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    // Включаем нативное чтение путей из tsconfig.json
    tsconfigPaths: true,
  },
});
