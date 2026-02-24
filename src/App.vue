<script setup lang="ts">
import { onMounted, ref } from "vue";
import NotchHud from "./components/NotchHud.vue";
import { useVoiceFlow } from "./composables/useVoiceFlow";
import { getCurrentWindow } from "@tauri-apps/api/window";

const { state, initialize } = useVoiceFlow();
const isDebugVisible = ref(true);

onMounted(async () => {
  console.log("[App] Mounted, initializing voice flow...");

  // Show window briefly on startup so user knows app is running
  const appWindow = getCurrentWindow();
  await appWindow.show();

  await initialize();

  // Auto-hide after 3 seconds
  setTimeout(async () => {
    isDebugVisible.value = false;
    if (state.value.status === "idle") {
      await appWindow.hide();
    }
  }, 3000);
});
</script>

<template>
  <div class="h-screen w-screen bg-transparent">
    <!-- Startup indicator -->
    <div
      v-if="isDebugVisible && state.status === 'idle'"
      class="fixed top-2 left-1/2 -translate-x-1/2 px-5 py-3 rounded-[28px] bg-black/85 backdrop-blur-xl shadow-lg"
    >
      <span class="text-white text-sm font-medium">NoWayLM Voice Ready — Press Fn</span>
    </div>

    <NotchHud :status="state.status" :message="state.message" />
  </div>
</template>
