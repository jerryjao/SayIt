# Story 2.3: 貼上後品質監控

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 使用者,
I want 系統追蹤我是否修改了貼上的文字,
So that 我能透過統計數據了解 AI 整理的輸出品質趨勢。

## Acceptance Criteria

1. **keyboard_monitor.rs 模組建立** — 新增 `src-tauri/src/plugins/keyboard_monitor.rs` 模組，使用 OS-native API（macOS: CGEventTap / Windows: SetWindowsHookExW）監聽鍵盤事件。模組在收到啟動指令後開始監聽全域鍵盤事件，監聽時間窗口為 5 秒。

2. **Backspace/Delete 偵測** — 貼上後監聽期間（5 秒），若使用者按下 Backspace 或 Delete 鍵至少一次，判定此次輸出「被修改」（`wasModified = true`）。結果透過 Tauri Event `quality-monitor:result` 回傳前端，payload 為 `{ wasModified: boolean }`。

3. **5 秒無偵測自動結束** — 貼上後 5 秒內未偵測到 Backspace 或 Delete 鍵，判定此次輸出「未修改」（`wasModified = false`）。自動結束監聽並透過 Tauri Event 回傳結果。

4. **前端觸發與接收** — `useVoiceFlowStore` 在成功貼上文字後（`transitionTo("success")` 之後），透過 `invoke("start_quality_monitor")` 啟動 Rust 端的鍵盤監控。`useVoiceFlowStore` 監聽 `quality-monitor:result` 事件，收到 `wasModified` 結果後暫存於 store state，供後續歷史記錄儲存使用（Epic 4）。

5. **簡單版不做焦點判斷** — 監聽期間偵測到的 Backspace/Delete 不區分來源焦點窗口。使用者在其他應用程式按下的 Backspace/Delete 也會被記錄為 `wasModified = true`。此為簡單版設計，接受誤判，以避免增加焦點追蹤的複雜度。

6. **監聽不阻塞主流程** — 鍵盤監控在獨立執行緒/背景執行，不阻塞 App 主流程。使用者觸發下一次錄音時，若上一次的品質監控尚在進行，自動取消上一次監控並回傳當前已收集的結果。

7. **跨平台支援** — macOS 使用 CGEventTap（與 hotkey_listener.rs 相同的 OS-native API）。Windows 使用 SetWindowsHookExW（WH_KEYBOARD_LL hook，與 hotkey_listener.rs 相同模式）。兩個平台使用相同的 Tauri Command 介面和相同的 Tauri Event payload 格式。

## Tasks / Subtasks

