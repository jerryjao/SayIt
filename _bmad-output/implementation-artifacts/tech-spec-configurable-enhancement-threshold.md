---
title: '可設定 AI 整理字元門檻'
slug: 'configurable-enhancement-threshold'
created: '2026-03-03'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Vue 3 Composition API', 'Pinia Setup Store', 'tauri-plugin-store', 'TypeScript strict', 'Tailwind CSS v4']
files_to_modify: ['src/types/settings.ts', 'src/stores/useSettingsStore.ts', 'src/stores/useVoiceFlowStore.ts', 'src/views/SettingsView.vue', 'tests/unit/use-voice-flow-store.test.ts']
code_patterns: ['Setup Store ref+computed+function', 'tauri-plugin-store load/get/set/save', 'useFeedbackMessage composable', 'toggle switch button+span pattern']
test_patterns: ['tests/unit/use-voice-flow-store.test.ts (must update threshold test)']
---

# Tech-Spec: 可設定 AI 整理字元門檻

**Created:** 2026-03-03

## Overview

### Problem Statement

目前 AI 整理的字元門檻（轉錄文字 < 10 字元時跳過 AI 整理）硬編碼在 `useVoiceFlowStore.ts` 中的 `ENHANCEMENT_CHAR_THRESHOLD = 10`。使用者無法自訂此行為——有些人希望每次都跑 AI 整理（不論長短），有些人希望調整門檻字數。

### Solution

在設定頁「AI 整理 Prompt」section 內新增兩個控制項：
1. **啟用/停用開關** — 是否啟用字元門檻（停用 = 任何長度都跑 AI 整理）
2. **門檻字數輸入** — 啟用時，低於此字數的轉錄文字跳過二次處理，直接貼上原文

### Scope

**In Scope:**
- `useSettingsStore` 新增兩個設定值：`isEnhancementThresholdEnabled`、`enhancementThresholdCharCount`
- `SettingsView.vue`「AI 整理 Prompt」section 加入開關 + 數字輸入 UI
- `useVoiceFlowStore` 從 settings store 讀取設定，取代硬編碼常數
- `tauri-plugin-store` 持久化設定
- `settings.ts` 型別更新

**Out of Scope:**
- Rust 端不需改動
- AI Prompt 邏輯本身不變
- 不涉及 HUD 顯示變更
- 不做跨視窗即時同步（設定變更需重啟 App 才在 HUD 生效）

## Context for Development

### Codebase Patterns

- **Settings Store 結構** — Pinia Setup Store 語法（`defineStore('settings', () => { ... })`），每個設定項為獨立 `ref()`，搭配 `loadSettings()` 統一載入 + 專屬 `saveXxx()` action
- **持久化模式** — `tauri-plugin-store`：`const store = await load(STORE_NAME)` → `store.get<T>(key)` 讀取 → `store.set(key, value)` + `store.save()` 寫入
- **載入 fallback** — `loadSettings()` 中使用 `savedValue ?? defaultValue` 模式，確保首次啟動有合理預設
- **跨視窗同步** — 此功能不做跨視窗同步。HUD 視窗的 `loadSettings()` 有 `isLoaded` guard 只跑一次，Dashboard 改門檻後 HUD 不會即時感知，需重啟 App。這是已確認的限制。不需呼叫 `emitEvent(SETTINGS_UPDATED)`
- **UI Feedback** — `useFeedbackMessage()` composable 提供 `show(type, message)` + `clearTimer()` 模式
- **Toggle Switch UI** — SettingsView「開機自啟動」toggle（「應用程式」section 內的 `<button>` + `<span>` 圓球滑動模式）：`:class` 綁定 boolean state，可直接複用此 HTML 結構
- **VoiceFlowStore 取用 settings** — 在 store 內部 `const settingsStore = useSettingsStore()` 直接引用

### Files to Reference

