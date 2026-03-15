---
title: 'ESC 全域中斷操作'
slug: 'esc-global-abort'
created: '2026-03-15'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Tauri v2', 'Rust (CGEventTap / WH_KEYBOARD_LL)', 'Vue 3 + Pinia', 'TypeScript']
files_to_modify: ['src-tauri/src/plugins/hotkey_listener.rs', 'src-tauri/src/lib.rs', 'src/stores/useVoiceFlowStore.ts', 'src/components/NotchHud.vue', 'src/types/index.ts', 'src/types/events.ts', 'src/composables/useTauriEvents.ts', 'src/stores/useSettingsStore.ts', 'src/i18n/locales/zh-TW.json', 'src/i18n/locales/en.json', 'src/i18n/locales/ja.json', 'src/i18n/locales/zh-CN.json', 'src/i18n/locales/ko.json']
code_patterns: ['Tauri event emit/listen pattern', 'CGEventTap KeyDown/KeyUp event handling', 'WH_KEYBOARD_LL hook_proc callback', 'VoiceFlow state machine (transitionTo)', 'AbortController/AbortSignal for HTTP cancellation', 'fire-and-forget async with void']
test_patterns: ['Rust inline #[cfg(test)] mod tests in hotkey_listener.rs', 'No frontend test files']
---

# Tech-Spec: ESC 全域中斷操作

**Created:** 2026-03-15

## Overview

### Problem Statement

使用者在 recording / transcribing / enhancing 任何階段都無法中途取消操作，必須等待操作完成或超時才能回到 idle 狀態，體驗不佳。特別是 transcribing 和 enhancing 階段的 Groq API 呼叫可能長達 5-30 秒，使用者被迫等待。

### Solution

在現有 hotkey listener（CGEventTap / WH_KEYBOARD_LL）中加入 ESC keycode 監聽，按下時發送 `escape:pressed` event。前端 VoiceFlow store 收到事件後根據當前狀態執行對應的中斷邏輯：停止錄音、放棄 API 回應、丟棄結果。HUD 顯示「已取消」視覺回饋後收起。

### Scope

**In Scope:**
- ESC 鍵監聽（macOS CGEventTap + Windows WH_KEYBOARD_LL）
- recording 階段中斷：停止錄音、丟棄錄音資料
- transcribing 階段中斷：放棄等待 Groq Whisper API 回應
- enhancing 階段中斷：放棄等待 Groq LLM API 回應
- HUD「已取消」視覺回饋（短暫顯示後收起）
- 還原系統音量（如果錄音時有靜音）

**Out of Scope:**
- ESC 鍵的自訂設定（固定為 ESC）
- 保留已取消的錄音檔供後續重試
- 中斷 quality monitor / correction monitor
- idle 或 success/error 狀態下的 ESC 行為

## Context for Development

### Codebase Patterns

