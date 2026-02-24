import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  initializeMicrophone,
  startRecording,
  stopRecording,
} from "../lib/recorder";
import { transcribeAudio } from "../lib/transcriber";
import { useHudState } from "./useHudState";

export function useVoiceFlow() {
  const { state, transitionTo } = useHudState();
  let isRecording = false;

  async function initialize() {
    try {
      await initializeMicrophone();
    } catch (err) {
      console.error("Failed to initialize microphone:", err);
    }

    listen("fn-key-down", () => {
      handleFnKeyDown();
    });

    listen("fn-key-up", () => {
      handleFnKeyUp();
    });
  }

  async function handleFnKeyDown() {
    if (isRecording) return;
    isRecording = true;

    try {
      await initializeMicrophone();
      transitionTo("recording", "Recording...");
      startRecording();
    } catch (err) {
      isRecording = false;
      const message = err instanceof Error ? err.message : "Recording failed";
      transitionTo("error", message);
    }
  }

  async function handleFnKeyUp() {
    if (!isRecording) return;
    isRecording = false;

    try {
      transitionTo("transcribing", "Transcribing...");
      const audioBlob = await stopRecording();

      const result = await transcribeAudio(audioBlob);

      if (!result.text) {
        transitionTo("error", "No speech detected");
        return;
      }

      await invoke("paste_text", { text: result.text });
      transitionTo("success", "Pasted!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transcription failed";
      transitionTo("error", message);
    }
  }

  return {
    state,
    initialize,
  };
}