- [x]Task 1: 建立 keyboard_monitor.rs 模組（macOS 實作）(AC: #1, #2, #3, #7)
  - [x]1.1 建立 `src-tauri/src/plugins/keyboard_monitor.rs`，定義模組結構：
    - `MONITOR_DURATION_MS: u64 = 5000` — 監聽時間窗口常數
    - `const BACKSPACE_KEYCODE: u16 = 51` — macOS Backspace keycode
    - `const DELETE_KEYCODE: u16 = 117` — macOS Delete (Forward Delete) keycode
  - [x]1.2 定義共享狀態結構 `KeyboardMonitorState`：
    - `is_monitoring: Arc<AtomicBool>` — 是否正在監聽
    - `was_modified: Arc<AtomicBool>` — 是否偵測到修改按鍵
    - `cancel_token: Arc<AtomicBool>` — 用於取消當前監控
  - [x]1.3 實作 macOS CGEventTap 監聽：
    - 建立新的 CGEventTap（ListenOnly mode）專門監聽 KeyDown 事件
    - 在 callback 中檢查 keycode 是否為 Backspace(51) 或 Delete(117)
    - 偵測到時設定 `was_modified = true`
    - 使用獨立執行緒的 CFRunLoop 運行 event tap
  - [x]1.4 實作 5 秒計時器邏輯：
    - 啟動監聽時同步啟動 5 秒倒數計時器（`std::thread::sleep` 或 timer）
    - 5 秒到期後停止 CGEventTap（`CFRunLoop::stop`）
    - 透過 `app_handle.emit("quality-monitor:result", payload)` 發送結果
  - [x]1.5 實作提前中斷邏輯：
    - 若 `cancel_token` 被設為 true，立即停止監聽
    - 回傳當前已收集的 `was_modified` 結果

- [x]Task 2: 建立 keyboard_monitor.rs 模組（Windows 實作）(AC: #1, #2, #3, #7)
  - [x]2.1 定義 Windows 鍵碼常數：
    - `const VK_BACK: u32 = 0x08` — Windows Backspace VK code
    - `const VK_DELETE: u32 = 0x2E` — Windows Delete VK code
  - [x]2.2 實作 Windows WH_KEYBOARD_LL hook 監聽：
    - 使用 `SetWindowsHookExW(WH_KEYBOARD_LL, ...)` 安裝全域鍵盤 hook
    - 在 hook callback 中檢查 `vkCode` 是否為 VK_BACK 或 VK_DELETE
    - 偵測到時設定 `was_modified = true`
    - 使用 `GetMessageW` loop 驅動 hook 回呼
  - [x]2.3 實作 5 秒計時器 + 提前中斷（與 macOS 同邏輯）：
    - 5 秒到期後 `UnhookWindowsHookEx` + `PostThreadMessageW(WM_QUIT)` 結束 message loop
    - 發送 Tauri Event 回傳結果

- [x]Task 3: 建立 Tauri Command 介面 (AC: #4, #6)
  - [x]3.1 實作 `#[tauri::command] fn start_quality_monitor(app: AppHandle)` command：
    - 若已有監控進行中（`is_monitoring == true`），先取消：設定 `cancel_token = true`，等待短暫時間確保上一輪結束
    - 重置狀態：`was_modified = false`, `is_monitoring = true`, `cancel_token = false`
    - 啟動新的監控執行緒（平台分支：macOS/Windows）
    - 立即回傳 `Ok(())`（非同步，不等待結果）
  - [x]3.2 在 `mod.rs` 中加入 `pub mod keyboard_monitor;`
  - [x]3.3 在 `lib.rs` 的 `invoke_handler` 中註冊 `start_quality_monitor` command
  - [x]3.4 在 `lib.rs` 的 `setup` 中初始化 `KeyboardMonitorState` 並 `app.manage(state)` 管理

- [x]Task 4: 前端整合 — useVoiceFlowStore 觸發與接收 (AC: #4, #6)
  - [x]4.1 在 `useTauriEvents.ts` 新增事件常數：
    - `export const QUALITY_MONITOR_RESULT = "quality-monitor:result" as const;`
  - [x]4.2 在 `types/events.ts` 新增 payload 型別：
    - `export interface QualityMonitorResultPayload { wasModified: boolean; }`
  - [x]4.3 在 `useVoiceFlowStore.ts` 新增狀態：
    - `const lastWasModified = ref<boolean | null>(null)` — 最近一次品質監控結果
  - [x]4.4 修改 `handleStopRecording()` 成功貼上後的邏輯：
    - 在 `transitionTo("success", ...)` 之後，呼叫 `void invoke("start_quality_monitor")`
    - 注意：使用 `void` 前綴（fire-and-forget），不 await，不阻塞成功狀態顯示
  - [x]4.5 在 `initialize()` 中新增監聽 `quality-monitor:result` 事件：
    - `listen<QualityMonitorResultPayload>(QUALITY_MONITOR_RESULT, (event) => { lastWasModified.value = event.payload.wasModified; })`
    - 將 unlisten 加入 `unlistenFunctions`
  - [x]4.6 匯出 `lastWasModified` 供後續 Story 4.1 使用
  - [x]4.7 在下一次錄音開始（`handleStartRecording`）時，重置 `lastWasModified.value = null`

- [x]Task 5: 測試驗證 (AC: #1-7)
  - [x]5.1 Rust 單元測試（`keyboard_monitor.rs` 內 `#[cfg(test)] mod tests`）：
    - 測試 `KeyboardMonitorState` 初始值（`is_monitoring = false`, `was_modified = false`）
    - 測試狀態重置邏輯
    - 測試 `cancel_token` 設定後 `is_monitoring` 轉為 false
    - 注意：CGEventTap / Windows Hook 的實際鍵盤監聽不易在 CI 中測試，改以手動驗證
  - [x]5.2 前端測試擴展（`tests/unit/use-voice-flow-store.test.ts`）：
    - Mock `invoke("start_quality_monitor")` 確認貼上成功後被呼叫
    - Mock `listen("quality-monitor:result")` 確認 `lastWasModified` 正確更新
    - 測試下一次錄音開始時 `lastWasModified` 被重置為 null
  - [x]5.3 `pnpm exec vue-tsc --noEmit` 通過
  - [x]5.4 `cargo test` 通過（Rust 端）
  - [x]5.5 手動測試：語音輸入 → 成功貼上 → 5 秒內按 Backspace → console log 顯示 `wasModified: true`
  - [x]5.6 手動測試：語音輸入 → 成功貼上 → 5 秒內不按任何鍵 → console log 顯示 `wasModified: false`
  - [x]5.7 手動測試：連續兩次語音輸入，第二次啟動時第一次監控被正確取消
  - [x]5.8 手動測試：語音輸入貼上失敗（error 狀態）時不啟動品質監控

## Dev Notes

### 架構模式與約束

**Brownfield 專案** — 基於 Story 2.1-2.2（AI 文字整理 + prompt 自訂）繼續擴展。本 Story 是 Epic 2 的最後一個 Story，新增純 Rust 端模組 + 前端事件接收整合。

**本 Story 的核心架構變更：**
1. 新增 `keyboard_monitor.rs` Rust plugin 模組（OS-native 鍵盤監聽）
2. 新增 Tauri Command `start_quality_monitor`
3. 新增 Tauri Event `quality-monitor:result`
4. `useVoiceFlowStore` 擴展觸發/接收品質監控

**依賴方向規則（嚴格遵守）：**
```
Rust keyboard_monitor.rs → Tauri Event → 前端 store 接收
前端 store → invoke("start_quality_monitor") → Rust command
```

**禁止：**
- 前端不做鍵盤監聽（Web API 無法監聽全域鍵盤）
- 不做焦點判斷（簡單版設計決策，接受誤判）
- 不阻塞語音輸入主流程

### keyboard_monitor.rs 設計

**與 hotkey_listener.rs 的關係：**

keyboard_monitor.rs 和 hotkey_listener.rs 都使用 OS-native 鍵盤 API，但職責完全不同：

| 項目 | hotkey_listener.rs | keyboard_monitor.rs |
|------|-------------------|-------------------|
| 用途 | 監聽觸發鍵（modifier keys） | 監聽 Backspace/Delete |
| 生命週期 | App 生命週期常駐 | 按需啟動，5 秒後結束 |
| 事件類型 | FlagsChanged（modifier） | KeyDown（一般鍵） |
| 執行模式 | Plugin setup 時啟動 | Tauri Command 觸發 |
| 結果通知 | 即時 emit 事件 | 5 秒後 emit 彙總結果 |

**不共用 event tap/hook 的原因：** hotkey_listener 的 event tap 在 App 啟動時建立且永遠執行。keyboard_monitor 需要按需啟動/停止的短期監聽。兩者混用會增加狀態管理複雜度。獨立模組更清晰。

**macOS CGEventTap 實作策略：**

```rust
// keyboard_monitor.rs — macOS 實作概要

use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
use core_graphics::event::{
    CGEventTap, CGEventTapLocation, CGEventTapOptions,
    CGEventTapPlacement, CGEventType,
};

const BACKSPACE_KEYCODE: u16 = 51;
const DELETE_KEYCODE: u16 = 117;
const MONITOR_DURATION_SECS: u64 = 5;

fn start_monitoring_macos(
    app_handle: AppHandle<impl Runtime>,
    state: KeyboardMonitorState,
) {
    std::thread::spawn(move || {
        let was_modified = state.was_modified.clone();
        let cancel_token = state.cancel_token.clone();
        let is_monitoring = state.is_monitoring.clone();

        // 建立專用 CGEventTap（僅監聽 KeyDown）
        let tap = CGEventTap::new(
            CGEventTapLocation::Session,
            CGEventTapPlacement::HeadInsertEventTap,
            CGEventTapOptions::ListenOnly,
            vec![CGEventType::KeyDown],
            move |_proxy, _event_type, event| {
                let keycode = event.get_integer_value_field(
                    core_graphics::event::EventField::KEYBOARD_EVENT_KEYCODE,
                ) as u16;

                if keycode == BACKSPACE_KEYCODE || keycode == DELETE_KEYCODE {
                    was_modified.store(true, Ordering::SeqCst);
                }
                None
            },
        );

        // 啟動 RunLoop + 5 秒計時器
        // 使用另一個執行緒做計時，到期後停止 RunLoop
        // ...

        // 發送結果
        let result = state.was_modified.load(Ordering::SeqCst);
        is_monitoring.store(false, Ordering::SeqCst);
        let _ = app_handle.emit("quality-monitor:result", serde_json::json!({
            "wasModified": result
        }));
    });
}
```

**macOS 權限注意：** CGEventTap 需要 Accessibility 權限。hotkey_listener.rs 已在 App 啟動時檢查並引導授權。keyboard_monitor.rs 可以重用相同的權限（一旦 App 獲得 Accessibility 權限，所有 CGEventTap 都可用）。若權限未授予，CGEventTap 建立會失敗，應靜默處理（不阻塞主流程，直接回傳 wasModified = null/false）。

**Windows WH_KEYBOARD_LL 實作策略：**

```rust
// keyboard_monitor.rs — Windows 實作概要

const VK_BACK: u32 = 0x08;
const VK_DELETE: u32 = 0x2E;

fn start_monitoring_windows(
    app_handle: AppHandle<impl Runtime>,
    state: KeyboardMonitorState,
) {
    std::thread::spawn(move || {
        // 安裝 WH_KEYBOARD_LL hook
        // hook callback 中檢查 vkCode == VK_BACK || VK_DELETE
        // 偵測到時設定 was_modified = true

        // 5 秒計時器（另一個執行緒 sleep 5 秒後 PostThreadMessageW(WM_QUIT)）
        // message loop 結束後 UnhookWindowsHookEx

        // 發送結果
    });
}
```

**Windows hook 注意：** `SetWindowsHookExW` 的 hook 會在一個新執行緒的 message loop 中運行。與 hotkey_listener 的 hook 是獨立的（不同執行緒、不同 hook handle）。hook callback 使用 `OnceLock` 或 thread-local 共享狀態。

### 5 秒計時器 + 提前中斷設計

```
start_quality_monitor() 被呼叫
    │
    ├── 若已有監控進行中：
    │   ├── 設定 cancel_token = true
    │   ├── 短暫等待（50ms）確保上一輪清理
    │   └── 繼續新一輪
    │
    ├── 重置狀態
    │   ├── was_modified = false
    │   ├── is_monitoring = true
    │   └── cancel_token = false
    │
    ├── 啟動監聽執行緒（macOS/Windows 分支）
    │   ├── CGEventTap / WH_KEYBOARD_LL hook 安裝
    │   └── RunLoop / Message Loop 開始
    │
    └── 啟動計時器執行緒
        ├── sleep(5 秒) 或 定期檢查 cancel_token
        ├── 到期 → 停止監聽
        │   ├── macOS: CFRunLoop::stop()
        │   └── Windows: PostThreadMessageW(WM_QUIT)
        └── 發送 Tauri Event 回傳結果
```

**cancel_token 檢查頻率：** 計時器不使用 `thread::sleep(5000ms)` 一次性等待（無法中斷）。改用 loop + `sleep(100ms)` 分段等待，每 100ms 檢查一次 `cancel_token`。50 次迭代 = 5 秒。

```rust
fn wait_with_cancellation(
    cancel_token: &Arc<AtomicBool>,
    duration_ms: u64,
    check_interval_ms: u64,
) -> bool {
    let iterations = duration_ms / check_interval_ms;
    for _ in 0..iterations {
        if cancel_token.load(Ordering::SeqCst) {
            return true; // 被取消
        }
        std::thread::sleep(Duration::from_millis(check_interval_ms));
    }
    false // 正常到期
}
```

### Tauri Event Payload 格式

**Event name:** `quality-monitor:result`（遵循 `{domain}:{action}` kebab-case 規範）

**Payload：**
```json
{ "wasModified": true }
```

或

```json
{ "wasModified": false }
```

**前端接收：**
```typescript
listen<QualityMonitorResultPayload>(
  QUALITY_MONITOR_RESULT,
  (event) => {
    lastWasModified.value = event.payload.wasModified;
    writeInfoLog(
      `useVoiceFlowStore: quality monitor result: wasModified=${event.payload.wasModified}`
    );
  }
);
```

### useVoiceFlowStore 修改策略

**現有 handleStopRecording() 成功路徑（AI 整理分支）：**
```
enhanceText() → enhancedText
  → hideHud()
  → invoke("paste_text", { text: enhancedText })
  → isRecording = false
  → transitionTo("success", PASTE_SUCCESS_MESSAGE)
```

**修改後：**
```
enhanceText() → enhancedText
  → hideHud()
  → invoke("paste_text", { text: enhancedText })
  → isRecording = false
  → transitionTo("success", PASTE_SUCCESS_MESSAGE)
  → void invoke("start_quality_monitor")  ← 新增（fire-and-forget）
```

**同樣適用於所有成功貼上路徑：**
1. AI 整理成功 → 貼上 enhancedText → start_quality_monitor
2. AI fallback → 貼上 rawText → start_quality_monitor
3. 跳過 AI（< 10 字）→ 貼上 rawText → start_quality_monitor

**不啟動品質監控的情況：**
- 轉錄失敗（error 狀態）
- 空轉錄結果
- API Key 缺失

**建議抽取輔助函式：**
```typescript
function startQualityMonitorAfterPaste() {
  void invoke("start_quality_monitor").catch((err) =>
    writeErrorLog(
      `useVoiceFlowStore: start_quality_monitor failed: ${extractErrorMessage(err)}`
    )
  );
}
```

在每個成功貼上路徑末尾呼叫此函式。

### macOS Keycode 參考

| 按鍵 | Keycode (decimal) | 用途 |
|------|-------------------|------|
| Backspace (⌫) | 51 | 偵測修改 |
| Delete (⌦, Forward Delete) | 117 | 偵測修改 |
| Fn | 63 | hotkey_listener 使用 |
| Option (L) | 58 | hotkey_listener 使用 |

### Windows VK Code 參考

| 按鍵 | VK Code | 用途 |
|------|---------|------|
| Backspace | 0x08 (VK_BACK) | 偵測修改 |
| Delete | 0x2E (VK_DELETE) | 偵測修改 |
| Right Alt | 0xA5 (VK_RMENU) | hotkey_listener 使用 |

### Cargo.toml 依賴分析

**不需要新增 Rust 依賴。** keyboard_monitor.rs 使用的所有 crate 已在 Cargo.toml 中：
- macOS: `core-graphics 0.24`, `core-foundation 0.10` — 已存在
- Windows: `windows 0.61` with `Win32_UI_WindowsAndMessaging`, `Win32_UI_Input_KeyboardAndMouse` features — 已存在
- `serde`, `serde_json` — 已存在
- `tauri` — 已存在

**不需要新增 JS 依賴。** 前端僅使用 Tauri 核心 API（`invoke`, `listen`）。

### 檔案層級 Capabilities 注意

`capabilities/default.json` 目前已包含 `core:event:default` 和 `core:event:allow-emit`，Rust 端 `emit` 事件到前端不需額外權限。`invoke` command 需要確認 invoke handler 已註冊（Task 3.3）。

### 跨 Story 注意事項

- **Story 4.1** 會在 success 後寫入歷史記錄，包含 `wasModified` 欄位。本 Story 的 `lastWasModified` 供 4.1 讀取：`useVoiceFlowStore().lastWasModified`。
- **Story 2.1/2.2** 的 `handleStopRecording()` 有多個成功貼上路徑（AI 成功、AI fallback、跳過 AI），每個都需要觸發品質監控。
- **TranscriptionRecord** type（`types/transcription.ts`）已預定義 `wasModified: boolean | null` 欄位（line 14）。
- **SQLite schema**（architecture.md）的 `transcriptions` table 已預定義 `was_modified INTEGER` 欄位。
- `hotkey_listener.rs` 的 CGEventTap 使用 `CGEventTapOptions::ListenOnly`，keyboard_monitor 也必須使用 `ListenOnly`（不攔截、不修改事件）。

### 前一個 Story (2.2) 關鍵學習

- `enhanceText()` 的 options 參數使用 optional interface，向後相容
- `useSettingsStore` 的 tauri-plugin-store 操作模式：`store.get()` / `store.set()` / `store.save()`
- `handleStopRecording()` 的 AI 整理流程有 3 個成功 exit path（AI 成功 / AI fallback / 跳過 AI），每個都需要新增品質監控觸發
- `writeInfoLog` / `writeErrorLog` 用於所有關鍵節點
- Tauri Event 命名遵循 `{domain}:{action}` kebab-case 規範

### 現有檔案改動點

**新增檔案：**
```
src-tauri/src/plugins/keyboard_monitor.rs — OS-native 鍵盤監控模組
```

**修改檔案：**
```
src-tauri/src/plugins/mod.rs              — 新增 pub mod keyboard_monitor
src-tauri/src/lib.rs                       — 註冊 start_quality_monitor command + 初始化 state
src/composables/useTauriEvents.ts          — 新增 QUALITY_MONITOR_RESULT 事件常數
src/types/events.ts                        — 新增 QualityMonitorResultPayload 型別
src/stores/useVoiceFlowStore.ts            — 觸發品質監控 + 接收結果 + lastWasModified state
tests/unit/use-voice-flow-store.test.ts    — 新增品質監控相關測試案例
```

**不修改的檔案（明確排除）：**
- `src/lib/enhancer.ts` — AI 整理邏輯不變
- `src/lib/transcriber.ts` — 轉錄邏輯不變
- `src/lib/recorder.ts` — 錄音邏輯不變
- `src/components/NotchHud.vue` — HUD 不顯示品質監控狀態
- `src/views/SettingsView.vue` — 設定頁面不涉及品質監控
- `src/stores/useSettingsStore.ts` — 設定 store 不涉及
- `src/types/index.ts` — HudStatus 不新增狀態
- `src/types/transcription.ts` — wasModified 欄位已預定義
- `Cargo.toml` / `package.json` — 不需新增依賴
- `src-tauri/capabilities/default.json` — 現有權限已足夠
- `src-tauri/src/plugins/hotkey_listener.rs` — 不修改，獨立模組
- `src-tauri/src/plugins/clipboard_paste.rs` — 不修改

### 安全規則提醒

- 鍵盤監控使用 `ListenOnly` mode，不攔截或修改系統鍵盤事件
- 不記錄按鍵內容到日誌（僅記錄是否偵測到 Backspace/Delete 的布林結果）
- 監控結果不包含任何個人資訊（僅 `wasModified: boolean`）
- macOS Accessibility 權限是 hotkey_listener 已處理的前提條件

### 效能注意事項

- CGEventTap / Windows Hook 是 OS-native API，overhead 極低（< 1ms per event）
- 5 秒監聽期間的 CPU 使用幾乎為零（event-driven，非 polling）
- 監聽執行緒在 5 秒後自動清理，不造成資源洩漏
- cancel_token 檢查間隔 100ms，取消響應延遲最多 100ms
- 品質監控不影響 E2E 延遲（fire-and-forget，在成功貼上後才啟動）

### Git 歷史分析

**最近 commit 模式：**
- `feat:` 前綴用於功能實作
- `fix:` 前綴用於 code review 後修復
- `docs:` 前綴用於 BMAD artifacts 更新

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2 — Story 2.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure — plugins/keyboard_monitor.rs]
- [Source: _bmad-output/planning-artifacts/architecture.md#Integration Points — clipboard_paste.rs 擴展貼上後監控]
- [Source: _bmad-output/planning-artifacts/prd.md#文字輸出 FR15 — 貼上後鍵盤監控品質衡量]
- [Source: _bmad-output/planning-artifacts/prd.md#Risk Mitigation — 貼上後鍵盤監控的準確度]
- [Source: _bmad-output/implementation-artifacts/2-1-groq-llm-text-enhancement.md — useVoiceFlowStore handleStopRecording 流程]
- [Source: _bmad-output/implementation-artifacts/2-2-ai-prompt-customization-context.md — handleStopRecording 多個成功路徑]
- [Source: Codebase — src-tauri/src/plugins/hotkey_listener.rs（CGEventTap + Windows Hook 模式參考）]
- [Source: Codebase — src-tauri/src/plugins/clipboard_paste.rs（Rust command 模式參考）]
- [Source: Codebase — src-tauri/src/lib.rs（command 註冊 + state 管理模式）]
- [Source: Codebase — src/stores/useVoiceFlowStore.ts（擴展目標 — 3 個成功貼上路徑）]
- [Source: Codebase — src/types/transcription.ts — TranscriptionRecord.wasModified 已預定義]
- [Source: Codebase — src/types/events.ts（事件 payload 型別模式參考）]
- [Source: Codebase — src/composables/useTauriEvents.ts（事件常數命名模式參考）]
- [Source: Codebase — src-tauri/Cargo.toml — 確認現有依賴已足夠]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- vue-tsc: 無新增錯誤
- pnpm test: 116 JS + 19 Rust tests passed

### Completion Notes List

- keyboard_monitor.rs 建立（macOS CGEventTap + Windows WH_KEYBOARD_LL）
- 5 秒監控視窗 + cancel_token 提前中斷機制
- useVoiceFlowStore 整合 startQualityMonitorAfterPaste + lastWasModified
- useTauriEvents 新增 QUALITY_MONITOR_RESULT 事件常數

### Change Log

- Story 2.3 完整實作 — 貼上後品質監控

### File List

- src-tauri/src/plugins/keyboard_monitor.rs (new)
- src-tauri/src/plugins/mod.rs
- src-tauri/src/lib.rs
- src/composables/useTauriEvents.ts
- src/types/events.ts
- src/stores/useVoiceFlowStore.ts
- tests/unit/use-voice-flow-store.test.ts
