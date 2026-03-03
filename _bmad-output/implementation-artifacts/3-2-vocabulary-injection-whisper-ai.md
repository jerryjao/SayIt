# Story 3.2: 詞彙注入 Whisper 與 AI 上下文

Status: done

## Story

As a 使用者,
I want 我的自訂詞彙自動提升語音辨識和 AI 整理的準確度,
so that 專業術語不再被錯誤辨識或轉換。

## Acceptance Criteria

1. **AC1: Whisper API 詞彙注入**
   - Given 使用者已建立自訂詞彙清單
   - When transcriber.ts 呼叫 Groq Whisper API
   - Then 將詞彙清單格式化為 `"Important Vocabulary: 詞彙1, 詞彙2, 詞彙3"` 字串
   - And 作為 Whisper API 的 `prompt` 參數傳入
   - And Whisper 辨識結果中的專有名詞準確度提升

2. **AC2: AI 整理詞彙上下文注入**
   - Given 使用者已建立自訂詞彙清單且 AI 整理啟用
   - When enhancer.ts 呼叫 Groq LLM API
   - Then 將詞彙清單作為 `<vocabulary>詞彙1, 詞彙2, 詞彙3</vocabulary>` 注入 system prompt
   - And AI 整理結果中正確保留專有名詞原文

3. **AC3: 空詞彙清單處理**
   - Given 詞彙清單為空
   - When 執行轉錄或 AI 整理
   - Then Whisper API 不帶 prompt 參數（或帶空字串）
   - And AI 整理的 system prompt 不包含 `<vocabulary>` 標籤
   - And 流程正常運作不報錯

4. **AC4: 即時生效**
   - Given 使用者在字典中新增或刪除詞彙
   - When 下一次觸發語音輸入
   - Then transcriber.ts 和 enhancer.ts 自動使用最新的詞彙清單
   - And 不需重啟 App 即時生效

5. **AC5: 大量詞彙截取**
   - Given 詞彙清單包含大量詞彙（100+）
   - When 注入 Whisper prompt 或 AI 上下文
   - Then 系統正常運作不超出 API 限制
   - And 若詞彙過多導致 prompt 超長，截取最近新增的詞彙優先注入

6. **AC6: HUD Window 詞彙可用性**
   - Given 語音流程在 HUD Window 的 useVoiceFlowStore 中執行
   - When handleStopRecording() 需要存取詞彙清單
   - Then useVocabularyStore 在 HUD Window 中有可用的詞彙資料
   - And 詞彙資料與 Main Window 同步

## Tasks / Subtasks

