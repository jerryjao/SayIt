# Story 2.1: Groq LLM AI 文字整理核心流程

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 使用者,
I want 語音轉錄結果自動經 AI 整理為通順的書面語,
So that 我的語音輸出可以直接使用，不需手動編輯口語贅詞和標點。

## Acceptance Criteria

1. **enhancer.ts 模組建立** — 建立 `src/lib/enhancer.ts` 模組，呼叫 Groq LLM API（`https://api.groq.com/openai/v1/chat/completions` endpoint）。使用預設 system prompt 進行口語→書面語整理（去贅詞、重組句構、修正標點、適當分段、保持原意）。API Key 從 `useSettingsStore.getApiKey()` 取得。API 請求透過 HTTPS 傳送。模組匯出 `enhanceText(rawText: string, apiKey: string): Promise<string>` 函式。

2. **字數門檻分支（>= 10 字走 AI 整理）** — 轉錄結果文字長度 >= 10 字時，`useVoiceFlowStore` 的 `handleStopRecording()` 在轉錄完成後進入 AI 整理流程。狀態更新為 `'enhancing'`，發送 `voice-flow:state-changed` 事件 `{ status: 'enhancing' }`。AI 整理完成後將整理後的文字貼入游標位置。

3. **字數門檻分支（< 10 字跳過 AI）** — 轉錄結果文字長度 < 10 字時，跳過 AI 整理步驟。直接將原始轉錄文字貼入游標位置。`useVoiceFlowStore` 狀態直接從 `'transcribing'` 跳至 `'success'`（維持現有行為）。

4. **5 秒 timeout fallback** — AI 整理 API 請求進行中，若請求超過 5 秒未回應，自動取消請求（AbortController timeout）。將原始轉錄文字貼入游標位置作為 fallback。`useVoiceFlowStore` 狀態更新為 `'success'`。HUD 顯示「已貼上（未整理）」。

5. **API 錯誤 fallback** — AI 整理 API 請求失敗（非 timeout，如 HTTP 非 200、網路錯誤），將原始轉錄文字貼入游標位置作為 fallback。`useVoiceFlowStore` 狀態更新為 `'success'`。HUD 顯示「已貼上（未整理）」。

6. **HUD enhancing 狀態顯示** — `useVoiceFlowStore` 狀態為 `'enhancing'` 時，`NotchHud.vue` 顯示「整理中...」狀態（loading spinner 動畫，與 transcribing 相同視覺效果）。HUD 狀態完整流程：idle → recording → transcribing → enhancing → success → idle。

7. **端到端延遲目標** — AI 整理完成後文字成功貼入，端到端延遲（含 AI 整理）< 3 秒。

## Tasks / Subtasks

