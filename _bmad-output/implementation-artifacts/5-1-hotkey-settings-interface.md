# Story 5.1: 快捷鍵設定介面

Status: done

## Story

As a 使用者,
I want 在設定頁面自訂觸發鍵和觸發模式,
so that 我能選擇最順手的按鍵組合來觸發語音輸入。

## Acceptance Criteria

1. **AC1: 觸發鍵下拉選單**
   - Given SettingsView.vue 的快捷鍵設定區塊
   - When 使用者開啟設定頁面
   - Then 顯示「觸發鍵」下拉選單，依當前平台顯示可選項
   - And macOS 可選：Fn、左 Option、右 Option、左 Control、右 Control、Command、Shift
   - And Windows 可選：右 Alt（預設）、左 Alt、Control、Shift
   - And 當前已選的觸發鍵為預設選中狀態

2. **AC2: 觸發模式切換**
   - Given 快捷鍵設定區塊
   - When 使用者開啟設定頁面
   - Then 顯示「觸發模式」切換控制項（Hold / Toggle）
   - And 當前模式為預設選中狀態
   - And 附帶簡短說明：Hold =「按住錄音，放開停止」/ Toggle =「按一下開始，再按停止」

3. **AC3: 觸發鍵變更即時生效**
   - Given 使用者變更觸發鍵
   - When 從下拉選單選擇新的觸發鍵
   - Then useSettingsStore 更新 hotkeyConfig 並持久化至 tauri-plugin-store
   - And 發送 `settings:updated` Tauri Event `{ key: 'hotkey', value: newConfig }`
   - And hotkey_listener.rs 接收事件後即時切換為新觸發鍵
   - And 無需重啟 App

4. **AC4: 觸發模式變更即時生效**
   - Given 使用者變更觸發模式
   - When 切換 Hold / Toggle
   - Then useSettingsStore 更新 triggerMode 並持久化至 tauri-plugin-store
   - And 發送 `settings:updated` Tauri Event `{ key: 'triggerMode', value: 'hold' | 'toggle' }`
   - And hotkey_listener.rs 即時切換模式
   - And 無需重啟 App

5. **AC5: 重啟後保持設定**
   - Given App 重新啟動
   - When hotkey_listener.rs 初始化
   - Then 從 tauri-plugin-store 讀取已儲存的觸發鍵和觸發模式
   - And 使用使用者上次設定的配置啟動
   - And 若無儲存設定，使用平台預設值（macOS: Fn + Hold / Windows: 右Alt + Hold）

## Tasks / Subtasks

