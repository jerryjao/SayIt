# Story 2.2: AI Prompt 自訂與上下文注入

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 使用者,
I want 自訂 AI 整理的 prompt 並注入上下文資訊,
So that 我能控制 AI 的整理風格，且 AI 能根據當前情境做更好的整理。

## Acceptance Criteria

1. **SettingsView AI Prompt 編輯區域** — SettingsView.vue 新增「AI 整理 Prompt」區塊（位於 API Key 區塊下方）。顯示多行文字編輯區域（`<textarea>`），預設填入預設 prompt 內容。使用者可自由編輯 prompt 內容。區塊包含「儲存」按鈕和「重置為預設」按鈕。

2. **Prompt 持久化與讀取** — 使用者修改 prompt 後點擊「儲存」，新 prompt 透過 `useSettingsStore` 持久化至 tauri-plugin-store（key: `"aiPrompt"`）。App 啟動時 `loadSettings()` 從 store 讀取已儲存的 prompt。若無儲存的 prompt，使用 `DEFAULT_SYSTEM_PROMPT`。後續的 AI 整理請求使用使用者自訂的 prompt。

3. **重置為預設** — 使用者點擊「重置為預設」按鈕時，prompt 編輯區域恢復為 `DEFAULT_SYSTEM_PROMPT` 內容。自動儲存至 tauri-plugin-store。顯示成功回饋訊息。

4. **enhancer.ts 接受自訂 prompt** — `enhanceText()` 函式簽名擴展為接受 system prompt 參數：`enhanceText(rawText: string, apiKey: string, systemPrompt: string): Promise<string>`。`useVoiceFlowStore` 呼叫 `enhanceText()` 時從 `useSettingsStore` 取得當前 prompt 傳入。`enhancer.ts` 內部不再使用硬編碼的 `DEFAULT_SYSTEM_PROMPT`（改由呼叫端傳入）。

5. **剪貼簿上下文注入** — AI 整理請求發送前，`enhancer.ts`（或呼叫端）讀取使用者當前系統剪貼簿內容。若剪貼簿非空，將內容作為 `<clipboard>...</clipboard>` 標籤附加至 system prompt 末尾。若剪貼簿為空，不注入 `<clipboard>` 標籤。

6. **詞彙上下文注入** — AI 整理請求發送前，從 `useVocabularyStore.termList` 取得當前詞彙清單。若詞彙清單非空，將詞彙以逗號分隔格式作為 `<vocabulary>...</vocabulary>` 標籤附加至 system prompt 末尾。若詞彙清單為空，不注入 `<vocabulary>` 標籤。

7. **空上下文不注入空標籤** — 剪貼簿為空時不傳空 `<clipboard></clipboard>` 標籤。詞彙清單為空時不傳空 `<vocabulary></vocabulary>` 標籤。兩者皆空時 system prompt 僅包含使用者自訂的 prompt 本體。AI 整理仍正常運作。

## Tasks / Subtasks