| File | Purpose | 定位方式 |
| ---- | ------- | ------- |
| `src/types/settings.ts` | 設定型別，在 `SettingsDto` 介面中新增兩個欄位 | 搜尋 `interface SettingsDto` |
| `src/stores/useSettingsStore.ts` | 新增門檻 state（ref）、在 `loadSettings()` 中載入、新增 `saveEnhancementThreshold()` action | 搜尋 `async function loadSettings()` 和 `return {` |
| `src/stores/useVoiceFlowStore.ts` | 移除 `ENHANCEMENT_CHAR_THRESHOLD` 常數，改從 settings store 讀取 | 搜尋 `ENHANCEMENT_CHAR_THRESHOLD` |
| `src/views/SettingsView.vue` | 在「AI 整理 Prompt」section 的 `</section>` 結束標籤前加入門檻 UI | 搜尋 `AI 整理 Prompt` 所在的 `<section>`，在其 prompt feedback `</transition>` 之後、`</section>` 之前插入 |
| `tests/unit/use-voice-flow-store.test.ts` | 更新門檻相關測試，mock settings store 的新欄位 | 搜尋 `< 10 字應跳過` 或 `ENHANCEMENT_CHAR_THRESHOLD` |

### Technical Decisions

- **Store keys** — `enhancementThresholdEnabled`（boolean）、`enhancementThresholdCharCount`（number），存在 `tauri-plugin-store`（`settings.json`）
- **預設常數** — 在 `useSettingsStore.ts` 頂部提取為具名常數：`DEFAULT_ENHANCEMENT_THRESHOLD_ENABLED = true`、`DEFAULT_ENHANCEMENT_THRESHOLD_CHAR_COUNT = 10`，向後相容現有行為
- **停用門檻** — 任何長度都跑 AI 整理，不設最低安全值
- **門檻字數輸入驗證** — `<input type="number">`，save 時驗證：若值不是正整數（NaN、小數、負數、0）則 fallback 到 `DEFAULT_ENHANCEMENT_THRESHOLD_CHAR_COUNT`（10）。避免 NaN 導致 `length >= NaN` 恆為 `false` 的功能性 bug
- **判斷邏輯（`>=` 語意）** — `useVoiceFlowStore` 移除 `ENHANCEMENT_CHAR_THRESHOLD` 常數，改為：`if (!settingsStore.isEnhancementThresholdEnabled || rawText.length >= settingsStore.enhancementThresholdCharCount)` → 走 AI 整理。亦即：門檻停用 → 永遠走 AI 整理；門檻啟用 → 字數 >= 門檻才走 AI 整理（字數嚴格小於門檻才跳過）
- **不做跨視窗同步** — 門檻設定變更需重啟 App 才在 HUD 生效（`loadSettings()` 有 `isLoaded` guard 只執行一次）。這是已確認的限制，不呼叫 `emitEvent`
- **儲存時機** — toggle 和字數作為一組，透過 `saveEnhancementThreshold(enabled, charCount)` 一次儲存兩個值。UI 操作：toggle 切換時帶上當前 charCount 呼叫；數字輸入按儲存時帶上當前 enabled 呼叫
- **成功訊息** — 跳過 AI 整理時統一顯示「已貼上 ✓」（`PASTE_SUCCESS_MESSAGE`），與整理成功的訊息一致，不做區分
- **型別方案** — 直接在 `SettingsDto` 介面中新增兩個欄位，不另建介面

## Implementation Plan

### Tasks

- [ ] Task 1: 擴充設定型別定義
  - File: `src/types/settings.ts`
  - Action: 在 `SettingsDto` 介面中新增 `isEnhancementThresholdEnabled: boolean` 和 `enhancementThresholdCharCount: number` 兩個欄位
  - Notes: 這是其他檔案的型別基礎，必須先完成

