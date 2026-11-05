import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import i18n, { initLocale } from "./i18n";

const app = createApp(App);
app.use(i18n);

initLocale()
  .catch(console.error)
  .finally(() => app.mount("#app"));