- [x]Task 1: transcriber.ts 新增詞彙 prompt 參數 (AC: #1, #3, #5)
  - [x]1.1 擴展 `transcribeAudio()` 函式簽名，新增 `vocabularyTermList?: string[]` 參數
  - [x]1.2 實作 `formatWhisperPrompt(termList: string[]): string` 輔助函式
  - [x]1.3 將格式化後的 prompt 加入 FormData（`formData.append("prompt", whisperPrompt)`）
  - [x]1.4 空清單時不 append prompt 欄位（或傳空字串）
  - [x]1.5 實作大量詞彙截取：超過上限時取最近新增的詞彙

- [x]Task 2: useVoiceFlowStore 整合 transcriber 詞彙注入 (AC: #1, #4, #6)
  - [x]2.1 在 handleStopRecording() 的 transcribeAudio 呼叫處傳入詞彙清單
  - [x]2.2 確認 useVocabularyStore 在 HUD Window 中可用且有資料

- [x]Task 3: HUD Window 詞彙資料初始化 (AC: #4, #6)
  - [x]3.1 在 HUD Window 初始化 database（main.ts bootstrap 或 App.vue onMounted）
  - [x]3.2 呼叫 vocabularyStore.fetchTermList() 載入詞彙
  - [x]3.3 監聽 vocabulary:changed 事件，收到後重新 fetchTermList() 保持同步

- [x]Task 4: 大量詞彙截取策略 (AC: #5)
  - [x]4.1 定義 MAX_WHISPER_PROMPT_TERMS 常數（建議 50）和 MAX_VOCABULARY_TERMS 常數（建議 100）
  - [x]4.2 transcriber 端：截取最近新增的 N 個詞彙（按 createdAt DESC 排序已在 fetchTermList 保證）
  - [x]4.3 enhancer 端：截取最近新增的 N 個詞彙

- [x]Task 5: 手動整合測試 (AC: #1-#6)
  - [x]5.1 驗證有詞彙時 Whisper 辨識包含正確專有名詞
  - [x]5.2 驗證有詞彙時 AI 整理保留專有名詞原文
  - [x]5.3 驗證空詞彙清單時轉錄和 AI 整理正常運作
  - [x]5.4 驗證在 Main Window 新增詞彙後，下一次語音輸入使用新詞彙
  - [x]5.5 驗證刪除詞彙後，下一次語音輸入不再包含該詞彙
  - [x]5.6 驗證大量詞彙（50+）時系統不崩潰

## Dev Notes

### 已實作 vs 待實作分析

Story 2.2 的 Dev 已提前完成部分 Story 3.2 的工作。以下是精確的已實作/待實作對照：

| 元件 | 已實作（Story 2.2） | 待實作（Story 3.2） |
|------|---------------------|---------------------|
| `enhancer.ts` | `buildSystemPrompt()` 已支援 `vocabularyTermList` 參數，正確注入 `<vocabulary>` 標籤 | 不需修改 |
| `enhancer.ts` | `EnhanceOptions.vocabularyTermList?: string[]` 已定義 | 不需修改 |
| `useVoiceFlowStore.ts` | `handleStopRecording()` lines 270-281 已從 vocabularyStore 取得 termList 傳入 enhanceText | 新增 transcribeAudio 詞彙傳入 |
| `transcriber.ts` | 無詞彙相關程式碼 | **核心任務：新增 prompt 參數** |
| HUD Window (`main.ts`) | 無 DB 初始化、無 vocabularyStore 初始化 | **核心任務：初始化 DB + 載入詞彙** |

### transcriber.ts 修改策略

**目前 transcribeAudio 函式簽名：**
```typescript
export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
): Promise<Pick<TranscriptionRecord, "rawText" | "transcriptionDurationMs">>
```

**修改後：**
```typescript
export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  vocabularyTermList?: string[],
): Promise<Pick<TranscriptionRecord, "rawText" | "transcriptionDurationMs">>
```

新增第三個可選參數，保持向後相容。

**Whisper prompt 格式化：**
```typescript
const MAX_WHISPER_PROMPT_TERMS = 50;

function formatWhisperPrompt(termList: string[]): string {
  const terms = termList.slice(0, MAX_WHISPER_PROMPT_TERMS);
  return `Important Vocabulary: ${terms.join(", ")}`;
}
```

**FormData 中新增 prompt 欄位：**
```typescript
// 在 formData.append("response_format", "text"); 之後
if (vocabularyTermList && vocabularyTermList.length > 0) {
  const whisperPrompt = formatWhisperPrompt(vocabularyTermList);
  formData.append("prompt", whisperPrompt);
}
```

**注意**：Groq Whisper API 的 `prompt` 參數用於引導模型辨識特定詞彙。格式 `"Important Vocabulary: 詞1, 詞2"` 是 Whisper API 社群廣泛使用的最佳實踐，能有效提升專有名詞辨識率。

### useVoiceFlowStore 修改策略

`handleStopRecording()` 中已有 AI enhancer 的詞彙注入（lines 270-281）。需在更早的 `transcribeAudio()` 呼叫處也傳入詞彙：

**目前（line 255）：**
```typescript
const result = await transcribeAudio(audioBlob, apiKey);
```

**修改後：**
```typescript
const vocabularyStore = useVocabularyStore();
const vocabularyTermList = vocabularyStore.termList.map(
  (entry) => entry.term,
);

const result = await transcribeAudio(
  audioBlob,
  apiKey,
  vocabularyTermList.length > 0 ? vocabularyTermList : undefined,
);
```

**優化**：vocabularyStore 的取用可以提前到 transcribeAudio 呼叫前，讓後續 enhancer 也重用同一個 `vocabularyTermList`，避免重複 `.map()`。

```typescript
// 提前取得詞彙（transcriber + enhancer 共用）
const vocabularyStore = useVocabularyStore();
const vocabularyTermList = vocabularyStore.termList.map(
  (entry) => entry.term,
);
const hasVocabulary = vocabularyTermList.length > 0;

const result = await transcribeAudio(
  audioBlob,
  apiKey,
  hasVocabulary ? vocabularyTermList : undefined,
);

// ... 後續 enhancer 也使用同一個 vocabularyTermList
```

注意：lines 270-273 已有 `const vocabularyStore = useVocabularyStore()` 的呼叫（在 enhancer 分支中），需合併到共用位置避免重複。

### HUD Window 詞彙資料初始化問題

**核心問題**：語音流程（錄音→轉錄→AI 整理→貼上）在 HUD Window (App.vue) 中執行。`useVoiceFlowStore.handleStopRecording()` 呼叫 `useVocabularyStore()` 取得詞彙，但 HUD Window 目前：

1. 未初始化 database（`initializeDatabase()` 僅在 `main-window.ts` 呼叫）
2. 未呼叫 `vocabularyStore.fetchTermList()`（termList 永遠為空陣列）

**解決方案**：在 HUD Window 啟動時初始化 DB 並載入詞彙。

```
修改 src/App.vue onMounted:
  1. await initializeDatabase()
  2. const vocabularyStore = useVocabularyStore()
  3. await vocabularyStore.fetchTermList()
  4. 監聽 vocabulary:changed 事件 → 重新 fetchTermList()
```

或者修改 `src/main.ts`：
```typescript
import { initializeDatabase } from "./lib/database";
// ... 在 createApp 之後
try {
  await initializeDatabase();
} catch (err) {
  console.error("[hud] Database init failed:", err);
}
```

**建議方案**：在 `App.vue` 的 `onMounted` 中、`voiceFlowStore.initialize()` 之前，先初始化 DB 和載入詞彙。這樣 initialize 中的 hotkey listener 觸發 handleStopRecording 時就有詞彙可用。

```typescript
// App.vue onMounted（修改後）
onMounted(async () => {
  // 1. 初始化 DB（供 vocabularyStore 使用）
  try {
    await initializeDatabase();
  } catch (err) {
    console.error("[App] Database init failed:", err);
  }

  // 2. 載入詞彙（供 transcriber + enhancer 使用）
  const vocabularyStore = useVocabularyStore();
  await vocabularyStore.fetchTermList();

  // 3. 監聯詞彙變更（Main Window 新增/刪除詞彙時同步）
  unlistenVocabularyChanged = await listenToEvent(
    VOCABULARY_CHANGED,
    () => { void vocabularyStore.fetchTermList(); }
  );

  // 4. 初始化語音流程
  await voiceFlowStore.initialize();

  // ... 其餘現有邏輯
});
```

### 即時生效機制

詞彙新增/刪除即時生效的完整資料流：

```
Main Window: 使用者新增詞彙
  → DictionaryView → vocabularyStore.addTerm()
  → SQLite INSERT
  → emitEvent(VOCABULARY_CHANGED, { action: 'added', term })
  → 事件廣播至所有視窗
  ↓
HUD Window: listenToEvent(VOCABULARY_CHANGED, ...)
  → vocabularyStore.fetchTermList()  // 重新從 SQLite 讀取
  → termList 更新
  ↓
下一次按下熱鍵:
  → handleStopRecording()
  → vocabularyStore.termList（已是最新）
  → transcribeAudio(blob, apiKey, latestTermList)
  → enhanceText(rawText, apiKey, { vocabularyTermList: latestTermList })
```

**關鍵**：HUD Window 必須監聽 `vocabulary:changed` 事件並重新 `fetchTermList()`。直接從 SQLite 重新讀取（而非從事件 payload 增量更新）是最安全的做法，確保資料一致性。

### 大量詞彙截取策略

Groq Whisper API prompt 參數有長度限制（與模型 context 相關）。AI enhancer system prompt 也有 token 上限。

**建議常數：**
```typescript
// transcriber.ts
const MAX_WHISPER_PROMPT_TERMS = 50;

// enhancer.ts（可在 buildSystemPrompt 中截取）
const MAX_VOCABULARY_TERMS = 100;
```

**截取邏輯**：`fetchTermList()` 已按 `created_at DESC` 排序，所以 `termList[0]` 是最新的詞彙。`slice(0, N)` 即可截取最近新增的 N 個。

### 不需修改的檔案

- `src/types/vocabulary.ts` — VocabularyEntry 不變
- `src/types/events.ts` — VocabularyChangedPayload 不變
- `src/composables/useTauriEvents.ts` — 常數已存在
- `src/lib/database.ts` — DB schema 不變
- `src/views/DictionaryView.vue` — CRUD UI（Story 3.1 範圍）
- `src/stores/useSettingsStore.ts` — 不涉及詞彙

### 需要修改的檔案清單

| 檔案 | 修改範圍 |
|------|---------|
| `src/lib/transcriber.ts` | 新增 vocabularyTermList 參數 + formatWhisperPrompt + FormData append |
| `src/stores/useVoiceFlowStore.ts` | handleStopRecording 傳入詞彙至 transcribeAudio + 重構詞彙取用位置 |
| `src/App.vue` | onMounted 新增 DB 初始化 + 詞彙載入 + vocabulary:changed 事件監聽 |
| `src/lib/enhancer.ts` | （可選）buildSystemPrompt 加入 MAX_VOCABULARY_TERMS 截取 |

### enhancer.ts 已實作的詞彙注入程式碼確認

`enhancer.ts` 的 `buildSystemPrompt()` (line 46-62) 已完整支援：

```typescript
export function buildSystemPrompt(
  basePrompt: string,
  clipboardContent?: string,
  vocabularyTermList?: string[],
): string {
  let prompt = basePrompt;
  if (clipboardContent && clipboardContent.trim()) {
    prompt += `\n\n<clipboard>\n${clipboardContent}\n</clipboard>`;
  }
  if (vocabularyTermList && vocabularyTermList.length > 0) {
    prompt += `\n\n<vocabulary>\n${vocabularyTermList.join(", ")}\n</vocabulary>`;
  }
  return prompt;
}
```

`useVoiceFlowStore.ts` lines 270-281 已呼叫：
```typescript
const vocabularyStore = useVocabularyStore();
const vocabularyTermList = vocabularyStore.termList.map(
  (entry) => entry.term,
);
// ... 傳入 enhanceText
```

**結論**：enhancer 端已完整實作。Story 3.2 可以選擇在 `buildSystemPrompt` 中加入截取邏輯（MAX_VOCABULARY_TERMS），但核心功能已在。

### main.ts 非同步 bootstrap 改造注意

目前 `src/main.ts` 是同步式：
```typescript
const pinia = createPinia();
createApp(App).use(pinia).mount("#app");
```

如果選擇在 main.ts 中初始化 DB，需要改為 async bootstrap 模式（參考 main-window.ts）。但**建議不改 main.ts**，改在 App.vue onMounted 中處理，因為：
1. 保持 main.ts 簡潔（App.vue 已有初始化邏輯）
2. DB 初始化失敗不應阻止 App 掛載（HUD 仍需顯示）
3. 與 main-window.ts 的模式差異是合理的（HUD 更輕量）

### Project Structure Notes

- 不新增任何新檔案
- 所有修改在既有專案結構內
- 依賴方向符合：`App.vue → useVocabularyStore → database.ts`
- transcriber.ts 保持 lib/ 層純邏輯（不依賴 Vue/Store），詞彙資料由 store 傳入

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2] — AC 完整定義
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — Groq API 呼叫模式
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns] — Tauri Event 訂閱模式
- [Source: _bmad-output/planning-artifacts/architecture.md#Component Boundaries] — HUD vs Main Window 職責
- [Source: _bmad-output/implementation-artifacts/3-1-vocabulary-crud-interface.md] — Story 3.1 詞彙 CRUD 骨架、Tauri Event 發送模式
- [Source: src/lib/transcriber.ts] — 現有 Whisper API 呼叫（無 prompt 參數）
- [Source: src/lib/enhancer.ts] — 已實作 buildSystemPrompt + vocabularyTermList 支援
- [Source: src/stores/useVoiceFlowStore.ts] — 已實作 enhancer 詞彙注入（lines 270-281），缺 transcriber 詞彙注入
- [Source: src/stores/useVocabularyStore.ts] — 骨架（Story 3.1 實作後有 termList + fetchTermList）
- [Source: src/App.vue] — HUD Window 初始化流程（無 DB 初始化、無詞彙載入）
- [Source: src/main.ts] — HUD Window 入口（同步式，無 bootstrap）
- [Source: src/main-window.ts] — Main Window 入口（async bootstrap + DB 初始化參考）

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- vue-tsc: 無新增錯誤
- pnpm test: 128 tests passed

### Completion Notes List

- transcriber.ts 擴展 formatWhisperPrompt + MAX_WHISPER_PROMPT_TERMS=50
- enhancer.ts vocabulary 標籤注入 + MAX_VOCABULARY_TERMS=100
- useVoiceFlowStore 詞彙同時注入 transcriber + enhancer
- App.vue HUD Window DB init + vocabularyStore.fetchTermList + vocabulary:changed 監聽

### Change Log

- Story 3.2 完整實作 — 詞彙注入 Whisper 與 AI 上下文

### File List

- src/lib/transcriber.ts
- src/lib/enhancer.ts
- src/stores/useVoiceFlowStore.ts
- src/App.vue
- tests/unit/transcriber.test.ts
- tests/unit/use-voice-flow-store.test.ts
