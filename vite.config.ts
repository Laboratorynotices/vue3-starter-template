import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Определяем базовый путь c учетом режима сборки (ghpages или локальная разработка)
  const base = mode === "ghpages" ? "/vue3-starter-template/" : "/";
  return {
    plugins: [vue()],
    resolve: {
      // Включаем нативное чтение путей из tsconfig.json
      tsconfigPaths: true,
    },
    // Устанавливаем базовый путь для сборки
    base,
  };
});