- [x] Task 1: 新增快捷鍵設定 section 到 SettingsView.vue (AC: #1, #2)
  - [x] 1.1 新增快捷鍵設定 section（放在 API Key section 上方）
  - [x] 1.2 觸發鍵下拉選單：`<select>` 綁定 hotkeyConfig.triggerKey
  - [x] 1.3 依平台過濾可選項（isMac 判斷）
  - [x] 1.4 觸發模式切換：兩個 radio button 或 segmented control（Hold / Toggle）
  - [x] 1.5 模式說明文字：Hold =「按住錄音，放開停止」/ Toggle =「按一下開始，再按停止」

- [x] Task 2: 實作觸發鍵和觸發模式變更處理 (AC: #3, #4)
  - [x] 2.1 handleTriggerKeyChange：呼叫 settingsStore.saveHotkeyConfig(newKey, currentMode)
  - [x] 2.2 handleTriggerModeChange：呼叫 settingsStore.saveHotkeyConfig(currentKey, newMode)
  - [x] 2.3 變更後顯示回饋訊息（「快捷鍵已更新」）
  - [x] 2.4 錯誤處理：try/catch 顯示錯誤回饋

- [x] Task 3: 發送 settings:updated Tauri Event (AC: #3, #4)
  - [x] 3.1 在 useSettingsStore.saveHotkeyConfig() 成功後發送 SETTINGS_UPDATED 事件
  - [x] 3.2 payload: `{ key: 'hotkey', value: { triggerKey, triggerMode } }`
  - [x] 3.3 使用 emitEvent（廣播給所有視窗）

- [x] Task 4: 手動整合測試 (AC: #1-#5)
  - [x] 4.1 驗證觸發鍵選單正確顯示平台選項
  - [x] 4.2 驗證變更觸發鍵後立即生效（不需重啟）
  - [x] 4.3 驗證變更觸發模式後立即生效
  - [x] 4.4 驗證重啟 App 後設定保持
  - [x] 4.5 驗證預設值正確（macOS: Fn + Hold / Windows: 右Alt + Hold）

## Dev Notes

### 已完成的基礎設施分析

大部分底層功能已在先前 Stories（1.1、1.2）實作完成：

| 元件 | 現狀 | Story 5.1 需做的 |
|------|------|-------------------|
| `src/stores/useSettingsStore.ts` | **完整**：hotkeyConfig ref、saveHotkeyConfig()、loadSettings()、syncHotkeyConfigToRust() | 新增 SETTINGS_UPDATED 事件發送 |
| `src/types/settings.ts` | **完整**：TriggerKey union type、HotkeyConfig interface | 不需修改 |
| `src-tauri/src/lib.rs` | **完整**：update_hotkey_config Rust command | 不需修改 |
| `src-tauri/src/plugins/hotkey_listener.rs` | **完整**：HotkeyListenerState、trigger key/mode 即時切換 | 不需修改 |
| `src/views/SettingsView.vue` | 有 API Key section + AI Prompt section | **新增快捷鍵 section** |
| `src/composables/useTauriEvents.ts` | SETTINGS_UPDATED 常數已定義 | 不需修改 |
| `src/types/events.ts` | SettingsUpdatedPayload 已定義 | 不需修改 |

**結論**：此 Story 主要是 UI 工作 + 一行 Tauri Event 發送。Store 和 Rust 端已完成。

### useSettingsStore 現有 API

```typescript
// 已存在：
const hotkeyConfig = ref<HotkeyConfig | null>(null);
const triggerMode = computed<TriggerMode>(() => hotkeyConfig.value?.triggerMode ?? "hold");

async function saveHotkeyConfig(key: TriggerKey, mode: TriggerMode) {
  // 1. 持久化到 tauri-plugin-store
  // 2. 更新 hotkeyConfig ref
  // 3. syncHotkeyConfigToRust() — invoke Rust command 即時切換
}

async function loadSettings() {
  // startup 時載入：hotkey config + API Key + AI Prompt
}
```

**saveHotkeyConfig 已處理**：持久化 + 同步到 Rust。Story 5.1 只需在成功後額外發送 SETTINGS_UPDATED 事件。

### settings:updated 事件發送

在 `useSettingsStore.saveHotkeyConfig()` 末尾新增：

```typescript
import { emitEvent, SETTINGS_UPDATED } from '../composables/useTauriEvents';
import type { SettingsUpdatedPayload } from '../types/events';

// saveHotkeyConfig 成功後
const payload: SettingsUpdatedPayload = {
  key: 'hotkey',
  value: { triggerKey: key, triggerMode: mode },
};
await emitEvent(SETTINGS_UPDATED, payload);
```

**注意**：使用 `emitEvent`（廣播所有視窗），讓 HUD Window 也能收到設定變更通知。

### TriggerKey 平台選項

```typescript
// src/types/settings.ts 已定義
type TriggerKey = "fn" | "option" | "rightOption" | "command" | "rightAlt" | "leftAlt" | "control" | "rightControl" | "shift";

// 平台選項分組
const MAC_TRIGGER_KEY_OPTIONS: { value: TriggerKey; label: string }[] = [
  { value: "fn", label: "Fn" },
  { value: "option", label: "左 Option (⌥)" },
  { value: "rightOption", label: "右 Option (⌥)" },
  { value: "control", label: "左 Control (⌃)" },
  { value: "rightControl", label: "右 Control (⌃)" },
  { value: "command", label: "Command (⌘)" },
  { value: "shift", label: "Shift (⇧)" },
];

const WINDOWS_TRIGGER_KEY_OPTIONS: { value: TriggerKey; label: string }[] = [
  { value: "rightAlt", label: "右 Alt" },
  { value: "leftAlt", label: "左 Alt" },
  { value: "control", label: "Control" },
  { value: "shift", label: "Shift" },
];

const isMac = navigator.userAgent.includes("Mac");
const triggerKeyOptions = isMac ? MAC_TRIGGER_KEY_OPTIONS : WINDOWS_TRIGGER_KEY_OPTIONS;
```

### 觸發鍵下拉選單

```html
<select
  :value="settingsStore.hotkeyConfig?.triggerKey"
  class="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-white outline-none transition focus:border-blue-500"
  @change="handleTriggerKeyChange(($event.target as HTMLSelectElement).value as TriggerKey)"
>
  <option v-for="opt in triggerKeyOptions" :key="opt.value" :value="opt.value">
    {{ opt.label }}
  </option>
</select>
```

### 觸發模式切換

使用兩個 radio-style 按鈕（segmented control 風格）：

```html
<div class="flex gap-2">
  <button
    type="button"
    class="rounded-lg px-4 py-2 text-sm font-medium transition"
    :class="settingsStore.triggerMode === 'hold'
      ? 'bg-blue-600 text-white'
      : 'border border-zinc-600 text-zinc-300 hover:bg-zinc-800'"
    @click="handleTriggerModeChange('hold')"
  >
    Hold
  </button>
  <button
    type="button"
    class="rounded-lg px-4 py-2 text-sm font-medium transition"
    :class="settingsStore.triggerMode === 'toggle'
      ? 'bg-blue-600 text-white'
      : 'border border-zinc-600 text-zinc-300 hover:bg-zinc-800'"
    @click="handleTriggerModeChange('toggle')"
  >
    Toggle
  </button>
</div>
<p class="mt-2 text-sm text-zinc-400">
  {{ settingsStore.triggerMode === 'hold'
    ? '按住錄音，放開停止'
    : '按一下開始，再按停止' }}
</p>
```

### 事件處理函式

```typescript
async function handleTriggerKeyChange(newKey: TriggerKey) {
  const currentMode = settingsStore.triggerMode;
  try {
    await settingsStore.saveHotkeyConfig(newKey, currentMode);
    showHotkeyFeedback("success", "觸發鍵已更新");
  } catch (err) {
    showHotkeyFeedback("error", extractErrorMessage(err));
  }
}

async function handleTriggerModeChange(newMode: TriggerMode) {
  const currentKey = settingsStore.hotkeyConfig?.triggerKey ?? getDefaultTriggerKey();
  try {
    await settingsStore.saveHotkeyConfig(currentKey, newMode);
    showHotkeyFeedback("success", "觸發模式已更新");
  } catch (err) {
    showHotkeyFeedback("error", extractErrorMessage(err));
  }
}
```

### UI 佈局建議

快捷鍵 section 放在 API Key section 上方（快捷鍵是最常調整的設定）：

```
┌─ 設定 ──────────────────────────────────────────────┐
│                                                      │
│ ┌─ 快捷鍵設定 ─────────────────────────────────────┐ │
│ │ 觸發鍵    [下拉選單: Fn ▼]                        │ │
│ │ 觸發模式  [Hold] [Toggle]                         │ │
│ │           按住錄音，放開停止                        │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─ Groq API Key ──────────────────────── [已設定] ─┐ │
│ │ ...                                              │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─ AI 整理 Prompt ────────────────────────────────┐ │
│ │ ...                                              │ │
│ └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### AC5 重啟保持設定 — 已完成

`useSettingsStore.loadSettings()` 已在 `main-window.ts` 啟動時呼叫，會從 tauri-plugin-store 讀取儲存的 `hotkeyTriggerKey` 和 `hotkeyTriggerMode`，並透過 `syncHotkeyConfigToRust()` 同步到 Rust。**AC5 已由現有程式碼滿足，不需額外實作。**

### 不需修改的檔案

- `src/types/settings.ts` — TriggerKey、HotkeyConfig 已完整定義
- `src/types/events.ts` — SettingsUpdatedPayload 已定義
- `src/composables/useTauriEvents.ts` — SETTINGS_UPDATED 已定義
- `src-tauri/src/lib.rs` — update_hotkey_config command 已實作
- `src-tauri/src/plugins/hotkey_listener.rs` — 即時切換已實作
- `src/router.ts` — /settings 路由已註冊
- `src/MainApp.vue` — sidebar 已包含設定

### 需要修改的檔案清單

| 檔案 | 修改範圍 |
|------|---------|
| `src/views/SettingsView.vue` | 新增快捷鍵設定 section（觸發鍵下拉 + 觸發模式切換 + 回饋訊息） |
| `src/stores/useSettingsStore.ts` | saveHotkeyConfig() 末尾新增 SETTINGS_UPDATED 事件發送（1-2 行） |

### 跨 Story 備註

- **Story 5.2** 會在 SettingsView 新增「開機自啟動」開關 section
- saveHotkeyConfig 的 SETTINGS_UPDATED 事件目前無消費者（HUD Window 不需要反應快捷鍵變更，因為 Rust 端已直接處理）。但事件機制為未來擴展預留

### Project Structure Notes

- 不新增任何新檔案
- 所有修改在既有專案結構內
- SettingsView.vue 是 Main Window 設定頁面
- useSettingsStore 的修改極小（1-2 行事件發送）

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1] — AC 完整定義（lines 742-781）
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — Tauri Events 跨視窗同步
- [Source: _bmad-output/planning-artifacts/architecture.md#Security] — tauri-plugin-store 本地儲存
- [Source: src/stores/useSettingsStore.ts] — 完整：hotkeyConfig、saveHotkeyConfig、loadSettings、syncHotkeyConfigToRust
- [Source: src/types/settings.ts] — TriggerKey union type、HotkeyConfig interface
- [Source: src/types/events.ts] — SettingsUpdatedPayload
- [Source: src/composables/useTauriEvents.ts] — SETTINGS_UPDATED 常數
- [Source: src/views/SettingsView.vue] — 現有 API Key + AI Prompt sections（UI 參考）
- [Source: src-tauri/src/lib.rs] — update_hotkey_config Rust command（line 87）
- [Source: src-tauri/src/plugins/hotkey_listener.rs] — HotkeyListenerState 即時切換

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- vue-tsc: 無新增錯誤
- pnpm test: 182 tests passed (11 test files)

### Completion Notes List

- SettingsView.vue 新增快捷鍵設定 section，放在 API Key section 上方
- 觸發鍵下拉選單依平台顯示 macOS (Fn/左Option/右Option/左Control/右Control/Command/Shift) 或 Windows (右Alt/左Alt/Control/Shift) 選項
- 觸發模式 Hold/Toggle segmented button 含動態說明文字
- 回饋訊息使用獨立的 hotkeyFeedback state + 2.5s 自動消失 timer
- useSettingsStore.saveHotkeyConfig() 新增 SETTINGS_UPDATED 事件廣播（emitEvent）
- 已有 AC5（重啟保持設定）由既有 loadSettings() 滿足，無需額外實作
- 新增 tests/unit/use-settings-store.test.ts（16 個測試覆蓋 loadSettings、saveHotkeyConfig、saveApiKey、deleteApiKey、saveAiPrompt、resetAiPrompt）
- 測試重點：saveHotkeyConfig 的 SETTINGS_UPDATED 事件廣播、store 持久化、Rust sync、ref 更新、fallback 邏輯

### Change Log

| 檔案 | 修改範圍 |
|------|----------|
| `src/views/SettingsView.vue` | 新增快捷鍵設定 section（觸發鍵下拉 + Hold/Toggle 模式切換 + 回饋訊息 + onBeforeUnmount cleanup） |
| `src/stores/useSettingsStore.ts` | saveHotkeyConfig() 新增 SETTINGS_UPDATED 事件發送（+imports, +5 行） |
| `tests/unit/use-settings-store.test.ts` | 新增 16 個單元測試（loadSettings 5 + saveHotkeyConfig 5 + saveApiKey 2 + deleteApiKey 1 + saveAiPrompt 2 + resetAiPrompt 1） |

### Change Log

- 2026-03-03: 新增右側修飾鍵選項 — macOS 觸發鍵選單從 5 項擴展為 7 項（新增右 Option、右 Control），原有 Option/Control 標籤改為「左 Option」/「左 Control」

### File List

- src/views/SettingsView.vue
- src/stores/useSettingsStore.ts
- tests/unit/use-settings-store.test.ts (new)
