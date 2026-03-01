import type { HudStatus } from "./index";
import type { TranscriptionRecord } from "./transcription";

export interface VoiceFlowStateChangedPayload {
  status: HudStatus;
  message: string;
}

export type TranscriptionCompletedPayload = Pick<
  TranscriptionRecord,
  | "id"
  | "rawText"
  | "processedText"
  | "recordingDurationMs"
  | "transcriptionDurationMs"
  | "enhancementDurationMs"
  | "charCount"
  | "wasEnhanced"
>;

export interface SettingsUpdatedPayload {
  key: string;
  value: unknown;
}

export interface VocabularyChangedPayload {
  action: "added" | "removed";
  term: string;
}
