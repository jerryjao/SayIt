import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  TranscriptionRecord,
  DashboardStats,
} from "../types/transcription";

export const useHistoryStore = defineStore("history", () => {
  const transcriptionList = ref<TranscriptionRecord[]>([]);
  const isLoading = ref(false);

  async function fetchTranscriptionList() {
    // TODO: Story 4.1 — 從 SQLite 載入歷史記錄
  }

  async function addTranscription(_record: TranscriptionRecord) {
    // TODO: Story 1.4 — 新增轉錄記錄至 SQLite
  }

  function calculateDashboardStats(): DashboardStats {
    const list = transcriptionList.value;
    const count = list.length;

    const { totalCharacters, totalDurationMs, enhancedCount } = list.reduce(
      (acc, r) => ({
        totalCharacters: acc.totalCharacters + r.charCount,
        totalDurationMs: acc.totalDurationMs + r.transcriptionDurationMs,
        enhancedCount: acc.enhancedCount + (r.wasEnhanced ? 1 : 0),
      }),
      { totalCharacters: 0, totalDurationMs: 0, enhancedCount: 0 },
    );

    return {
      totalTranscriptions: count,
      totalCharacters,
      averageDurationMs: count > 0 ? totalDurationMs / count : 0,
      enhancedCount,
    };
  }

  return {
    transcriptionList,
    isLoading,
    fetchTranscriptionList,
    addTranscription,
    calculateDashboardStats,
  };
});
