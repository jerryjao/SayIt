import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  initializeMicrophone,
  startRecording,
  stopRecording,
} from "../lib/recorder";
import { transcribeAudio } from "../lib/transcriber";
import { useHudState } from "./useHudState";

function log(message: string) {
  invoke("debug_log", { level: "info", message });
}

function logError(message: string) {
  invoke("debug_log", { level: "error", message });
}

export function useVoiceFlow() {
  const { state, transitionTo } = useHudState();
  let isRecording = false;

  async function initialize() {
    log("useVoiceFlow: initializing...");

    try {
      await initializeMicrophone();
      log("useVoiceFlow: microphone initialized OK");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(`useVoiceFlow: microphone init failed: ${msg}`);
    }

    listen("fn-key-down", () => {
      log("useVoiceFlow: received fn-key-down");
      handleFnKeyDown();
    });

    listen("fn-key-up", () => {
      log("useVoiceFlow: received fn-key-up");
      handleFnKeyUp();
    });

    log("useVoiceFlow: event listeners registered");
  }

  async function handleFnKeyDown() {
    if (isRecording) return;
    isRecording = true;

    try {
      await initializeMicrophone();
      transitionTo("recording", "Recording...");
      startRecording();
      log("useVoiceFlow: recording started");
    } catch (err) {
      isRecording = false;
      const message = err instanceof Error ? err.message : "Recording failed";
      logError(`useVoiceFlow: recording error: ${message}`);
      transitionTo("error", message);
    }
  }

  async function handleFnKeyUp() {
    if (!isRecording) return;
    isRecording = false;

    try {
      transitionTo("transcribing", "Transcribing...");
      log("useVoiceFlow: stopping recording...");
      const audioBlob = await stopRecording();
      log(
        `useVoiceFlow: got audio blob, size=${audioBlob.size}, type=${audioBlob.type}`,
      );

      log("useVoiceFlow: calling transcribeAudio...");
      const result = await transcribeAudio(audioBlob);
      log(`useVoiceFlow: transcription result: "${result.text}"`);

      if (!result.text) {
        transitionTo("error", "No speech detected");
        return;
      }

      // Hide HUD before paste so target app regains focus
      transitionTo("idle");
      log("useVoiceFlow: invoking paste_text...");
      await invoke("paste_text", { text: result.text });
      log("useVoiceFlow: paste done!");
      transitionTo("success", "Pasted!");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`useVoiceFlow: error: ${message}`);
      transitionTo("error", message);
    }
  }

  return {
    state,
    initialize,
  };
}
