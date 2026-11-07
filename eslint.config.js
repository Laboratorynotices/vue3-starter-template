import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from "@vue/eslint-config-typescript";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfigWithVueTs(
  // 1. Базовые правила JavaScript (ESLint)
  js.configs.recommended,

  // 2. Официальные правила для Vue 3
  ...pluginVue.configs["flat/recommended"],

  // 3. Официальный пресет правил TypeScript для Vue
  vueTsConfigs.recommended,

  // 4. Кастомная конфигурация вашего проекта
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,vue}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "no-console": "warn",
      "vue/multi-word-component-names": "off", // Разрешает компоненты из 1 слова
      "@typescript-eslint/no-explicit-any": "warn", // Предупреждать при использовании any
    },
  },
  // 5. Усмиряем с Приттиером, чтобы не конфликтовал с правилами ESLint и Vue
  eslintConfigPrettier,
);
