import { ref, readonly } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { HudStatus, HudState } from "../types";

const DEFAULT_SUCCESS_DISPLAY_DURATION_MS = 1000;
const DEFAULT_ERROR_DISPLAY_DURATION_MS = 2000;

export function useHudState() {
  const state = ref<HudState>({ status: "idle", message: "" });
  let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

  function clearAutoHideTimer() {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
  }

  async function showHud() {
    const appWindow = getCurrentWindow();
    await appWindow.show();
    await appWindow.setIgnoreCursorEvents(true);
  }

  async function hideHud() {
    const appWindow = getCurrentWindow();
    await appWindow.hide();
  }

  function transitionTo(status: HudStatus, message = "") {
    clearAutoHideTimer();
    state.value = { status, message };

    if (status === "idle") {
      hideHud();
      return;
    }

    if (status === "recording" || status === "transcribing") {
      showHud();
      return;
    }

    if (status === "success") {
      showHud();
      autoHideTimer = setTimeout(() => {
        transitionTo("idle");
      }, DEFAULT_SUCCESS_DISPLAY_DURATION_MS);
      return;
    }

    if (status === "error") {
      showHud();
      autoHideTimer = setTimeout(() => {
        transitionTo("idle");
      }, DEFAULT_ERROR_DISPLAY_DURATION_MS);
    }
  }

  return {
    state: readonly(state),
    transitionTo,
  };
}