- **Hotkey listener 架構**：`hotkey_listener.rs` 使用 CGEventTap（macOS）和 WH_KEYBOARD_LL（Windows）全域鍵盤監聽。事件回調中比對 keycode，符合時呼叫 `handle_key_event()` 並透過 `app_handle.emit()` 發送事件到前端。
- **VoiceFlow 狀態機**：`useVoiceFlowStore.ts` 透過 `transitionTo()` 管理狀態轉換（idle → recording → transcribing → enhancing → success/error → idle），每次轉換都 emit `voice-flow:state-changed` 事件。
- **Event 通訊**：所有 Rust → Frontend 事件常量定義在 `useTauriEvents.ts`，payload 型別定義在 `types/events.ts`。
- **非同步操作模式**：`handleStartRecording()` 和 `handleStopRecording()` 以 `void` fire-and-forget 啟動，無 await 阻斷。`handleStopRecording()` 是單一 async 函式，依序執行 stop_recording → transcribe_audio → enhanceText → paste_text。
- **AbortSignal 已就緒**：`enhancer.ts` 的 `enhanceText()` 已支援 `signal?: AbortSignal` 參數，`withTimeout()` 函式完整支援 abort 邏輯。AbortError 會被拋出並由呼叫方 catch。
- **Cancel token 模式**：`keyboard_monitor.rs` 使用 `Arc<AtomicBool>` 作為 cancel token 控制監測生命週期。

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src-tauri/src/plugins/hotkey_listener.rs` | 全域鍵盤監聽（ESC keycode 偵測插入點）|
| `src-tauri/src/lib.rs` | Tauri command 註冊（invoke_handler 列表）|
| `src/stores/useVoiceFlowStore.ts` | VoiceFlow 狀態機（abort 邏輯核心）|
| `src/components/NotchHud.vue` | HUD 視覺模式（新增 cancelled 視覺）|
| `src/types/index.ts` | `HudStatus` 型別定義 |
| `src/types/events.ts` | Event payload 型別定義 |
| `src/composables/useTauriEvents.ts` | Event 常量定義 |
| `src/lib/enhancer.ts` | `enhanceText()` — 已有 AbortSignal 支援（不需修改）|
| `src-tauri/src/plugins/keyboard_monitor.rs` | cancel_token 模式參考（不需修改）|

### Technical Decisions

1. **ESC 監聽方式**：擴充現有 `hotkey_listener.rs` 的 event tap/hook callback，在 `KeyDown` 事件中加入 ESC keycode 判斷（macOS: 53, Windows: VK_ESCAPE 0x1B）。共用同一個 listener，不新增 event tap。emit 獨立事件 `escape:pressed`，不經過 `handle_key_event()`（ESC 不是 trigger key，不影響 press/release 狀態）。注意：CGEventTap 為 `ListenOnly` 模式，callback return value 不影響事件傳遞；ESC 判斷為 true 時提前 `return None` 跳過後續 trigger key matching 邏輯，而非「消費」該事件。

2. **前端中斷策略（分階段）**：
   - **recording**：呼叫 `stop_recording` 停止錄音硬體 → 設 `isRecording = false` → 不進行後續轉錄
   - **transcribing**：設 `isAborted` flag + `isRecording = false` → 當 `transcribe_audio` invoke 回傳時檢查 flag → 丟棄結果（Rust 端 HTTP 請求無法取消，但結果被忽略）
   - **enhancing**：呼叫 `abortController.abort()` 中斷 `enhanceText()` 的 fetch 請求 + 設 `isRecording = false` → `withTimeout()` 拋出 AbortError → 由 `handleStopRecording` 的 catch 處理（但因 `isAborted` 為 true，不走 fallback 流程）
   - **關鍵**：`handleEscapeAbort()` 必須在所有狀態下無條件設定 `isRecording.value = false`，否則 `handleStartRecording()` 的 `if (isRecording.value) return;` guard 會永久阻止後續錄音。

3. **Hold 模式競態保護**：ESC 在 recording 狀態觸發 `handleEscapeAbort()`，但使用者鬆開 trigger key 時 `handleStopRecording()` 仍可能被觸發。解法：在 `handleStopRecording()` 開頭加入 `if (isAborted.value) return;` guard，確保已中斷的流程不會重複執行。

4. **Toggle 模式同步**：ESC 中斷後呼叫新增的 `reset_hotkey_state` command 重置 `is_toggled_on` / `is_pressed`，避免 toggle 模式下狀態不同步（需要多按一次才能重新開始）。

5. **HUD 視覺回饋**：新增 `"cancelled"` 到 `HudStatus` 型別。NotchHud 收到此狀態時顯示 X 圖示 + "已取消" 文字，使用淡灰色調，使用預設 notch shape（與其他模式一致）。顯示 1 秒後 collapse 收起（與 success 同時長）。

6. **Retry 流程保護**：`handleRetryTranscription()` 也需加入 `isAborted` 檢查，中斷邏輯與主流程一致。

7. **ESC 作為 Custom key 的衝突防護**：在設定介面禁止使用者選擇 ESC (macOS keycode 53 / Windows VK 0x1B) 作為 Custom trigger key，避免 ESC 中斷邏輯覆蓋 trigger key 功能。

8. **資源清理**：`handleEscapeAbort()` 必須清理所有進行中的資源：`stopMonitorPolling()`、`stopCorrectionSnapshotPolling()`、`cleanupCorrectionMonitorListener()`、`clearDelayedMuteTimer()`、`stopElapsedTimer()`、`restoreSystemAudio()`。

## Implementation Plan

### Tasks

- [x] **Task 1**：Rust — 新增 ESC keycode 常量
  - File: `src-tauri/src/plugins/hotkey_listener.rs`
  - Action: 在 `macos_keycodes` module 新增 `pub const ESCAPE: u16 = 53;`
  - Action: 在 `windows_hook` module 新增 `const VK_ESCAPE: u32 = 0x1B;`

- [x] **Task 2**：Rust — macOS CGEventTap 偵測 ESC
  - File: `src-tauri/src/plugins/hotkey_listener.rs`
  - Action: 在 `start_event_tap` closure 的 `CGEventType::KeyDown` arm 中，於現有 trigger key 判斷之前，加入 ESC keycode 檢查。若 keycode == `macos_keycodes::ESCAPE`（53），直接 emit `"escape:pressed"` 事件（空 payload），然後提前 `return None` 跳過後續 trigger key matching 邏輯。
  - Notes: ESC 只需偵測 KeyDown（按下即觸發），不需處理 KeyUp。不經過 `handle_key_event()`。CGEventTap 為 `ListenOnly` 模式，`return None` 不會消費事件，僅用於跳過後續程式碼。

- [x] **Task 3**：Rust — Windows hook_proc 偵測 ESC
  - File: `src-tauri/src/plugins/hotkey_listener.rs`
  - Action: 在 `hook_proc` 函式中，`is_key_down || is_key_up` 判斷區塊內，於 trigger key matching 之前，加入 ESC 判斷：若 `kbd.vkCode == VK_ESCAPE && is_key_down`，emit `"escape:pressed"` 事件。
  - Notes: 需要讓 `hook_proc` 能存取 `AppHandle`。目前 `HookContext` 只有 `trigger_key` 和 `key_handler`，需加入 `escape_handler: Box<dyn Fn() + Send + Sync>`（或直接存一個 Arc 的 AppHandle 到 static context）。

- [x] **Task 4**：Rust — 新增 `reset_hotkey_state` Tauri command
  - File: `src-tauri/src/plugins/hotkey_listener.rs`
  - Action: 新增公開函式（使用 `State` extractor，與 codebase 現有慣例一致）：
    ```rust
    #[tauri::command]
    pub fn reset_hotkey_state(state: tauri::State<'_, HotkeyListenerState>) {
        state.reset_key_states();
    }
    ```
  - File: `src-tauri/src/lib.rs`
  - Action: 在 `invoke_handler` 的 `generate_handler![]` 陣列中加入 `plugins::hotkey_listener::reset_hotkey_state`

- [x] **Task 5**：Frontend types — 新增 `"cancelled"` 到 HudStatus
  - File: `src/types/index.ts`
  - Action: 在 `HudStatus` union type 加入 `| "cancelled"`：
    ```typescript
    export type HudStatus =
      | "idle"
      | "recording"
      | "transcribing"
      | "enhancing"
      | "success"
      | "error"
      | "cancelled";
    ```

- [x] **Task 6**：Frontend events — 新增 ESCAPE_PRESSED 常量
  - File: `src/composables/useTauriEvents.ts`
  - Action: 新增 `export const ESCAPE_PRESSED = "escape:pressed" as const;`

- [x] **Task 7**：Frontend store — 實作 abort 邏輯（核心任務）
  - File: `src/stores/useVoiceFlowStore.ts`
  - Action 7a: 新增狀態變數
    ```typescript
    const isAborted = ref(false);
    let abortController: AbortController | null = null;
    ```
  - Action 7b: 新增 `handleEscapeAbort()` 函式
    ```typescript
    async function handleEscapeAbort() {
      const currentStatus = status.value;
      if (currentStatus === "idle" || currentStatus === "success" || currentStatus === "error" || currentStatus === "cancelled") return;

      writeInfoLog(`useVoiceFlowStore: ESC abort from ${currentStatus}`);
      isAborted.value = true;
      abortController?.abort();

      // 【F1 修正】無條件重置 isRecording，避免永久鎖死
      isRecording.value = false;

      if (currentStatus === "recording") {
        void invoke("stop_recording").catch(() => {});
        stopElapsedTimer();
      }

      // 【F7/F10 修正】完整清理所有進行中的資源
      clearDelayedMuteTimer();
      stopMonitorPolling();
      stopCorrectionSnapshotPolling();
      cleanupCorrectionMonitorListener();
      void restoreSystemAudio();

      // 重置 toggle 模式狀態
      void invoke("reset_hotkey_state").catch(() => {});

      transitionTo("cancelled", t("voiceFlow.cancelled"));
    }
    ```
  - Action 7c: 修改 `handleStartRecording()` — 在函式開頭（`isRecording.value = true` 之後）加入 abort 重置
    ```typescript
    isAborted.value = false;
    abortController = new AbortController();
    ```
  - Action 7d: 修改 `handleStopRecording()` — 加入 abort 保護
    - 【F2 修正】在函式開頭 `if (!isRecording.value) return;` 之後，加入第二道 guard：`if (isAborted.value) return;`（防止 Hold 模式 key release 在 ESC 中斷後重複觸發）
    - 在 `await invoke("stop_recording")` 之後：`if (isAborted.value) return;`
    - 在 `await invoke("transcribe_audio", ...)` 之後：`if (isAborted.value) return;`
    - 在 `enhanceText()` 呼叫中傳入 signal：`signal: abortController?.signal`
    - 在 enhancement 的 catch 區塊中：若 `isAborted.value` 為 true，直接 return 不走 fallback
  - Action 7e: 修改 `handleRetryTranscription()` — 同樣模式
    - 在函式開頭加入 abort 重置：`isAborted.value = false; abortController = new AbortController();`
    - 在 `await invoke("retranscribe_from_file", ...)` 之後：`if (isAborted.value) return;`
    - 在 retry 的 `enhanceText()` 呼叫中傳入 signal
    - 在 retry enhancement catch 中加入 abort 檢查
  - Action 7f: 修改 `transitionTo()` — 加入 `"cancelled"` 狀態處理
    ```typescript
    if (nextStatus === "cancelled") {
      showHud().catch(/* ... */);
      autoHideTimer = setTimeout(() => {
        transitionTo("idle");
      }, CANCELLED_DISPLAY_DURATION_MS); // 1000ms
      return;
    }
    ```
    新增常量：`const CANCELLED_DISPLAY_DURATION_MS = 1000;`
  - Action 7g: 修改 `initialize()` — 註冊 ESCAPE_PRESSED 事件監聽
    ```typescript
    listenToEvent(ESCAPE_PRESSED, () => {
      void handleEscapeAbort();
    }),
    ```
    加入 `Promise.all([...])` 陣列中。
  - Action 7h: 在 `return` 物件中不需要 export `handleEscapeAbort`（由事件驅動，不需外部呼叫）

- [x] **Task 8**：HUD — 新增 cancelled 視覺模式
  - File: `src/components/NotchHud.vue`
  - Action 8a: 在 `VisualMode` type 加入 `"cancelled"`
  - Action 8b: 在 status watcher 中新增 `"cancelled"` 分支。現有 watcher 使用 `if/return` 串聯結構，最後一個分支 (`"error"`) 沒有 `return`。在 error 分支的 `}` 之後加入 cancelled 分支（由於 error 的 if 條件不匹配 cancelled，會正確 fall through 到此）：
    ```typescript
    if (nextStatus === "cancelled") {
      stopWaveformAnimation();
      visualMode.value = "cancelled";
      return;
    }
    ```
  - Action 8c: 在 template 新增 cancelled 視覺元素（notch-left 區域）：
    - SVG X 圖示（18x18, stroke 色 `rgba(255, 255, 255, 0.6)`）
    - 右側顯示 "已取消" label（同色調）
  - Action 8d: 新增 CSS 樣式
    - `.cancelled-icon-svg`：fadeIn 動畫
    - `.cancelled-label`：`color: rgba(255, 255, 255, 0.6)`, `font-size: 14px`
  - Action 8e: 在 `isHighPriorityMode` computed 中加入 `mode === "cancelled"`
  - Action 8f: 在 `waveformElementClass` 的 switch 中不需新增 case（cancelled 不顯示 waveform）

- [x] **Task 9**：i18n — 新增取消訊息翻譯
  - File: `src/i18n/locales/zh-TW.json` → `"voiceFlow.cancelled": "已取消"`
  - File: `src/i18n/locales/en.json` → `"voiceFlow.cancelled": "Cancelled"`
  - File: `src/i18n/locales/ja.json` → `"voiceFlow.cancelled": "キャンセル"`
  - File: `src/i18n/locales/zh-CN.json` → `"voiceFlow.cancelled": "已取消"`
  - File: `src/i18n/locales/ko.json` → `"voiceFlow.cancelled": "취소됨"`

- [x] **Task 10**：Settings — 禁止 ESC 作為 Custom trigger key
  - File: `src/stores/useSettingsStore.ts`（或 Custom key 設定的驗證邏輯所在處）
  - Action: 在 Custom key 設定的驗證邏輯中，加入 ESC keycode 的黑名單檢查。若使用者嘗試設定 ESC（macOS keycode 53 / Windows VK 0x1B），顯示錯誤訊息並拒絕儲存。
  - Notes: ESC 已被保留為全域中斷鍵，不可用作 trigger key。需在對應的 i18n locale 檔案中加入錯誤訊息。

### Acceptance Criteria

- [x] **AC1**: Given 使用者正在 recording 狀態，when 按下 ESC 鍵，then 錄音立即停止，HUD 顯示「已取消」約 1 秒後收起，不執行轉錄。
- [x] **AC2**: Given 使用者正在 transcribing 狀態（Whisper API 呼叫中），when 按下 ESC 鍵，then HUD 立即切換為「已取消」，API 回傳結果被丟棄。
- [x] **AC3**: Given 使用者正在 enhancing 狀態（LLM API 呼叫中），when 按下 ESC 鍵，then fetch 請求被 abort，HUD 立即切換為「已取消」。
- [x] **AC4**: Given 使用者錄音時有啟用系統音量靜音功能，when 按下 ESC 中斷，then 系統音量在中斷後立即還原。
- [x] **AC5**: Given 使用者使用 Toggle 觸發模式，when 在 recording 狀態按下 ESC 中斷，then 下次按 trigger key 應直接開始新錄音（toggle 狀態已重置），不需要多按一次。
- [x] **AC6**: Given 使用者正在 idle / success / error 狀態，when 按下 ESC 鍵，then 不發生任何反應。
- [x] **AC7**: Given ESC 中斷後使用者再次按 trigger key，when 開始新的錄音流程，then 所有狀態（isAborted, abortController, isRecording）已正確重置，新流程正常運作。
- [x] **AC8**: Given 使用者在 retry transcription 流程中，when 按下 ESC 鍵，then 中斷行為與主流程一致（丟棄結果、顯示取消、重置狀態）。
- [x] **AC9**: Given macOS 和 Windows 平台，when 按下 ESC 鍵，then 兩平台行為一致。
- [x] **AC10**: Given 使用者在設定頁面選擇 Custom trigger key，when 嘗試設定 ESC（keycode 53 / 0x1B）作為 trigger key，then 顯示錯誤訊息並拒絕儲存。

## Additional Context

### Dependencies

- 無外部依賴變動。不需修改 `Cargo.toml` 或 `package.json`。
- ESC keycode 為固定值（macOS: 53, Windows: 0x1B），無平台版本依賴。
- `enhancer.ts` 的 `enhanceText()` 已定義 `signal?: AbortSignal` 參數但目前呼叫端尚未傳入。本 spec 在 Task 7d/7e 中將 signal 傳入，enhancer.ts 本身不需修改。

### Testing Strategy

**Rust 單元測試（inline in `hotkey_listener.rs`）：**
- 驗證 ESC keycode 常量值正確（macOS 53, Windows 0x1B）
- 驗證 `reset_key_states()` 呼叫後 `is_pressed` 和 `is_toggled_on` 均為 false

**Frontend 單元測試（Vitest，建議新增 `src/stores/__tests__/useVoiceFlowStore.abort.test.ts`）：**
- `handleEscapeAbort()` 在 recording 狀態下：驗證 `isRecording` 被重置、`isAborted` 被設置、status 轉為 cancelled
- `handleEscapeAbort()` 在 transcribing 狀態下：驗證 `isRecording` 被重置（即使之前為 true）
- `handleEscapeAbort()` 在 idle/success/error 狀態下：驗證不執行任何動作
- `handleStopRecording()` 在 `isAborted` 為 true 時：驗證提前 return，不執行 transcribe_audio
- `handleStartRecording()` 在 ESC 中斷後再次呼叫：驗證 `isAborted` 被重置為 false

**手動測試（必要）：**
1. macOS + Windows 雙平台驗證 ESC 偵測
2. Hold mode + Toggle mode 分別測試
3. 在 recording / transcribing / enhancing 三個狀態各按一次 ESC
4. 驗證 Toggle 模式 ESC 後可正常重新開始（不需多按一次）
5. 驗證系統音量還原
6. 驗證 HUD cancelled 視覺正確顯示並收起
7. 驗證 retry 流程中 ESC 正常運作
8. 驗證 idle/success/error 狀態按 ESC 無反應
9. **關鍵**：在 transcribing/enhancing 狀態按 ESC 後，立即按 trigger key 開始新錄音 → 驗證流程正常（F1 回歸）
10. 嘗試在設定頁面設定 ESC 為 Custom trigger key → 驗證被拒絕

### Notes

**高風險項目：**
- **Windows `hook_proc` 中 emit event**：目前 `HookContext` 的 `key_handler` 是 closure，ESC 處理需要一個獨立的 escape handler 或將 emit 邏輯嵌入現有架構。建議在 `HookContext` 新增 `escape_handler` 欄位，保持關注點分離。
- **Transcribing 中斷的資源浪費**：ESC 中斷不會取消 Rust 端的 HTTP 請求，Groq API 呼叫仍會完成。這是可接受的 trade-off（避免需要在 Rust 端加 cancellation token 的複雜度）。API 費用仍會產生。
- **快速連按 ESC + trigger key 的競態條件**：`isAborted` flag 在 `handleStartRecording()` 中被重置，但若 ESC 和 trigger key 幾乎同時按下，可能出現競態。由於事件是序列化處理（JavaScript 單執行緒），此風險極低。

**已知限制：**
- Rust 端 `transcribe_audio` 的 HTTP 請求無法真正取消，只能在前端忽略結果
- ESC 鍵固定不可自訂（符合 Scope 定義）
- Rust 端在任何狀態（包括 idle）都會對 ESC KeyDown emit 事件，前端在非活動狀態會忽略。對於 Vim 等頻繁使用 ESC 的使用者，每次按鍵會產生一次輕量 IPC 事件傳遞，效能影響可忽略（已決定接受此設計簡化）
