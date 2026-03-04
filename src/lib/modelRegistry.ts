// ── LLM 模型（文字整理用）────────────────────────────────

export type LlmModelId =
  | "llama-3.1-8b-instant"
  | "llama-3.3-70b-versatile"
  | "llama-4-scout-17b-16e-instruct"
  | "llama-4-maverick-17b-128e-instruct"
  | "qwen-qwq-32b"
  | "gpt-oss-120b";

export interface LlmModelConfig {
  id: LlmModelId;
  displayName: string;
  speedTps: number;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  freeQuotaRpd: number;
  freeQuotaTpd: number;
  isDefault: boolean;
}

// ── Whisper 模型（語音轉錄用）─────────────────────────────

export type WhisperModelId = "whisper-large-v3" | "whisper-large-v3-turbo";

export interface WhisperModelConfig {
  id: WhisperModelId;
  displayName: string;
  costPerHour: number;
  freeQuotaRpd: number;
  freeQuotaAudioSecondsPerDay: number;
  isDefault: boolean;
}

// ── 預設值 ────────────────────────────────────────────────

export const DEFAULT_LLM_MODEL_ID: LlmModelId = "llama-3.3-70b-versatile";
export const DEFAULT_WHISPER_MODEL_ID: WhisperModelId = "whisper-large-v3";

// ── 模型清單（Groq 2026-03 價格）─────────────────────────

export const LLM_MODEL_LIST: LlmModelConfig[] = [
  {
    id: "llama-3.3-70b-versatile",
    displayName: "Llama 3.3 70B Versatile",
    speedTps: 394,
    inputCostPerMillion: 0.59,
    outputCostPerMillion: 0.79,
    freeQuotaRpd: 1_000,
    freeQuotaTpd: 100_000,
    isDefault: true,
  },
  {
    id: "gpt-oss-120b",
    displayName: "GPT OSS 120B",
    speedTps: 500,
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
    freeQuotaRpd: 1_000,
    freeQuotaTpd: 200_000,
    isDefault: false,
  },
  {
    id: "llama-4-scout-17b-16e-instruct",
    displayName: "Llama 4 Scout 17B",
    speedTps: 594,
    inputCostPerMillion: 0.11,
    outputCostPerMillion: 0.34,
    freeQuotaRpd: 1_000,
    freeQuotaTpd: 500_000,
    isDefault: false,
  },
  {
    id: "llama-4-maverick-17b-128e-instruct",
    displayName: "Llama 4 Maverick 17B",
    speedTps: 562,
    inputCostPerMillion: 0.2,
    outputCostPerMillion: 0.6,
    freeQuotaRpd: 1_000,
    freeQuotaTpd: 500_000,
    isDefault: false,
  },
  {
    id: "qwen-qwq-32b",
    displayName: "Qwen QwQ 32B",
    speedTps: 662,
    inputCostPerMillion: 0.29,
    outputCostPerMillion: 0.59,
    freeQuotaRpd: 1_000,
    freeQuotaTpd: 500_000,
    isDefault: false,
  },
  {
    id: "llama-3.1-8b-instant",
    displayName: "Llama 3.1 8B Instant",
    speedTps: 840,
    inputCostPerMillion: 0.05,
    outputCostPerMillion: 0.08,
    freeQuotaRpd: 14_400,
    freeQuotaTpd: 500_000,
    isDefault: false,
  },
];

export const WHISPER_MODEL_LIST: WhisperModelConfig[] = [
  {
    id: "whisper-large-v3",
    displayName: "Whisper Large V3",
    costPerHour: 0.111,
    freeQuotaRpd: 2_000,
    freeQuotaAudioSecondsPerDay: 28_800,
    isDefault: true,
  },
  {
    id: "whisper-large-v3-turbo",
    displayName: "Whisper Large V3 Turbo",
    costPerHour: 0.04,
    freeQuotaRpd: 2_000,
    freeQuotaAudioSecondsPerDay: 28_800,
    isDefault: false,
  },
];

// ── Lookup helpers ────────────────────────────────────────

export function findLlmModelConfig(id: string): LlmModelConfig | undefined {
  return LLM_MODEL_LIST.find((m) => m.id === id);
}

export function findWhisperModelConfig(
  id: string,
): WhisperModelConfig | undefined {
  return WHISPER_MODEL_LIST.find((m) => m.id === id);
}

/**
 * 安全取得 LLM 模型 ID：若 savedId 不在 registry 則 fallback 到預設。
 * 處理舊版升級（null）和模型下架的情境。
 */
export function getEffectiveLlmModelId(savedId: string | null): LlmModelId {
  if (savedId && findLlmModelConfig(savedId)) return savedId as LlmModelId;
  return DEFAULT_LLM_MODEL_ID;
}

/**
 * 安全取得 Whisper 模型 ID：若 savedId 不在 registry 則 fallback 到預設。
 */
export function getEffectiveWhisperModelId(
  savedId: string | null,
): WhisperModelId {
  if (savedId && findWhisperModelConfig(savedId))
    return savedId as WhisperModelId;
  return DEFAULT_WHISPER_MODEL_ID;
}
