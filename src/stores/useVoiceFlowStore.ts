import { defineStore } from "pinia";
import { ref } from "vue";
import type { HudStatus } from "../types";

export const useVoiceFlowStore = defineStore("voice-flow", () => {
  const status = ref<HudStatus>("idle");
  const message = ref("");

  function transitionTo(newStatus: HudStatus, newMessage?: string) {
    status.value = newStatus;
    message.value = newMessage ?? "";
  }

  return {
    status,
    message,
    transitionTo,
  };
});
