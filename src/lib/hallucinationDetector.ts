/**
 * 幻覺偵測模組 — 純函式，不依賴 Vue/Pinia/Tauri。
 *
 * 四層偵測邏輯：
 *  Layer 1: 語速異常（錄音 < 1 秒但文字 > 10 字）
 *  Layer 2: 靜音偵測（peakEnergyLevel 低於門檻 → 麥克風確認無人說話）
 *  Layer 3: 背景噪音偵測（極低 RMS 單獨攔截，或低 RMS + 高 NSP 聯合攔截）
 *  Layer 4: 精確比對（轉錄文字完全匹配已知幻覺詞 → 即使有背景音也攔截）
 */

// ── 常數 ──

/** Layer 1 錄音時長門檻（ms） */
export const SPEED_ANOMALY_MAX_DURATION_MS = 1000;
/** Layer 1 文字長度門檻 */
export const SPEED_ANOMALY_MIN_CHARS = 10;
/** Layer 2 靜音能量門檻（0.0 = 完全靜音, 1.0 = 最大音量）需實測校準 */
export const SILENCE_ENERGY_THRESHOLD = 0.02;
/** Layer 3a 極低 RMS 門檻 — 低於此值幾乎確定無人聲，不需要 NSP 確認 */
export const NOISE_RMS_HARD_THRESHOLD = 0.008;
/** Layer 3b 低 RMS 門檻 — 搭配高 NSP 聯合判斷（人聲 RMS ≥ 0.03，背景噪音 RMS ≈ 0.005~0.02） */
export const NOISE_RMS_SOFT_THRESHOLD = 0.015;
/** Layer 3b 背景噪音 NSP 門檻（Whisper 認為「可能無語音」的信心度） */
export const NOISE_NSP_THRESHOLD = 0.7;

// ── 型別 ──

export interface HallucinationDetectionParams {
  rawText: string;
  recordingDurationMs: number;
  peakEnergyLevel: number;
  rmsEnergyLevel: number;
  noSpeechProbability: number;
  hallucinationTermList: string[];
}

export interface HallucinationDetectionResult {
  isHallucination: boolean;
  reason:
    | "speed-anomaly"
    | "silence-detected"
    | "noise-detected"
    | "term-match"
    | null;
  shouldAutoLearn: boolean;
  detectedText: string;
}

// ── 核心函式 ──

/**
 * 四層幻覺偵測邏輯。
 *
 * 優先級：Layer 1（語速異常）> Layer 2（靜音偵測）> Layer 3（背景噪音）> Layer 4（精確比對）> 放行
 *
 * 設計原則：只有能合理判斷是幻覺時才攔截。
 * Layer 1/2 用音訊能量（物理信號）判斷「有沒有人說話」。
 * Layer 3 用 RMS 能量判斷（極低 RMS 直接攔截；低 RMS + 高 NSP 聯合攔截），補上有背景音時 Layer 2 無法觸發的缺口。
 * Layer 4 用已知幻覺詞精確比對作為兜底。
 */
export function detectHallucination(
  params: HallucinationDetectionParams,
): HallucinationDetectionResult {
  const {
    rawText,
    recordingDurationMs,
    peakEnergyLevel,
    rmsEnergyLevel,
    noSpeechProbability,
    hallucinationTermList,
  } = params;
  const trimmedText = rawText.trim();
  const charCount = trimmedText.length;

  // Layer 1: 語速異常（物理定律級判斷）
  if (
    recordingDurationMs < SPEED_ANOMALY_MAX_DURATION_MS &&
    charCount > SPEED_ANOMALY_MIN_CHARS
  ) {
    return {
      isHallucination: true,
      reason: "speed-anomaly",
      shouldAutoLearn: true,
      detectedText: trimmedText,
    };
  }

  // Layer 2: 靜音偵測 — 麥克風確認無人說話，Whisper 回的任何文字都是幻覺
  if (peakEnergyLevel < SILENCE_ENERGY_THRESHOLD) {
    return {
      isHallucination: true,
      reason: "silence-detected",
      shouldAutoLearn: true,
      detectedText: trimmedText,
    };
  }

  // Layer 3: 背景噪音偵測
  // 3a: 極低 RMS — 幾乎確定無人聲，不需要 NSP 確認（NSP 可能為 0，Whisper 對幻覺有時很自信）
  // 3b: 低 RMS + 高 NSP — 聯合判斷，RMS 在灰色地帶但 Whisper 也認為無語音
  if (
    rmsEnergyLevel < NOISE_RMS_HARD_THRESHOLD ||
    (rmsEnergyLevel < NOISE_RMS_SOFT_THRESHOLD &&
      noSpeechProbability > NOISE_NSP_THRESHOLD)
  ) {
    return {
      isHallucination: true,
      reason: "noise-detected",
      shouldAutoLearn: true,
      detectedText: trimmedText,
    };
  }

  // Layer 4: 精確比對 — 轉錄文字完全匹配已知幻覺詞（不自動學習，因為已在 DB 中）
  if (
    hallucinationTermList.length > 0 &&
    hallucinationTermList.includes(trimmedText)
  ) {
    return {
      isHallucination: true,
      reason: "term-match",
      shouldAutoLearn: false,
      detectedText: trimmedText,
    };
  }

  // 放行
  return {
    isHallucination: false,
    reason: null,
    shouldAutoLearn: false,
    detectedText: trimmedText,
  };
}