- [x] Task 1: 建立 enhancer.ts 模組 (AC: #1)
  - [x]1.1 建立 `src/lib/enhancer.ts`，定義常數：
    - `GROQ_CHAT_API_URL = "https://api.groq.com/openai/v1/chat/completions"` — Groq LLM chat completions endpoint
    - `GROQ_LLM_MODEL = "llama-3.3-70b-versatile"` — Groq 可用的高品質模型
    - `ENHANCEMENT_TIMEOUT_MS = 5000` — 5 秒 timeout
    - `DEFAULT_SYSTEM_PROMPT` — 預設 system prompt（見 Dev Notes）
  - [x]1.2 實作 `enhanceText(rawText: string, apiKey: string): Promise<string>` 函式：
    - 使用 `@tauri-apps/plugin-http` 的 `fetch`（與 transcriber.ts 一致）
    - 組裝 chat completions 請求 body：`{ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: rawText }], temperature: 0.3, max_tokens: 2048 }`
    - 使用 `AbortController` + `setTimeout` 實作 5 秒 timeout
    - 請求 headers：`Authorization: Bearer ${apiKey}`, `Content-Type: application/json`
    - 回傳 `response.choices[0].message.content.trim()`
    - 若回應為空或 choices 為空，回傳原始 rawText
  - [x]1.3 錯誤處理：
    - `AbortError`（timeout）→ 拋出 `new Error("AI 整理逾時")` — 讓呼叫端 catch 決定 fallback
    - HTTP 非 200 → 拋出 `new Error(\`AI 整理失敗：${response.status}\`)`
    - 網路錯誤（TypeError）→ 自然拋出，呼叫端 catch 處理
  - [x]1.4 新增 `getEnhancementErrorMessage(error: unknown): string` 至 `src/lib/errorUtils.ts`：
    - `AbortError` 或包含 "逾時" → `"AI 整理逾時，已貼上原始文字"`
    - HTTP 401 → `"API Key 無效或已過期"`
    - HTTP 429 → `"請求過於頻繁，請稍後再試"`
    - HTTP 5xx → `"AI 整理服務暫時無法使用"`
    - 其他 → `"AI 整理失敗"`

- [x] Task 2: 擴展 useVoiceFlowStore 加入 AI 整理流程 (AC: #2, #3, #4, #5)
  - [x]2.1 在 `useVoiceFlowStore.ts` 新增常數：
    - `ENHANCEMENT_CHAR_THRESHOLD = 10` — 字數門檻
    - `ENHANCING_MESSAGE = "整理中..."` — enhancing 狀態訊息
    - `PASTE_SUCCESS_UNENHANCED_MESSAGE = "已貼上（未整理）"` — fallback 成功訊息
  - [x]2.2 新增 `import { enhanceText } from "../lib/enhancer"`
  - [x]2.3 修改 `handleStopRecording()` 中轉錄成功後的流程（在取得 `result.rawText` 之後、`invoke("paste_text")` 之前）：
    - 判斷 `result.rawText.length >= ENHANCEMENT_CHAR_THRESHOLD`
    - **>= 10 字**：進入 AI 整理分支
      - `transitionTo("enhancing", ENHANCING_MESSAGE)`
      - try：`const enhancedText = await enhanceText(result.rawText, apiKey)`
      - 記錄 `enhancementDurationMs = performance.now() - enhancementStartTime`
      - `await hideHud()` → `await invoke("paste_text", { text: enhancedText })`
      - `isRecording.value = false`
      - `transitionTo("success", PASTE_SUCCESS_MESSAGE)`
      - catch（AI 整理失敗/逾時）：
        - `writeErrorLog(...)` 記錄錯誤
        - **fallback**：`await hideHud()` → `await invoke("paste_text", { text: result.rawText })`
        - `isRecording.value = false`
        - `transitionTo("success", PASTE_SUCCESS_UNENHANCED_MESSAGE)`
    - **< 10 字**：維持現有直接貼上流程（不變）
  - [x]2.4 確保 `isRecording` 在所有新增的 exit path（AI 成功、AI fallback）都設為 false
  - [x]2.5 日誌記錄擴展：成功時 log `enhancementDurationMs`，fallback 時 log 原因

- [x] Task 3: 確認 HUD enhancing 狀態顯示正確 (AC: #6)
  - [x]3.1 確認 `NotchHud.vue` 的 `watch` 已處理 `'enhancing'` 狀態（line 139：`nextStatus === "transcribing" || nextStatus === "enhancing"` → 顯示 transcribing 動畫）— **預期不需修改**，因為現有程式碼已包含 enhancing case
  - [x]3.2 確認 `useVoiceFlowStore.transitionTo()` 已處理 `'enhancing'` 狀態（line 127-138：`nextStatus === "enhancing"` → `showHud()`）— **預期不需修改**，因為現有程式碼已包含 enhancing case
  - [x]3.3 若上述確認通過，此 Task 為驗證性質，不需程式碼修改

- [x] Task 4: 建立 enhancer.ts 單元測試 (AC: #1, #4, #5)
  - [x]4.1 建立 `tests/unit/enhancer.test.ts`
  - [x]4.2 Mock `@tauri-apps/plugin-http` 的 `fetch`
  - [x]4.3 測試正常流程：回傳整理後文字
  - [x]4.4 測試空 API Key：拋出錯誤
  - [x]4.5 測試 API 回應為空 choices：回傳原始文字
  - [x]4.6 測試 HTTP 非 200：拋出包含狀態碼的錯誤
  - [x]4.7 測試 timeout（5 秒）：拋出 AbortError 或逾時錯誤
  - [x]4.8 測試請求 body 格式正確（model、messages、temperature）

- [x] Task 5: 擴展 useVoiceFlowStore 單元測試 (AC: #2, #3, #4, #5)
  - [x]5.1 在 `tests/unit/use-voice-flow-store.test.ts` 新增測試案例
  - [x]5.2 Mock `enhanceText` from `lib/enhancer`
  - [x]5.3 測試 AI 整理正常流程（>= 10 字）：recording → transcribing → enhancing → paste enhanced text → success
  - [x]5.4 測試跳過 AI 整理（< 10 字）：recording → transcribing → paste raw text → success（無 enhancing 狀態）
  - [x]5.5 測試 AI timeout fallback：recording → transcribing → enhancing → catch → paste raw text → success（"已貼上（未整理）"）
  - [x]5.6 測試 AI API 錯誤 fallback：recording → transcribing → enhancing → catch → paste raw text → success（"已貼上（未整理）"）

- [x] Task 6: 整合驗證 (AC: #1-7)
  - [x]6.1 `pnpm exec vue-tsc --noEmit` 通過
  - [x]6.2 `pnpm test` 所有測試通過
  - [x]6.3 手動測試：說一段 >= 10 字的話 → HUD 顯示 recording → transcribing → enhancing（整理中...）→ success（已貼上 ✓）→ 文字出現在游標位置，且為書面語
  - [x]6.4 手動測試：說一段 < 10 字的短句 → HUD 顯示 recording → transcribing → success → 原始轉錄直接貼上，無 enhancing 階段
  - [x]6.5 手動測試：斷網時觸發 AI 整理 → enhancing 後自動 fallback，HUD 顯示「已貼上（未整理）」，原始文字貼入
  - [x]6.6 手動測試：端到端延遲（含 AI 整理）感知 < 3 秒
  - [x]6.7 手動測試：HUD 狀態轉換動畫流暢，enhancing 與 transcribing 視覺一致

## Dev Notes

### 架構模式與約束

**Brownfield 專案** — 基於 Story 1.1-1.5（V2 基礎架構、熱鍵系統、API Key 儲存、語音流程、HUD 狀態）繼續擴展。**注意**：Story 1.4 和 1.5 目前 `in-progress`，手動測試項尚未全部完成，但程式碼已可用。

**本 Story 的核心架構變更：** 新增 `enhancer.ts` 服務模組 + 擴展 `useVoiceFlowStore` 的 `handleStopRecording()` 加入 AI 整理分支。

**依賴方向規則（嚴格遵守）：**
```
views/ → components/ + stores/ + composables/
stores/ → lib/
lib/ → 外部 API（Groq）
composables/ → stores/ + lib/
```

**禁止：**
- ❌ views/ 直接呼叫 lib/（必須透過 store）
- ❌ API Key 存入 SQLite（只用 tauri-plugin-store）
- ❌ 在元件中直接執行 SQL
- ❌ Store 中引入 Vue lifecycle hooks（onMounted 等）

### enhancer.ts 設計

**HTTP Client：** 使用 `@tauri-apps/plugin-http` 的 `fetch`（與 `transcriber.ts` 一致）。不使用瀏覽器原生 fetch，因為 Tauri 的 CSP 限制下，需要透過 plugin 進行外部 API 呼叫。

**Groq LLM API 格式：**
```typescript
// POST https://api.groq.com/openai/v1/chat/completions
{
  model: "llama-3.3-70b-versatile",
  messages: [
    { role: "system", content: DEFAULT_SYSTEM_PROMPT },
    { role: "user", content: rawText }
  ],
  temperature: 0.3,
  max_tokens: 2048
}
```

**注意 model 選擇：** Groq 支援的模型會更新。`llama-3.3-70b-versatile` 是目前 Groq 上可用的高品質模型。若此模型不可用，替代選項為 `llama-3.1-70b-versatile` 或 `mixtral-8x7b-32768`。Story 2.2 會將 model 做成可配置項，本 Story 先硬編碼。

**預設 System Prompt：**
```typescript
const DEFAULT_SYSTEM_PROMPT = `你是一個繁體中文文字整理助手。請將以下口語轉錄文字整理為通順的書面語。

規則：
- 去除口語贅詞（嗯、那個、就是、然後、其實、基本上等）
- 修正標點符號
- 適當重組句構使文字通順
- 必要時適當分段
- 保持原始語意不變
- 不要添加原文沒有的資訊
- 直接輸出整理後的文字，不要加任何前綴說明`;
```

**Timeout 實作（AbortController）：**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), ENHANCEMENT_TIMEOUT_MS);

try {
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  // process response
} catch (error) {
  clearTimeout(timeoutId);
  if (error instanceof DOMException && error.name === "AbortError") {
    throw new Error("AI 整理逾時");
  }
  throw error;
}
```

**注意：** `@tauri-apps/plugin-http` 的 `fetch` 是否支援 `AbortController.signal` 需要實作時驗證。若不支援，替代方案是用 `Promise.race` 搭配 timeout Promise：

```typescript
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("AI 整理逾時")), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
```

### useVoiceFlowStore 修改策略

**現有 handleStopRecording() 流程（簡化版）：**
```
transcribeAudio() → result.rawText
  → if (!rawText) → error
  → hideHud() → paste_text(rawText) → success
```

**修改後流程：**
```
transcribeAudio() → result.rawText
  → if (!rawText) → error
  → if (rawText.length >= 10):
      → transitionTo("enhancing")
      → try: enhanceText(rawText, apiKey) → enhancedText
        → hideHud() → paste_text(enhancedText) → success
      → catch: (AI 失敗 fallback)
        → hideHud() → paste_text(rawText) → success("已貼上（未整理）")
  → else (< 10 字):
      → hideHud() → paste_text(rawText) → success (維持現有行為)
```

**關鍵：AI 整理失敗永遠 fallback 到原始文字。** AI 整理是增值功能，失敗不應阻塞核心語音輸入流程。這是架構文件的設計決策（NFR13：LLM API timeout 降級）。

**isRecording 鎖定注意：** 新增的 AI 整理分支中，`isRecording` 必須在 AI 成功和 AI fallback 兩個路徑都設為 `false`。這延續 Story 1.4 的 race condition 防護模式。

### NotchHud.vue 已支援 enhancing

**現有程式碼確認（不需修改）：**

`NotchHud.vue` line 139：
```typescript
if (nextStatus === "transcribing" || nextStatus === "enhancing") {
  // → 顯示 transcribing 動畫（dots sliding window）
}
```

`useVoiceFlowStore.ts` line 127-131：
```typescript
if (
  nextStatus === "recording" ||
  nextStatus === "transcribing" ||
  nextStatus === "enhancing"
) {
  showHud();
}
```

`HudStatus` type（`types/index.ts`）已包含 `'enhancing'`。

因此 **HUD 的 enhancing 顯示已預先實作完成**。本 Story 只需在 store 中正確 `transitionTo("enhancing")`，HUD 會自動以 transcribing 相同的動畫顯示。

### Groq API 呼叫模式（與 transcriber.ts 對比）

| 項目 | transcriber.ts（Whisper） | enhancer.ts（LLM） |
|------|--------------------------|-------------------|
| Endpoint | `/audio/transcriptions` | `/chat/completions` |
| Method | POST multipart/form-data | POST JSON |
| Model | `whisper-large-v3` | `llama-3.3-70b-versatile` |
| Content-Type | auto（FormData） | `application/json` |
| Timeout | 無特殊限制 | 5 秒（AbortController） |
| 失敗策略 | 顯示錯誤，使用者重試 | fallback 至原始文字 |
| HTTP Client | `@tauri-apps/plugin-http` fetch | `@tauri-apps/plugin-http` fetch |

### 測試策略

**enhancer.test.ts：** 單獨測試 enhancer.ts 模組，mock `@tauri-apps/plugin-http` 的 fetch。

**use-voice-flow-store.test.ts：** 擴展現有測試，mock enhancer.ts 的 `enhanceText`。測試字數門檻分支邏輯和 fallback 行為。

**Mock 模式（延續現有專案慣例）：**
```typescript
vi.mock("../lib/enhancer", () => ({
  enhanceText: vi.fn(),
}));
```

### 跨 Story 注意事項

- **Story 2.2** 會將 `DEFAULT_SYSTEM_PROMPT` 改為可透過 `useSettingsStore` 配置。本 Story 先硬編碼預設 prompt，設計上預留 `systemPrompt` 參數：`enhanceText(rawText, apiKey, systemPrompt?)` — 但 Story 2.1 scope 不做 optional 參數，直接用預設值。
- **Story 2.2** 會加入剪貼簿內容和詞彙清單的上下文注入。本 Story 的 enhancer.ts 只傳 rawText，不做上下文注入。
- **Story 4.1** 會在 success 後寫入歷史記錄。本 Story 的 store 修改需要記錄 `enhancementDurationMs` 供後續使用，但不在本 Story 寫入 DB。可在 log 中記錄此值。
- **Story 1.4/1.5** 目前 in-progress，部分手動測試未完成。本 Story 基於 1.4 的程式碼結構繼續擴展。

### 前一個 Story (1.4) 關鍵學習

- `handleStopRecording()` 的時序：`transitionTo("idle")` 或 `hideHud()` 先執行，讓目標應用獲得焦點，然後 `paste_text` 貼上
- `isRecording` 作為非同步流程鎖，只在每個 exit path 才釋放
- 錯誤處理模式：Service 層拋出有意義的錯誤 → Store 層 catch + 降級 + 使用者提示
- `@tauri-apps/plugin-http` 的 fetch 用法與瀏覽器原生 fetch 類似，但透過 Tauri 發送
- `writeInfoLog` / `writeErrorLog` 用於關鍵節點的 debug 日誌

### 現有檔案改動點

**新增檔案：**
```
src/lib/enhancer.ts              — Groq LLM AI 文字整理服務模組
tests/unit/enhancer.test.ts      — enhancer.ts 單元測試
```

**修改檔案：**
```
src/stores/useVoiceFlowStore.ts  — handleStopRecording() 加入 AI 整理分支
src/lib/errorUtils.ts            — 新增 getEnhancementErrorMessage()
tests/unit/use-voice-flow-store.test.ts — 新增 AI 整理相關測試案例
```

**不修改的檔案（明確排除）：**
- `src/components/NotchHud.vue` — 已支援 enhancing 狀態，不需修改
- `src/types/index.ts` — `HudStatus` 已包含 `'enhancing'`
- `src/types/events.ts` — `VoiceFlowStateChangedPayload` 已支援所有狀態
- `src/lib/transcriber.ts` — 轉錄邏輯不變
- `src/lib/recorder.ts` — 錄音邏輯不變
- `src/composables/useTauriEvents.ts` — 事件常數不變
- `src/stores/useSettingsStore.ts` — 設定 store 不變
- `src/App.vue` — HUD 入口不變
- `Cargo.toml` / `package.json` — 不需新增依賴

### 不需要的 Cargo/NPM 依賴變更

本 Story **不需要安裝任何新依賴**。`@tauri-apps/plugin-http` 已在 Story 1.1 安裝。所有需要的技術已在 Story 1.1-1.3 安裝完畢。

### 安全規則提醒

- API Key 從 `useSettingsStore().getApiKey()` 取得，不硬編碼
- API Key 不寫入任何日誌（`console.log` / `writeInfoLog` 不印 Key 值）
- API Key 不透過 Tauri Event 傳播
- CSP `connect-src 'self' https://api.groq.com` 限制 API Key 只能傳到 Groq
- AI 整理的 user message 內容不寫入日誌（可能包含敏感口述內容）

### 效能注意事項

- **E2E 目標（含 AI 整理）** — < 3 秒（從放開按鍵到文字出現在游標位置）
- **AI 整理 timeout** — 5 秒硬限制，超時 fallback 至原始文字
- **Groq LLM 延遲** — 通常 500ms-1500ms（依文字長度和模型負載）
- **HUD 狀態轉換** — < 100ms（Tauri Events 驅動）
- **剪貼簿操作延遲** — paste_text 內部有 200ms + 50ms 等待（總計 250ms）

### Git 歷史分析

**最近 commit 模式：**
- `feat:` 前綴用於功能實作
- `fix:` 前綴用於 code review 後修復
- `docs:` 前綴用於 BMAD artifacts 更新

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2 — Story 2.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns — 前端直接呼叫 Groq API]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns — Process Patterns 錯誤處理]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries — lib/ enhancer.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Integration Points — 核心語音流程（enhancer.ts 位置）]
- [Source: _bmad-output/planning-artifacts/prd.md#AI 文字整理 FR8-FR9, FR29]
- [Source: _bmad-output/planning-artifacts/prd.md#Performance NFR1, NFR3]
- [Source: _bmad-output/implementation-artifacts/1-4-voice-record-transcribe-paste.md — useVoiceFlowStore 完整實作]
- [Source: Codebase — src/stores/useVoiceFlowStore.ts（擴展目標）]
- [Source: Codebase — src/lib/transcriber.ts（API 呼叫模式參考）]
- [Source: Codebase — src/lib/errorUtils.ts（錯誤處理模式參考）]
- [Source: Codebase — src/components/NotchHud.vue（enhancing 狀態已支援確認）]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- vue-tsc: 無新增錯誤
- pnpm test: 94 tests passed

### Completion Notes List

- enhancer.ts 建立完成（enhanceText + buildSystemPrompt + withTimeout）
- useVoiceFlowStore AI 整理分支（10 字門檻、5 秒 timeout、fallback）
- HUD enhancing 狀態顯示確認正常
- errorUtils 新增 getEnhancementErrorMessage

### Change Log

- Story 2.1 完整實作 — Groq LLM AI 文字整理核心流程

### File List

- src/lib/enhancer.ts (new)
- src/lib/errorUtils.ts
- src/stores/useVoiceFlowStore.ts
- tests/unit/enhancer.test.ts (new)
- tests/unit/use-voice-flow-store.test.ts
