export type HudStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "success"
  | "error";

export interface HudState {
  status: HudStatus;
  message: string;
}

export interface TranscriptionResult {
  text: string;
  duration: number;
}