- [x]Task 1: 擴展 useSettingsStore 支援 AI Prompt 管理 (AC: #2, #3)
  - [x]1.1 在 `useSettingsStore.ts` 新增：
    - `import { DEFAULT_SYSTEM_PROMPT } from "../lib/enhancer"` — 從 enhancer.ts 匯出預設 prompt
    - `const aiPrompt = ref<string>(DEFAULT_SYSTEM_PROMPT)` — AI Prompt 狀態
  - [x]1.2 擴展 `loadSettings()` 加載 AI Prompt：
    - `const savedPrompt = await store.get<string>("aiPrompt")`
    - `aiPrompt.value = savedPrompt?.trim() || DEFAULT_SYSTEM_PROMPT`
  - [x]1.3 新增 `saveAiPrompt(prompt: string): Promise<void>` action：
    - 驗證 prompt 不為空白（空白時 throw Error）
    - `await store.set("aiPrompt", prompt.trim())`
    - `await store.save()`
    - `aiPrompt.value = prompt.trim()`
    - console.log 確認儲存成功
  - [x]1.4 新增 `resetAiPrompt(): Promise<void>` action：
    - `aiPrompt.value = DEFAULT_SYSTEM_PROMPT`
    - `await store.set("aiPrompt", DEFAULT_SYSTEM_PROMPT)`
    - `await store.save()`
  - [x]1.5 新增 `getAiPrompt(): string` getter：
    - `return aiPrompt.value`
  - [x]1.6 匯出新增的 state 和 actions：`aiPrompt`, `saveAiPrompt`, `resetAiPrompt`, `getAiPrompt`

- [x]Task 2: 擴展 enhancer.ts 支援自訂 prompt 和上下文注入 (AC: #4, #5, #6, #7)
  - [x]2.1 將 `DEFAULT_SYSTEM_PROMPT` 改為 `export const` 匯出（供 settingsStore 和測試使用）
  - [x]2.2 修改 `enhanceText()` 函式簽名：
    - 從 `enhanceText(rawText: string, apiKey: string)`
    - 改為 `enhanceText(rawText: string, apiKey: string, options?: EnhanceOptions)`
    - 定義 `interface EnhanceOptions { systemPrompt?: string; clipboardContent?: string; vocabularyTermList?: string[]; }`
  - [x]2.3 新增內部函式 `buildSystemPrompt(basePrompt: string, clipboardContent?: string, vocabularyTermList?: string[]): string`：
    - 以 `basePrompt` 為基礎
    - 若 `clipboardContent` 非空非空白，附加 `\n\n<clipboard>\n${clipboardContent}\n</clipboard>`
    - 若 `vocabularyTermList` 非空（length > 0），附加 `\n\n<vocabulary>\n${vocabularyTermList.join(", ")}\n</vocabulary>`
    - 回傳組裝後的完整 system prompt
  - [x]2.4 修改 `enhanceText()` 內部邏輯：
    - `const systemPrompt = options?.systemPrompt || DEFAULT_SYSTEM_PROMPT`
    - `const fullPrompt = buildSystemPrompt(systemPrompt, options?.clipboardContent, options?.vocabularyTermList)`
    - 使用 `fullPrompt` 作為 messages 中 system role 的 content

- [x]Task 3: 擴展 useVoiceFlowStore 傳遞 prompt 和上下文 (AC: #4, #5, #6)
  - [x]3.1 在 `handleStopRecording()` 的 AI 整理分支中：
    - 從 `useSettingsStore().getAiPrompt()` 取得當前 prompt
    - 讀取系統剪貼簿內容：`const clipboardContent = await readClipboardText()`
    - 從 `useVocabularyStore().termList` 取得詞彙清單
    - 呼叫 `enhanceText(result.rawText, apiKey, { systemPrompt, clipboardContent, vocabularyTermList })`
  - [x]3.2 新增剪貼簿讀取邏輯：
    - 使用 Tauri 的 `readText()` from `@tauri-apps/plugin-clipboard-manager`，或使用 `navigator.clipboard.readText()`
    - **注意**：需確認 Tauri v2 下可用的剪貼簿讀取 API（見 Dev Notes）
    - try/catch 包裹：讀取失敗時（如無權限）靜默忽略，clipboardContent 為 undefined
  - [x]3.3 詞彙清單格式化：
    - `const vocabularyTermList = vocabularyStore.termList.map(entry => entry.term)`
    - 若 termList 為空陣列，不傳 vocabularyTermList（或傳空陣列，由 enhancer.ts 判斷）

- [x]Task 4: SettingsView.vue 新增 AI Prompt 編輯 UI (AC: #1, #3)
  - [x]4.1 在 API Key 區塊下方新增「AI 整理 Prompt」`<section>`，樣式與 API Key 區塊一致（`rounded-xl border border-zinc-700 bg-zinc-900 p-5`）
  - [x]4.2 區塊包含：
    - 標題「AI 整理 Prompt」
    - 說明文字：「自訂 AI 整理文字時使用的系統提示詞。修改後點擊儲存。」
    - `<textarea>` 多行編輯器：
      - `v-model="promptInput"` 綁定本地 ref
      - 初始值從 `settingsStore.getAiPrompt()` 取得
      - `rows="10"` 提供足夠編輯空間
      - 樣式與 API Key input 一致（`rounded-lg border border-zinc-600 bg-zinc-800`）
      - `font-family: monospace` 方便閱讀 prompt
    - 按鈕列：
      - 「儲存」按鈕：呼叫 `settingsStore.saveAiPrompt(promptInput)`
      - 「重置為預設」按鈕：呼叫 `settingsStore.resetAiPrompt()` 後更新 `promptInput`
    - 回饋訊息（成功/錯誤），沿用現有 `showFeedbackMessage` 模式
  - [x]4.3 重置邏輯：
    - 重置前彈出確認對話框（`window.confirm("確定要重置為預設 Prompt 嗎？")`）
    - 確認後呼叫 `settingsStore.resetAiPrompt()`
    - 更新 `promptInput.value = settingsStore.getAiPrompt()`
    - 顯示「已重置為預設」回饋
  - [x]4.4 儲存邏輯：
    - 呼叫 `settingsStore.saveAiPrompt(promptInput.value)`
    - 成功顯示「Prompt 已儲存」
    - 失敗顯示錯誤訊息
  - [x]4.5 頁面進入時初始化：
    - `onMounted` 或 `watchEffect` 中 `promptInput.value = settingsStore.getAiPrompt()`

- [x]Task 5: 單元測試 (AC: #2, #4, #5, #6, #7)
  - [x]5.1 擴展 `tests/unit/enhancer.test.ts`：
    - 測試傳入自訂 systemPrompt：確認 API 請求使用自訂 prompt
    - 測試不傳 systemPrompt 時使用 DEFAULT_SYSTEM_PROMPT
    - 測試 clipboardContent 注入：確認 `<clipboard>` 標籤出現在 system prompt 中
    - 測試 vocabularyTermList 注入：確認 `<vocabulary>` 標籤出現在 system prompt 中
    - 測試空 clipboardContent 不注入標籤
    - 測試空 vocabularyTermList 不注入標籤
    - 測試 buildSystemPrompt 組裝邏輯（clipboard + vocabulary 組合）
  - [x]5.2 擴展 `tests/unit/use-settings-store.test.ts`（若存在）或建立：
    - 測試 `saveAiPrompt()`：持久化至 store
    - 測試 `resetAiPrompt()`：恢復預設值並持久化
    - 測試 `loadSettings()` 讀取已儲存的 prompt
    - 測試 `loadSettings()` 無儲存值時使用預設
  - [x]5.3 擴展 `tests/unit/use-voice-flow-store.test.ts`：
    - 測試 AI 整理時傳遞 systemPrompt 參數
    - 測試剪貼簿內容被注入（mock clipboard API）
    - 測試詞彙清單被注入

- [x]Task 6: 整合驗證 (AC: #1-7)
  - [x]6.1 `pnpm exec vue-tsc --noEmit` 通過
  - [x]6.2 `pnpm test` 所有測試通過
  - [x]6.3 手動測試：開啟設定頁面 → 看到 AI Prompt 編輯區域，預設填入預設 prompt
  - [x]6.4 手動測試：修改 prompt 內容 → 點擊儲存 → 顯示「Prompt 已儲存」→ 重啟 App 後 prompt 保持自訂值
  - [x]6.5 手動測試：點擊「重置為預設」→ 確認對話框 → 確認 → prompt 恢復為預設內容
  - [x]6.6 手動測試：剪貼簿有內容時觸發語音輸入（>= 10 字）→ AI 整理結果考量剪貼簿上下文
  - [x]6.7 手動測試：剪貼簿為空時觸發語音輸入 → AI 整理正常運作，不受影響
  - [x]6.8 手動測試：有自訂詞彙時觸發語音輸入 → AI 整理結果正確保留專有名詞（需 Story 3.1 先有資料，若 3.1 未完成則以空詞彙測試）

## Dev Notes

### 架構模式與約束

**Brownfield 專案** — 基於 Story 2.1（enhancer.ts + useVoiceFlowStore AI 整理流程）繼續擴展。

**本 Story 的核心變更：**
1. `useSettingsStore` 新增 AI Prompt 管理（CRUD + 持久化）
2. `enhancer.ts` 擴展接受自訂 prompt + 上下文注入
3. `useVoiceFlowStore` 呼叫 enhanceText 時傳遞 prompt + 上下文
4. `SettingsView.vue` 新增 prompt 編輯 UI

**依賴方向規則（嚴格遵守）：**
```
views/ → components/ + stores/ + composables/
stores/ → lib/
lib/ → 外部 API（Groq）
composables/ → stores/ + lib/
```

### Story 2.1 實作結果（當前程式碼狀態）

**enhancer.ts 現狀（Story 2.1 已完成）：**
- `DEFAULT_SYSTEM_PROMPT` 是 module-level 常數（非 export）
- `enhanceText(rawText: string, apiKey: string): Promise<string>` — 兩參數簽名
- 內部硬編碼使用 `DEFAULT_SYSTEM_PROMPT`
- 使用 `withTimeout()` 包裹 fetch 實作 5 秒 timeout
- HTTP Client：`@tauri-apps/plugin-http` 的 `fetch`

**useVoiceFlowStore 現狀（Story 2.1 已完成）：**
- `handleStopRecording()` 中 AI 整理分支：`await enhanceText(result.rawText, apiKey)` — 兩參數呼叫
- 字數門檻 `ENHANCEMENT_CHAR_THRESHOLD = 10`
- fallback 行為已完整實作

**useSettingsStore 現狀：**
- 管理 `hotkeyConfig`、`apiKey`
- `SettingsDto` type 已預定義 `aiPrompt: string`（types/settings.ts line 21）
- 但 store 尚未實作 aiPrompt 相關邏輯

### enhancer.ts 修改策略

**函式簽名變更：**
```typescript
// Story 2.1 版本（現有）
export async function enhanceText(
  rawText: string,
  apiKey: string,
): Promise<string>

// Story 2.2 版本（修改後）
export interface EnhanceOptions {
  systemPrompt?: string;
  clipboardContent?: string;
  vocabularyTermList?: string[];
}

export async function enhanceText(
  rawText: string,
  apiKey: string,
  options?: EnhanceOptions,
): Promise<string>
```

使用 optional 參數 `options?` 確保向後相容。不傳 options 時行為與 2.1 完全相同。

**System Prompt 組裝邏輯（buildSystemPrompt）：**
```typescript
function buildSystemPrompt(
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

**`DEFAULT_SYSTEM_PROMPT` 匯出：**
```typescript
// 從 module-level const 改為 export const
export const DEFAULT_SYSTEM_PROMPT = `...`;
```

settingsStore 需要 import 這個常數作為預設值。

### 剪貼簿讀取方案

**方案選擇：** 使用 Rust Tauri Command 讀取剪貼簿，因為 `clipboard_paste.rs` 已使用 `arboard` 操作剪貼簿。

**可用選項（依優先順序）：**

1. **`navigator.clipboard.readText()`（Web API）** — 最簡單，但在 Tauri WebView 中可能需要焦點窗口才能讀取，且 HUD Window 是 `setIgnoreCursorEvents(true)` 的透明視窗，可能無法使用此 API。

2. **新增 Rust Tauri Command `read_clipboard_text()`** — 在 `clipboard_paste.rs` 新增一個 read command，使用 `arboard::Clipboard::new()?.get_text()`。這是最可靠的方案，因為 Rust 端不受 WebView 焦點限制。

3. **`@tauri-apps/plugin-clipboard-manager`** — Tauri 官方剪貼簿 plugin，但專案目前未安裝此 plugin。

**建議方案：** 先嘗試 `navigator.clipboard.readText()`。若在 HUD Window 環境下無法使用（權限問題），退回方案 2（新增 Rust command）。

**重要：** 剪貼簿讀取在 `handleStopRecording()` 中執行，此時 HUD 可能已隱藏或正在顯示 enhancing 狀態。需要在呼叫 `enhanceText()` 之前讀取剪貼簿，因為 `paste_text` 會覆寫剪貼簿內容。

**剪貼簿讀取時機：**
```
transcribeAudio() → result.rawText
  → 讀取剪貼簿（此時剪貼簿還是使用者原本的內容）
  → enhanceText(rawText, apiKey, { clipboardContent })
  → paste_text(enhancedText)  ← 這步會覆寫剪貼簿
```

### useSettingsStore 擴展

**tauri-plugin-store key 命名：**
- 現有：`"hotkeyTriggerKey"`, `"hotkeyTriggerMode"`, `"groqApiKey"`
- 新增：`"aiPrompt"`

**loadSettings() 擴展：**
```typescript
// 現有邏輯之後新增：
const savedPrompt = await store.get<string>("aiPrompt");
aiPrompt.value = savedPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
```

### SettingsView.vue UI 設計

**佈局結構：**
```
設定
├── [Groq API Key 區塊]      ← 現有
│   ├── 標題 + 狀態標籤
│   ├── 說明文字
│   ├── Input + 按鈕列
│   └── 回饋訊息 + 刪除按鈕
│
└── [AI 整理 Prompt 區塊]    ← 新增
    ├── 標題
    ├── 說明文字
    ├── Textarea（多行編輯）
    ├── 按鈕列（儲存 + 重置為預設）
    └── 回饋訊息
```

**回饋訊息處理：** 新增獨立的 prompt 回饋 ref（`promptFeedbackMessage` / `promptFeedbackType`），避免與 API Key 區塊的回饋衝突。或者共用現有的 `showFeedbackMessage` 邏輯但分區域顯示。建議使用獨立 ref，更清晰。

**Textarea 樣式：** 與現有 input 風格一致，使用 monospace 字型方便閱讀 prompt 結構：
```html
<textarea
  v-model="promptInput"
  rows="10"
  class="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3
         font-mono text-sm text-white outline-none transition
         focus:border-blue-500 resize-y"
/>
```

### 詞彙清單注入注意事項

**useVocabularyStore 現狀：** Store 骨架已建立，但所有 CRUD 方法都是 TODO（Story 3.1）。`termList` 是空的 ref。

**本 Story 的處理方式：** 即使 Story 3.1 尚未完成，本 Story 仍應：
1. 在 `handleStopRecording()` 中讀取 `vocabularyStore.termList`
2. 格式化為 `string[]` 傳遞給 enhancer.ts
3. 當 termList 為空時，不注入 `<vocabulary>` 標籤

這樣 Story 3.1 完成後，詞彙注入會自動生效，無需額外修改。

### 跨 Story 注意事項

- **Story 2.1** 已完成 enhancer.ts 基礎和 useVoiceFlowStore AI 整理流程。本 Story 在此基礎上擴展。
- **Story 3.1** 會實作 `useVocabularyStore` 的 CRUD。本 Story 只讀取 `termList`，不依賴 CRUD 功能。
- **Story 3.2** 會實作詞彙注入 Whisper + AI 上下文（更完整的詞彙整合）。本 Story 的 `<vocabulary>` 注入是其前置工作。

### 現有檔案改動點

**修改檔案：**
```
src/lib/enhancer.ts              — export DEFAULT_SYSTEM_PROMPT、擴展 enhanceText 簽名、buildSystemPrompt
src/stores/useSettingsStore.ts   — 新增 aiPrompt 管理（state + actions）
src/stores/useVoiceFlowStore.ts  — enhanceText 呼叫加入 options 參數（prompt + clipboard + vocabulary）
src/views/SettingsView.vue       — 新增 AI Prompt 編輯區塊
tests/unit/enhancer.test.ts      — 新增自訂 prompt + 上下文注入測試
tests/unit/use-voice-flow-store.test.ts — 新增 prompt/上下文傳遞測試
```

**可能新增檔案：**
```
tests/unit/use-settings-store.test.ts — settings store prompt 管理測試（若不存在）
```

**不修改的檔案（明確排除）：**
- `src/components/NotchHud.vue` — 不涉及 HUD 顯示
- `src/lib/recorder.ts` — 錄音邏輯不變
- `src/lib/transcriber.ts` — 轉錄邏輯不變
- `src/types/index.ts` — HudStatus 不變
- `src/App.vue` — HUD 入口不變
- `Cargo.toml` / `package.json` — 不需新增依賴（若使用 navigator.clipboard）
- `src-tauri/src/plugins/clipboard_paste.rs` — 除非需要新增 read command（見剪貼簿方案）

**可能需要修改的 Rust 檔案（視剪貼簿方案而定）：**
- `src-tauri/src/plugins/clipboard_paste.rs` — 若需新增 `read_clipboard_text` command
- `src-tauri/src/lib.rs` — 若需註冊新 command
- `src-tauri/capabilities/default.json` — 若需新增權限

### 不需要的 Cargo/NPM 依賴變更

本 Story **不需要安裝任何新依賴**（假設使用 `navigator.clipboard.readText()` 或已有的 arboard）。若改用 `@tauri-apps/plugin-clipboard-manager`，則需要安裝此 plugin（Rust + JS）。建議先嘗試不安裝新依賴的方案。

### 安全規則提醒

- API Key 從 `useSettingsStore().getApiKey()` 取得，不硬編碼
- API Key 不寫入任何日誌
- **剪貼簿內容可能包含敏感資訊** — 不寫入日誌，僅傳送至 Groq API
- CSP `connect-src 'self' https://api.groq.com` 限制資料只傳到 Groq
- AI Prompt 以明文存於 tauri-plugin-store（與 API Key 同一 settings.json）

### 效能注意事項

- 剪貼簿讀取是同步/快速操作，不影響 E2E 延遲
- 詞彙清單從 Pinia store 直接讀取，無 DB 查詢
- System prompt 組裝是純字串操作，無效能影響
- **注意 prompt 長度**：若使用者自訂 prompt 過長 + 大量詞彙 + 長剪貼簿內容，可能超出 LLM context window。目前不做截斷（Phase 1），但在 Dev Notes 記錄此風險。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2 — Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Security — tauri-plugin-store 本地儲存]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — Pinia Stores 結構]
- [Source: _bmad-output/planning-artifacts/prd.md#AI 文字整理 FR10-FR12]
- [Source: _bmad-output/implementation-artifacts/2-1-groq-llm-text-enhancement.md — enhancer.ts 設計]
- [Source: Codebase — src/lib/enhancer.ts（擴展目標）]
- [Source: Codebase — src/stores/useSettingsStore.ts（擴展目標）]
- [Source: Codebase — src/stores/useVoiceFlowStore.ts（修改呼叫方式）]
- [Source: Codebase — src/views/SettingsView.vue（新增 UI 區塊）]
- [Source: Codebase — src/types/settings.ts — SettingsDto 已預定義 aiPrompt field]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- vue-tsc: 無新增錯誤
- pnpm test: 109 tests passed

### Completion Notes List

- SettingsView 新增 AI Prompt textarea + 儲存/重置按鈕
- useSettingsStore 新增 saveAiPrompt/resetAiPrompt/getAiPrompt
- enhancer.ts 擴展 EnhanceOptions（systemPrompt, clipboardContent, vocabularyTermList）
- buildSystemPrompt 支援 clipboard/vocabulary 標籤注入

### Change Log

- Story 2.2 完整實作 — AI Prompt 自訂與上下文注入

### File List

- src/views/SettingsView.vue
- src/stores/useSettingsStore.ts
- src/lib/enhancer.ts
- src/stores/useVoiceFlowStore.ts
- tests/unit/enhancer.test.ts
- tests/unit/use-voice-flow-store.test.ts
