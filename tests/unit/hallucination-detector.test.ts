import { describe, it, expect } from "vitest";
import {
  detectHallucination,
  SPEED_ANOMALY_MAX_DURATION_MS,
  SPEED_ANOMALY_MIN_CHARS,
  SILENCE_ENERGY_THRESHOLD,
  NOISE_RMS_HARD_THRESHOLD,
  NOISE_RMS_SOFT_THRESHOLD,
  NOISE_NSP_THRESHOLD,
} from "../../src/lib/hallucinationDetector";

/** 正常語音的預設參數（Layer 1/2/3 都不觸發） */
const NORMAL_DEFAULTS = {
  rmsEnergyLevel: 0.1,
  noSpeechProbability: 0.1,
};

describe("hallucinationDetector.ts", () => {
  describe("常數值驗證", () => {
    it("[P0] 常數應符合設計規格", () => {
      expect(SPEED_ANOMALY_MAX_DURATION_MS).toBe(1000);
      expect(SPEED_ANOMALY_MIN_CHARS).toBe(10);
      expect(SILENCE_ENERGY_THRESHOLD).toBe(0.02);
      expect(NOISE_RMS_HARD_THRESHOLD).toBe(0.008);
      expect(NOISE_RMS_SOFT_THRESHOLD).toBe(0.015);
      expect(NOISE_NSP_THRESHOLD).toBe(0.7);
    });
  });

  describe("Layer 1: 語速異常偵測", () => {
    it("[P0] 錄音 < 1 秒且文字 > 10 字 → 幻覺 + 自動學習", () => {
      const result = detectHallucination({
        rawText: "謝謝收看請訂閱我的頻道感謝大家",
        recordingDurationMs: 500,
        peakEnergyLevel: 0.5,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(true);
      expect(result.reason).toBe("speed-anomaly");
      expect(result.shouldAutoLearn).toBe(true);
      expect(result.detectedText).toBe("謝謝收看請訂閱我的頻道感謝大家");
    });

    it("[P0] 錄音恰好 1000ms 不應觸發 Layer 1", () => {
      const result = detectHallucination({
        rawText: "謝謝收看請訂閱我的頻道感謝大家",
        recordingDurationMs: 1000,
        peakEnergyLevel: 0.001,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      // Layer 1 不觸發，但 Layer 2 靜音偵測會攔截
      expect(result.reason).not.toBe("speed-anomaly");
    });

    it("[P0] 文字恰好 10 字不應觸發 Layer 1", () => {
      const result = detectHallucination({
        rawText: "一二三四五六七八九十",
        recordingDurationMs: 500,
        peakEnergyLevel: 0.5,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(false);
    });

    it("[P1] 帶前後空白的文字應 trim 後計算字數", () => {
      const result = detectHallucination({
        rawText: "  謝謝收看請訂閱我的頻道感謝大家  ",
        recordingDurationMs: 500,
        peakEnergyLevel: 0.5,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(true);
      expect(result.detectedText).toBe("謝謝收看請訂閱我的頻道感謝大家");
    });
  });

  describe("Layer 2: 靜音偵測", () => {
    it("[P0] peakEnergyLevel 低於門檻 → 幻覺（任何文字）", () => {
      const result = detectHallucination({
        rawText: "謝謝收看",
        recordingDurationMs: 2000,
        peakEnergyLevel: 0.001,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(true);
      expect(result.reason).toBe("silence-detected");
      expect(result.shouldAutoLearn).toBe(true);
    });

    it("[P0] peakEnergyLevel 低於門檻 → 即使文字不是幻覺詞也攔截", () => {
      const result = detectHallucination({
        rawText: "今天天氣真好我很開心",
        recordingDurationMs: 3000,
        peakEnergyLevel: 0.005,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(true);
      expect(result.reason).toBe("silence-detected");
    });

    it("[P0] peakEnergyLevel 恰好等於門檻 → 放行（不攔截）", () => {
      const result = detectHallucination({
        rawText: "謝謝收看",
        recordingDurationMs: 2000,
        peakEnergyLevel: SILENCE_ENERGY_THRESHOLD,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(false);
    });

    it("[P0] peakEnergyLevel 高於門檻 → 放行（有人說話）", () => {
      const result = detectHallucination({
        rawText: "謝謝收看",
        recordingDurationMs: 2000,
        peakEnergyLevel: 0.1,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(false);
      expect(result.reason).toBeNull();
    });

    it("[P0] peakEnergyLevel = 0.0（完全靜音）→ 攔截", () => {
      const result = detectHallucination({
        rawText: "字幕由Amara社區提供",
        recordingDurationMs: 5000,
        peakEnergyLevel: 0.0,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(true);
      expect(result.reason).toBe("silence-detected");
    });
  });

  describe("Layer 3: 背景噪音偵測", () => {
    describe("3a: 極低 RMS（不需要 NSP）", () => {
      it("[P0] rms < 0.008 → 幻覺 + 自動學習（即使 NSP=0）", () => {
        const result = detectHallucination({
          rawText: "MING PAO CANADA // MING PAO TORONTO",
          recordingDurationMs: 1388,
          peakEnergyLevel: 0.031,
          rmsEnergyLevel: 0.0066,
          noSpeechProbability: 0.0,
          hallucinationTermList: [],
        });

        expect(result.isHallucination).toBe(true);
        expect(result.reason).toBe("noise-detected");
        expect(result.shouldAutoLearn).toBe(true);
      });

      it("[P0] rms 恰好等於 hard 門檻 → 不觸發 3a（進入 3b 判斷）", () => {
        const result = detectHallucination({
          rawText: "一些文字",
          recordingDurationMs: 2000,
          peakEnergyLevel: 0.15,
          rmsEnergyLevel: NOISE_RMS_HARD_THRESHOLD,
          noSpeechProbability: 0.3,
          hallucinationTermList: [],
        });

        // rms = 0.008，不滿足 < 0.008；NSP = 0.3 不滿足 > 0.7 → 放行
        expect(result.isHallucination).toBe(false);
      });
    });

    describe("3b: 低 RMS + 高 NSP 聯合判斷", () => {
      it("[P0] rms < 0.015 且 NSP > 0.7 → 幻覺 + 自動學習", () => {
        const result = detectHallucination({
          rawText: "MING PAO CANADA // MING PAO TORONTO",
          recordingDurationMs: 3729,
          peakEnergyLevel: 0.15,
          rmsEnergyLevel: 0.012,
          noSpeechProbability: 0.85,
          hallucinationTermList: [],
        });

        expect(result.isHallucination).toBe(true);
        expect(result.reason).toBe("noise-detected");
        expect(result.shouldAutoLearn).toBe(true);
      });

      it("[P0] rms < 0.015 但 NSP <= 0.7 → 放行", () => {
        const result = detectHallucination({
          rawText: "一些文字",
          recordingDurationMs: 2000,
          peakEnergyLevel: 0.15,
          rmsEnergyLevel: 0.012,
          noSpeechProbability: 0.3,
          hallucinationTermList: [],
        });

        expect(result.isHallucination).toBe(false);
      });

      it("[P0] rms >= 0.015 但 NSP > 0.7 → 放行（有持續聲音）", () => {
        const result = detectHallucination({
          rawText: "一些文字",
          recordingDurationMs: 2000,
          peakEnergyLevel: 0.15,
          rmsEnergyLevel: 0.05,
          noSpeechProbability: 0.85,
          hallucinationTermList: [],
        });

        expect(result.isHallucination).toBe(false);
      });

      it("[P0] rms 恰好等於 soft 門檻 → 放行", () => {
        const result = detectHallucination({
          rawText: "一些文字",
          recordingDurationMs: 2000,
          peakEnergyLevel: 0.15,
          rmsEnergyLevel: NOISE_RMS_SOFT_THRESHOLD,
          noSpeechProbability: 0.85,
          hallucinationTermList: [],
        });

        expect(result.isHallucination).toBe(false);
      });

      it("[P0] NSP 恰好等於門檻 → 放行", () => {
        const result = detectHallucination({
          rawText: "一些文字",
          recordingDurationMs: 2000,
          peakEnergyLevel: 0.15,
          rmsEnergyLevel: 0.012,
          noSpeechProbability: NOISE_NSP_THRESHOLD,
          hallucinationTermList: [],
        });

        expect(result.isHallucination).toBe(false);
      });
    });

    it("[P0] 實際案例重現：peak=0.031, rms=0.0066, NSP=0.000 → 3a 攔截", () => {
      const result = detectHallucination({
        rawText: "MING PAO CANADA // MING PAO TORONTO",
        recordingDurationMs: 1388,
        peakEnergyLevel: 0.031,
        rmsEnergyLevel: 0.0066,
        noSpeechProbability: 0.0,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(true);
      expect(result.reason).toBe("noise-detected");
      expect(result.shouldAutoLearn).toBe(true);
    });
  });

  describe("Layer 4: 精確比對", () => {
    it("[P0] 轉錄文字完全匹配已知幻覺詞 → 攔截 + 不自動學習", () => {
      const result = detectHallucination({
        rawText: "謝謝收看",
        recordingDurationMs: 2000,
        peakEnergyLevel: 0.3,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: ["謝謝收看", "字幕組"],
      });

      expect(result.isHallucination).toBe(true);
      expect(result.reason).toBe("term-match");
      expect(result.shouldAutoLearn).toBe(false);
    });

    it("[P0] 轉錄文字不在幻覺詞庫中 → 放行", () => {
      const result = detectHallucination({
        rawText: "今天天氣真好",
        recordingDurationMs: 2000,
        peakEnergyLevel: 0.3,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: ["謝謝收看", "字幕組"],
      });

      expect(result.isHallucination).toBe(false);
      expect(result.reason).toBeNull();
    });

    it("[P0] 空的幻覺詞庫 → 不觸發 Layer 4", () => {
      const result = detectHallucination({
        rawText: "謝謝收看",
        recordingDurationMs: 2000,
        peakEnergyLevel: 0.3,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(false);
    });

    it("[P0] 有背景音但文字匹配幻覺詞 → 攔截（Layer 4 補上 Layer 2 缺口）", () => {
      const result = detectHallucination({
        rawText: "Thank you for watching",
        recordingDurationMs: 3000,
        peakEnergyLevel: 0.15,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: ["Thank you for watching", "Subscribe"],
      });

      expect(result.isHallucination).toBe(true);
      expect(result.reason).toBe("term-match");
    });

    it("[P1] 帶空白的文字 trim 後匹配 → 攔截", () => {
      const result = detectHallucination({
        rawText: "  謝謝收看  ",
        recordingDurationMs: 2000,
        peakEnergyLevel: 0.3,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: ["謝謝收看"],
      });

      expect(result.isHallucination).toBe(true);
      expect(result.reason).toBe("term-match");
      expect(result.detectedText).toBe("謝謝收看");
    });

    it("[P1] 部分匹配不攔截（必須完全相同）", () => {
      const result = detectHallucination({
        rawText: "謝謝收看我的頻道",
        recordingDurationMs: 2000,
        peakEnergyLevel: 0.3,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: ["謝謝收看"],
      });

      expect(result.isHallucination).toBe(false);
    });
  });

  describe("正常放行", () => {
    it("[P0] 有能量的正常語音 → 放行", () => {
      const result = detectHallucination({
        rawText: "這是一段正常的語音轉錄文字",
        recordingDurationMs: 3000,
        peakEnergyLevel: 0.3,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(false);
      expect(result.reason).toBeNull();
      expect(result.shouldAutoLearn).toBe(false);
    });

    it("[P0] 有能量 + 非詞庫文字 → 放行", () => {
      const result = detectHallucination({
        rawText: "謝謝收看",
        recordingDurationMs: 1500,
        peakEnergyLevel: 0.15,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.isHallucination).toBe(false);
    });
  });

  describe("Layer 優先級", () => {
    it("[P0] Layer 1 優先於 Layer 2（即使靜音，語速異常優先）", () => {
      const result = detectHallucination({
        rawText: "謝謝收看請訂閱我的頻道感謝大家",
        recordingDurationMs: 500,
        peakEnergyLevel: 0.001,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: [],
      });

      expect(result.reason).toBe("speed-anomaly");
      expect(result.shouldAutoLearn).toBe(true);
    });

    it("[P0] Layer 1 優先於 Layer 4（即使在詞庫中）", () => {
      const result = detectHallucination({
        rawText: "謝謝收看請訂閱我的頻道感謝大家",
        recordingDurationMs: 500,
        peakEnergyLevel: 0.5,
        ...NORMAL_DEFAULTS,
        hallucinationTermList: ["謝謝收看請訂閱我的頻道感謝大家"],
      });

      expect(result.reason).toBe("speed-anomaly");
      expect(result.shouldAutoLearn).toBe(true);
    });

    it("[P0] Layer 2 優先於 Layer 3", () => {
      const result = detectHallucination({
        rawText: "謝謝收看",
        recordingDurationMs: 2000,
        peakEnergyLevel: 0.001,
        rmsEnergyLevel: 0.001,
        noSpeechProbability: 0.9,
        hallucinationTermList: [],
      });

      expect(result.reason).toBe("silence-detected");
    });

    it("[P0] Layer 3 優先於 Layer 4", () => {
      const result = detectHallucination({
        rawText: "謝謝收看",
        recordingDurationMs: 2000,
        peakEnergyLevel: 0.15,
        rmsEnergyLevel: 0.01,
        noSpeechProbability: 0.85,
        hallucinationTermList: ["謝謝收看"],
      });

      expect(result.reason).toBe("noise-detected");
      expect(result.shouldAutoLearn).toBe(true);
    });
  });
});