- [ ] Task 2: Settings Store 新增門檻設定的 state 和 actions
  - File: `src/stores/useSettingsStore.ts`
  - Action:
    1. 在檔案頂部（store 定義外）新增具名常數：`const DEFAULT_ENHANCEMENT_THRESHOLD_ENABLED = true;` 和 `const DEFAULT_ENHANCEMENT_THRESHOLD_CHAR_COUNT = 10;` 並 export
    2. 在 store 內新增兩個 `ref()`：`isEnhancementThresholdEnabled`（預設 `DEFAULT_ENHANCEMENT_THRESHOLD_ENABLED`）、`enhancementThresholdCharCount`（預設 `DEFAULT_ENHANCEMENT_THRESHOLD_CHAR_COUNT`）
    3. 在 `loadSettings()` 中新增讀取邏輯：`store.get<boolean>('enhancementThresholdEnabled')` 和 `store.get<number>('enhancementThresholdCharCount')`，用 `?? DEFAULT_xxx` 提供預設值
    4. 新增 `saveEnhancementThreshold(enabled: boolean, charCount: number)` action：
       - 輸入驗證：`charCount` 若不是正整數（`!Number.isInteger(charCount) || charCount < 1`）則 fallback 到 `DEFAULT_ENHANCEMENT_THRESHOLD_CHAR_COUNT`
       - `store.set('enhancementThresholdEnabled', enabled)` + `store.set('enhancementThresholdCharCount', validatedCharCount)` + `store.save()`
       - 更新兩個 ref
       - 不呼叫 `emitEvent`（不做跨視窗同步）
    5. 在 return 物件中暴露新的 ref 和 action
  - Notes: 遵循現有 `loadSettings()` 中 `savedValue ?? defaultValue` 的 fallback 模式

- [ ] Task 3: VoiceFlowStore 移除硬編碼，改讀 settings store
  - File: `src/stores/useVoiceFlowStore.ts`
  - Action:
    1. 移除 `const ENHANCEMENT_CHAR_THRESHOLD = 10;`（搜尋此常數名稱定位）
    2. 修改判斷邏輯，從 `if (result.rawText.length >= ENHANCEMENT_CHAR_THRESHOLD)` 改為 `if (!settingsStore.isEnhancementThresholdEnabled || result.rawText.length >= settingsStore.enhancementThresholdCharCount)`
  - Notes: `settingsStore` 已在此 store 內部引用（現有程式碼），無需新增 import。邏輯：門檻停用 → 永遠走 AI 整理；門檻啟用 → 字數 >= 門檻才走 AI 整理

- [ ] Task 4: SettingsView 新增門檻設定 UI
  - File: `src/views/SettingsView.vue`
  - Action:
    1. 在 `<script setup>` 中新增：
       - `const thresholdEnabled = ref(false);` 和 `const thresholdCharCount = ref(10);`（local ref，`onMounted` 中從 store 初始化）
       - `const enhancementThresholdFeedback = useFeedbackMessage();`
       - `async function handleToggleEnhancementThreshold()`：翻轉 `thresholdEnabled`，呼叫 `settingsStore.saveEnhancementThreshold(thresholdEnabled.value, thresholdCharCount.value)`，顯示 feedback
       - `async function handleSaveThresholdCharCount()`：呼叫 `settingsStore.saveEnhancementThreshold(thresholdEnabled.value, thresholdCharCount.value)`，顯示 feedback
    2. 在 `onMounted` 中：`thresholdEnabled.value = settingsStore.isEnhancementThresholdEnabled;` 和 `thresholdCharCount.value = settingsStore.enhancementThresholdCharCount;`
    3. 在 `onBeforeUnmount` 中加入 `enhancementThresholdFeedback.clearTimer()`
    4. 在「AI 整理 Prompt」section 的 prompt feedback `</transition>` 之後、`</section>` 結束標籤之前，加入：
       - 分隔線 `<div class="mt-6 border-t border-zinc-700 pt-4">`
       - 小標題「短文字門檻」+ 說明文字：「啟用後，低於指定字數的轉錄文字將跳過 AI 整理，直接貼上原文。停用則每次都做 AI 整理。設定變更需重啟 App 生效。」
       - Toggle switch（複用「開機自啟動」的 `<button>` + `<span>` 圓球模式），`@click="handleToggleEnhancementThreshold"`
       - `v-if="thresholdEnabled"` 區塊：`<input type="number" v-model.number="thresholdCharCount">` + 儲存按鈕 `@click="handleSaveThresholdCharCount"`
       - Feedback 訊息區（複用 `feedback-fade` transition 模式）
  - Notes: 兩個 handler 都呼叫同一個 `saveEnhancementThreshold(enabled, charCount)`，確保兩個值永遠一起存。toggle 切換立即 save；數字輸入需按儲存按鈕

