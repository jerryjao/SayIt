import { createApp } from "vue";
import { createPinia } from "pinia";
import MainApp from "./MainApp.vue";
import router from "./router";
import { initializeDatabase } from "./lib/database";
import "./style.css";

async function bootstrap() {
  await initializeDatabase();

  const pinia = createPinia();
  createApp(MainApp).use(pinia).use(router).mount("#app");

  console.log("[main-window] Dashboard initialized");
}

bootstrap().catch((err) => {
  console.error("[main-window] Failed to initialize:", err);
});
