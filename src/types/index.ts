export type HudStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "enhancing"
  | "success"
  | "error";

export interface HudState {
  status: HudStatus;
  message: string;
}

export type TriggerMode = "hold" | "toggle";

export interface TranscriptionResult {
  text: string;
  duration: number;
}