- [ ] Task 5: 更新現有門檻相關測試
  - File: `tests/unit/use-voice-flow-store.test.ts`
  - Action:
    1. 找到 `< 10 字應跳過 AI 整理` 相關測試
    2. 更新 mock：settings store 的 mock 需提供 `isEnhancementThresholdEnabled`（`true`）和 `enhancementThresholdCharCount`（`10`）
    3. 確保測試仍驗證相同行為：門檻啟用 + 10 字 → < 10 字跳過整理
    4. 考慮補充一條：門檻停用時短文字仍走 AI 整理
  - Notes: 搜尋 `< 10 字應跳過` 或 `ENHANCEMENT_CHAR_THRESHOLD` 定位測試。移除 `ENHANCEMENT_CHAR_THRESHOLD` 常數後，測試若有 import 該常數也需更新

### Acceptance Criteria

**Happy Path:**
- [ ] AC 1: Given 使用者首次升級（`settings.json` 無門檻設定），when 開啟設定頁，then 門檻開關為「啟用」、字數顯示 10（向後相容現有行為）
- [ ] AC 2: Given 門檻開關為「啟用」且字數設為 10，when 錄音轉錄結果為 5 個字，then 跳過 AI 整理直接貼上原文，顯示「已貼上 ✓」
- [ ] AC 3: Given 門檻開關為「啟用」且字數設為 10，when 錄音轉錄結果為 15 個字，then 正常執行 AI 整理
- [ ] AC 4: Given 門檻開關為「停用」，when 錄音轉錄結果為 3 個字，then 仍然執行 AI 整理
- [ ] AC 5: Given 使用者切換門檻開關，when toggle 被點擊，then 設定立即儲存到 `settings.json` 並顯示 feedback 訊息
- [ ] AC 6: Given 使用者修改門檻字數並點擊儲存，when 儲存成功，then 新值寫入 `settings.json` 並顯示 feedback 訊息
- [ ] AC 7: Given 門檻開關為「停用」，when 檢視設定頁 UI，then 門檻字數輸入框隱藏不顯示
- [ ] AC 8: Given 設定頁修改門檻後重啟 App，when 重新開啟設定頁，then 顯示上次儲存的門檻值（持久化正確）

**邊界與錯誤場景:**
- [ ] AC 9: Given 門檻字數設為 10，when 錄音轉錄結果剛好 10 個字，then 走 AI 整理（`>=` 語意）
- [ ] AC 10: Given 使用者清空門檻字數輸入框並點擊儲存，when save 執行，then 自動 fallback 到預設值 10 並顯示 feedback
- [ ] AC 11: Given 使用者輸入小數（如 3.7）或負數（如 -5）並點擊儲存，when save 執行，then 自動 fallback 到預設值 10 並顯示 feedback
- [ ] AC 12: Given 現有測試 `use-voice-flow-store.test.ts` 的門檻測試，when 執行 `pnpm test`，then 所有測試通過（不 break CI）

## Additional Context

### Dependencies

- 無新增外部依賴
- 無 Rust 端改動
- 無資料庫 schema 變更

### Testing Strategy

- 更新現有 `tests/unit/use-voice-flow-store.test.ts` 中的門檻測試，確保 CI 通過
- 手動驗證步驟：
  1. 開啟設定頁，確認門檻設定 UI 出現在 AI Prompt section 內
  2. 切換 toggle，確認 feedback 顯示且重啟後設定保留
  3. 門檻啟用 + 字數 10：錄一段短話（< 10 字）→ 確認直接貼上未整理
  4. 門檻停用：錄一段短話 → 確認仍走 AI 整理
  5. 修改門檻字數為 5 → 錄 7 個字 → 確認走 AI 整理
  6. 清空字數輸入並儲存 → 確認 fallback 到 10
  7. 執行 `pnpm test` 確認所有測試通過

### Notes

- 現有行為（< 10 字跳過 AI 整理）為預設值，首次升級使用者不會感受到差異
- 門檻設定變更需重啟 App 才在 HUD 生效（已確認的限制）
- `>=` 語意：門檻值 10 代表「10 字以上走 AI 整理，嚴格小於 10 字才跳過」
- 非法輸入（NaN、小數、負數、0）由 `saveEnhancementThreshold` 統一 fallback 到預設值 10
