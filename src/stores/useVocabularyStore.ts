import { defineStore } from "pinia";
import { ref } from "vue";
import type { VocabularyEntry } from "../types/vocabulary";

export const useVocabularyStore = defineStore("vocabulary", () => {
  const termList = ref<VocabularyEntry[]>([]);
  const isLoading = ref(false);

  async function fetchTermList() {
    // TODO: Story 3.1 — 從 SQLite 載入詞彙
  }

  async function addTerm(_term: string) {
    // TODO: Story 3.1 — 新增詞彙至 SQLite
  }

  async function removeTerm(_id: string) {
    // TODO: Story 3.1 — 從 SQLite 刪除詞彙
  }

  return {
    termList,
    isLoading,
    fetchTermList,
    addTerm,
    removeTerm,
  };
});
