import { defineStore } from "pinia";
import { ref } from "vue";
import type { TriggerMode } from "../types";
import type { HotkeyConfig } from "../types/settings";

export const useSettingsStore = defineStore("settings", () => {
  const hotkeyConfig = ref<HotkeyConfig | null>(null);
  const triggerMode = ref<TriggerMode>("hold");
  const hasApiKey = ref(false);
  const aiPrompt = ref("");

  async function loadSettings() {
    // TODO: Story 1.3 — 從 tauri-plugin-store 載入設定
  }

  async function saveSettings() {
    // TODO: Story 1.3 — 儲存設定至 tauri-plugin-store
  }

  return {
    hotkeyConfig,
    triggerMode,
    hasApiKey,
    aiPrompt,
    loadSettings,
    saveSettings,
  };
});
