# Story 4.5: 轉錄失敗一鍵重送

Status: done

## Story

As a 使用者,
I want 轉錄失敗時可以一鍵重送錄音給 Whisper,
so that 我不需要崩潰重講。

## Acceptance Criteria

1. **AC1: HUD error 狀態顯示重送按鈕**
   - Given HUD 顯示 error 狀態
   - When 該次失敗有對應的錄音檔案存在於磁碟（`audioFilePath !== null`）且尚未嘗試過重送
   - Then 顯示重送按鈕（不區分是否確定有說話）
   - And 重送按鈕沿用現有 retry-icon（`&#x21BB;`），位於 notch-right 區域
   - And 錄音太短（< 300ms）雖寫入 failed 但 audioFilePath 仍有值，透過 `canRetry` 控制（錄音太短不啟用重送）

2. **AC2: 點擊重送觸發重新轉錄**
   - Given 使用者點擊重送按鈕
   - When 上一次錄音的 WAV 檔案存在於磁碟
   - Then 從磁碟讀取 WAV 檔案（透過新增的 `retranscribe_from_file` Rust Command）
   - And HUD 切換為「轉錄中...」（復用 `transcribing` 狀態）
   - And 重新呼叫 Whisper API 進行轉錄

3. **AC3: 重送成功**
   - Given 重送的 Whisper API 回傳有效文字
   - When 轉錄結果非空
   - Then 進入正常的 AI 整理 → 貼上流程（復用 `completePasteFlow`）
   - And 更新 `transcriptions` 表的 `status` 從 `failed` 更新為 `success`
   - And 更新 `rawText`、`processedText`、`transcriptionDurationMs`、`enhancementDurationMs` 等欄位

4. **AC4: 重送也失敗**
   - Given 重送的 Whisper API 再次回傳空字串
   - When 二次轉錄失敗
   - Then HUD 顯示「辨識失敗，請重新錄音」
   - And 不再提供重送按鈕（限重送 1 次）

5. **AC5: 重送次數限制**
   - Given HUD error 狀態
   - When 已執行過一次重送
   - Then 第二次失敗後不再顯示重送按鈕
   - And 使用者只能重新錄音

## Tasks / Subtasks

- [x] Task 1: 新增 `retranscribe_from_file` Rust Command（AC: #2）
  - [x] 1.1 在 `transcription.rs` 新增 `retranscribe_from_file` Command
  - [x] 1.2 Command 接收 `file_path: String`（WAV 完整路徑）+ `api_key`、`vocabulary_term_list`、`model_id`、`language` 參數
  - [x] 1.3 從磁碟讀取 WAV 檔案（`std::fs::read`）取代從 `wav_buffer` 取得
  - [x] 1.4 復用 `transcribe_audio` 中的 Groq API 呼叫邏輯（提取共用函式 `send_transcription_request`）
  - [x] 1.5 回傳 `Result<TranscriptionResult, TranscriptionError>`（與 `transcribe_audio` 相同型別）
  - [x] 1.6 在 `lib.rs` 的 `invoke_handler` 註冊 `retranscribe_from_file`

- [x] Task 2: useVoiceFlowStore 新增重送狀態與流程（AC: #1, #2, #3, #4, #5）
  - [x] 2.1 新增 `lastFailedTranscriptionId: ref<string | null>` — 追蹤上一次失敗的 transcription ID
  - [x] 2.2 新增 `lastFailedAudioFilePath: ref<string | null>` — 追蹤上一次失敗的錄音檔路徑
  - [x] 2.3 新增 `lastFailedRecordingDurationMs: ref<number>` — 追蹤上一次失敗的錄音時長（供 record 建立用）
  - [x] 2.4 新增 `isRetryAttempt: ref<boolean>` — 標記當前是否為重送嘗試
  - [x] 2.5 新增 `canRetry: computed<boolean>` — `status === 'error' && lastFailedAudioFilePath !== null && !isRetryAttempt`
  - [x] 2.6 在失敗流程（空轉錄、API 錯誤）中設定 `lastFailedTranscriptionId`、`lastFailedAudioFilePath`、`lastFailedRecordingDurationMs`
  - [x] 2.7 錄音太短（< 300ms）不設定重送狀態（沒有意義重送太短的錄音）
  - [x] 2.8 在 `handleStartRecording()` 開頭重置所有重送狀態（`lastFailedTranscriptionId = null`、`lastFailedAudioFilePath = null`、`isRetryAttempt = false`）
  - [x] 2.9 在 store `return` 區塊 expose `canRetry` 和 `handleRetryTranscription`（現有 return 只有 status/message/recordingElapsedSeconds/lastWasModified/initialize/cleanup/transitionTo）

- [x] Task 3: 實作 `handleRetryTranscription()` 方法（AC: #2, #3, #4）
  - [x] 3.1 新增 `handleRetryTranscription()` async 方法（expose 給 App.vue）
  - [x] 3.2 設定 `isRetryAttempt = true`，清除 auto-hide timer
  - [x] 3.3 切換 HUD 為 `transcribing` 狀態（復用 `transitionTo('transcribing', t('voiceFlow.transcribing'))`）
  - [x] 3.4 呼叫 `invoke<TranscriptionResult>('retranscribe_from_file', { filePath, apiKey, vocabularyTermList, modelId, language })`
  - [x] 3.5 成功時：進入 AI 整理 → `completePasteFlow`，更新 DB（`updateTranscriptionOnRetrySuccess`），記錄 Whisper API 用量（`saveApiUsageRecordList`）
  - [x] 3.6 失敗時（空轉錄或 API 錯誤）：`transitionTo('error', t('voiceFlow.retryFailed'))`，清除 `lastFailedAudioFilePath`，重置 `isRetryAttempt = false`
  - [x] 3.7 注意：成功時 `isRetryAttempt` 在 `completePasteFlow` 回來後重置；失敗時在 catch 中立即重置

- [x] Task 4: useHistoryStore 新增 `updateTranscriptionOnRetrySuccess()` 方法（AC: #3）
  - [x] 4.1 新增 SQL 常數 `UPDATE_ON_RETRY_SUCCESS_SQL`：`UPDATE transcriptions SET status = 'success', raw_text = $1, processed_text = $2, transcription_duration_ms = $3, enhancement_duration_ms = $4, was_enhanced = $5, char_count = $6 WHERE id = $7`
  - [x] 4.2 實作 `updateTranscriptionOnRetrySuccess(params)` 方法
  - [x] 4.3 更新後發送 `TRANSCRIPTION_COMPLETED` 事件通知 Dashboard 更新

- [x] Task 5: App.vue 修改 handleRetry 為呼叫重送流程（AC: #1, #2）
  - [x] 5.1 將 `handleRetry()` 從「開啟 Dashboard」改為呼叫 `voiceFlowStore.handleRetryTranscription()`
  - [x] 5.2 移除現有的 `Window.getByLabel('main-window')` 相關邏輯
  - [x] 5.3 `Window` import 仍需保留（`onMounted` 中 line 58 仍使用 `Window.getByLabel('main-window')` 啟動時開 Dashboard）
  - [x] 5.4 傳遞 `canRetry` prop 給 NotchHud：`:can-retry="voiceFlowStore.canRetry"`

- [x] Task 6: NotchHud.vue 重送按鈕顯示邏輯調整（AC: #1, #5）
  - [x] 6.1 新增 `canRetry` prop（`boolean`，來自 `voiceFlowStore.canRetry`）
  - [x] 6.2 重送按鈕的 `v-if` 條件改為 `visualMode === 'error' && canRetry`
  - [x] 6.3 確保重送後（isRetryAttempt = true）按鈕消失

- [x] Task 7: i18n 翻譯鍵新增（AC: #4）
  - [x] 7.1 5 個 locale JSON 新增 `voiceFlow.retryFailed` 翻譯鍵
  - [x] 7.2 zh-TW: `"辨識失敗，請重新錄音"`
  - [x] 7.3 en: `"Recognition failed, please record again"`
  - [x] 7.4 ja: `"認識失敗、もう一度録音してください"`
  - [x] 7.5 zh-CN: `"识别失败，请重新录音"`
  - [x] 7.6 ko: `"인식 실패, 다시 녹음해 주세요"`

- [x] Task 8: 單元測試（AC: #1-#5）
  - [x] 8.1 `useVoiceFlowStore` 測試：重送成功流程
  - [x] 8.2 `useVoiceFlowStore` 測試：重送失敗流程（不再提供重送）
  - [x] 8.3 `useVoiceFlowStore` 測試：錄音太短不啟用重送
  - [x] 8.4 `useVoiceFlowStore` 測試：canRetry computed 邏輯

- [ ] Task 9: 手動測試驗證（AC: #1-#5）
  - [ ] 9.1 驗證 HUD error 狀態顯示重送按鈕
  - [ ] 9.2 驗證點擊重送後 HUD 切換為 transcribing
  - [ ] 9.3 驗證重送成功後正常貼上 + DB status 更新為 success
  - [ ] 9.4 驗證重送失敗後顯示「辨識失敗，請重新錄音」且無重送按鈕
  - [ ] 9.5 驗證新錄音時重送狀態正確重置

### Review Follow-ups (AI)

- [ ] [AI-Review][CRITICAL] F1: `completePasteFlow` 中 INSERT 與 UPDATE 衝突 — 重送成功時 `completePasteFlow` 內部 `saveTranscriptionRecord` 嘗試 INSERT 已存在的 id（PRIMARY KEY 衝突），且 `saveApiUsageRecordList` 被呼叫兩次導致 API 用量雙倍記錄 [src/stores/useVoiceFlowStore.ts:1166,1194,1219,1245,1261,1285]
- [ ] [AI-Review][HIGH] F2: 重送期間缺乏競態保護 — `handleRetryTranscription` 不設定 `isRecording = true`，hotkey 可同時觸發新錄音，導致重送結果與新錄音流程衝突 [src/stores/useVoiceFlowStore.ts:793,1073]
- [ ] [AI-Review][HIGH] F3: 測試未涵蓋重複 INSERT/API 用量場景 — 重送成功測試未驗證 `mockAddTranscription` 不被呼叫 + `mockAddApiUsage` 不被重複呼叫，掩蓋 F1 bug [tests/unit/use-voice-flow-store.test.ts:1902-1947]
- [ ] [AI-Review][MEDIUM] F4: `updateTranscriptionOnRetrySuccess` payload 中 `recordingDurationMs` 硬編碼為 0 — 應使用 `lastFailedRecordingDurationMs` 或傳入實際值 [src/stores/useHistoryStore.ts:507]
- [ ] [AI-Review][MEDIUM] F5: `retranscribe_from_file` 缺乏 file_path 基本驗證 — 無路徑檢查、副檔名檢查、目錄範圍限制 [src-tauri/src/plugins/transcription.rs:229-262]
- [ ] [AI-Review][LOW] F6: 部分 NotchHud 測試未傳入 `canRetry` 必要 prop — 多數既有測試缺少此 prop，產生 Vue runtime 警告 [tests/component/NotchHud.test.ts:45,57,68,107,125]
- [ ] [AI-Review][LOW] F7: `std::fs::read` 同步 I/O 在 async context — 目前影響可忽略但應留意未來大檔案場景 [src-tauri/src/plugins/transcription.rs:243]

## Dev Notes

### 現有骨架分析

| 檔案 | 現狀 | Story 4.5 任務 |
|------|------|----------------|
| `src-tauri/src/plugins/transcription.rs` | `transcribe_audio` 從 `wav_buffer` 取 WAV → Groq API | 新增 `retranscribe_from_file`：從磁碟讀 WAV → Groq API（提取共用函式） |
| `src-tauri/src/lib.rs` | 已有 `invoke_handler` 註冊區塊 | 新增 1 個 Command 註冊 |
| `src/stores/useVoiceFlowStore.ts` | `handleStopRecording()` 含完整流程 + 失敗記錄寫入 | 新增 `handleRetryTranscription()` + 重送狀態 refs |
| `src/stores/useHistoryStore.ts` | `addTranscription()` 負責 INSERT | 新增 `updateTranscriptionOnRetrySuccess()` 負責 UPDATE |
| `src/App.vue` | `handleRetry()` 目前只開 Dashboard | 改為呼叫 `voiceFlowStore.handleRetryTranscription()` |
| `src/components/NotchHud.vue` | error 狀態已有 retry-icon + `@retry` emit | 新增 `canRetry` prop 控制按鈕顯示 |

### Rust `retranscribe_from_file` 設計要點

```
 transcribe_audio()          retranscribe_from_file()
       │                              │
       ▼                              ▼
  wav_buffer.take()              std::fs::read(file_path)
       │                              │
       └──────────┬───────────────────┘
                  │
                  ▼
      send_transcription_request(wav_data, ...)
                  │
                  ▼
       TranscriptionResult
```

重構策略：將 `transcribe_audio` 中「組裝 multipart form → 發送 API → 解析回應」的邏輯提取為內部共用函式 `send_transcription_request(wav_data: Vec<u8>, ...)`，兩個 Command 共用。

```rust
#[command]
pub async fn retranscribe_from_file(
    transcription_state: State<'_, TranscriptionState>,
    file_path: String,
    api_key: String,
    vocabulary_term_list: Option<Vec<String>>,
    model_id: Option<String>,
    language: Option<String>,
) -> Result<TranscriptionResult, TranscriptionError> {
    // 注意：std::fs::read 是同步 I/O，但 WAV 檔案通常很小（< 1MB），
    // 在 Tauri command 的 async context 中可接受。
    // 若未來需要處理大檔案，改用 tokio::fs::read。
    let wav_data = std::fs::read(&file_path)
        .map_err(|e| TranscriptionError::RequestFailed(
            format!("Failed to read WAV file: {}", e)
        ))?;
    send_transcription_request(
        wav_data, transcription_state, api_key,
        vocabulary_term_list, model_id, language,
    ).await
}
```

**注意**：
- `retranscribe_from_file` 不需要 `AudioRecorderState`（不從 wav_buffer 取資料），只需要 `TranscriptionState`（Groq client + prompt 格式化）。
- 提取的 `send_transcription_request` 是內部函式（非 `#[command]`），參數中 `TranscriptionState` 應以 `&TranscriptionState` 引用傳入（不是 `State<'_, T>` wrapper）。兩個 Command 各自解包 `State<>` 後傳引用給共用函式。
- `MINIMUM_AUDIO_SIZE` 檢查應保留在共用函式中（從磁碟讀取的檔案也可能損壞或過小）。

### useVoiceFlowStore 重送流程

```
 App.vue handleRetry()
       │
       ▼
 voiceFlowStore.handleRetryTranscription()
       │
  isRetryAttempt = true
  transitionTo('transcribing')
       │
       ▼
 invoke('retranscribe_from_file', {
   filePath: lastFailedAudioFilePath,
   apiKey, vocabularyTermList, modelId, language
 })
       │
  ┌────┴────┐
  ▼         ▼
成功       失敗
  │         │
  ▼         ▼
 AI 整理    transitionTo('error', '辨識失敗，請重新錄音')
 → paste    清除 lastFailedAudioFilePath
 → UPDATE   isRetryAttempt = false
 DB status
 → API usage
```

### 失敗場景分類與重送行為

| 失敗場景 | 設定重送狀態？ | 理由 |
|---------|-------------|------|
| 空轉錄（Whisper 回傳空字串） | 是 | 主要重送目標 |
| API 錯誤（網路/伺服器錯誤） | 是 | 暫時性問題，重送有意義 |
| 錄音太短（< 300ms） | 否 | 重送太短錄音無意義 |
| save_recording_file 失敗 | 否 | 無檔案可重送（audioFilePath = null） |

### 重送狀態生命週期

```
 正常錄音失敗 → 設定 lastFailed* → canRetry = true
       │
  使用者點擊重送
       │
  isRetryAttempt = true → canRetry = false（按鈕消失）
       │
  ┌────┴────┐
  ▼         ▼
成功       失敗
  │         │
  ▼         ▼
重置所有    清除 lastFailedAudioFilePath
lastFailed* isRetryAttempt = false
狀態       canRetry = false（無路徑可重送）

 新錄音開始 → 重置所有 lastFailed* + isRetryAttempt
```

### DB UPDATE 策略

重送成功時需要 UPDATE 而非 INSERT：

```sql
UPDATE transcriptions
SET status = 'success',
    raw_text = $1,
    processed_text = $2,
    transcription_duration_ms = $3,
    enhancement_duration_ms = $4,
    was_enhanced = $5,
    char_count = $6
WHERE id = $7
```

不需更新的欄位：`id`、`created_at`、`audio_file_path`、`recording_duration_ms`、`trigger_mode`。

### 現有 handleRetry 行為變更（Breaking Change）

App.vue 的 `handleRetry()` 目前只是打開 Dashboard：
```typescript
async function handleRetry() {
  const mainWindow = await Window.getByLabel("main-window");
  if (!mainWindow) return;
  await mainWindow.show();
  await mainWindow.setFocus();
}
```

Story 4.5 將此改為實際的重送轉錄操作。使用者不再需要手動去 Dashboard 重新處理。

### Store Return 擴展

現有 return 區塊（line 1119）：
```typescript
return {
  status, message, recordingElapsedSeconds, lastWasModified,
  initialize, cleanup, transitionTo,
};
```

需新增：
```typescript
return {
  status, message, recordingElapsedSeconds, lastWasModified,
  canRetry,                    // 新增
  initialize, cleanup, transitionTo,
  handleRetryTranscription,    // 新增
};
```

### HUD 互動注意事項

error 狀態時 `setIgnoreCursorEvents(false)` 已在 `transitionTo('error')` 中設定，所以重送按鈕可以接收點擊事件。重送觸發後切換為 `transcribing`，此時 `setIgnoreCursorEvents(true)` 會自動恢復。

### 需要修改的檔案清單

| 檔案 | 修改範圍 |
|------|---------|
| `src-tauri/src/plugins/transcription.rs` | 提取共用函式 + 新增 `retranscribe_from_file` Command |
| `src-tauri/src/lib.rs` | `invoke_handler` 註冊 1 個新 Command |
| `src/stores/useVoiceFlowStore.ts` | 新增重送狀態 refs + `handleRetryTranscription()` + `canRetry` computed + expose |
| `src/stores/useHistoryStore.ts` | 新增 `updateTranscriptionOnRetrySuccess()` |
| `src/App.vue` | `handleRetry()` 改呼叫 `voiceFlowStore.handleRetryTranscription()` |
| `src/components/NotchHud.vue` | 新增 `canRetry` prop + 條件渲染 |
| `src/i18n/locales/*.json`（5 個） | 新增 `voiceFlow.retryFailed` 翻譯鍵 |

### 不需修改的檔案

- `src/lib/database.ts` — 不需 migration（schema 不變）
- `src/types/transcription.ts` — 型別不變
- `src/types/audio.ts` — 型別不變
- `src/composables/useTauriEvents.ts` — 不新增事件常數（重送不需要新事件）
- `src/router.ts` — 路由不變
- `src/MainApp.vue` — sidebar 不變
- `src/views/HistoryView.vue` — 歷史頁面不變
- `src/views/SettingsView.vue` — 設定頁面不變

### 跨 Story 備註

- **Story 4.4**（前置，已完成）：提供 `audio_file_path` 和 `status` 欄位 + 錄音檔磁碟儲存 + 失敗記錄寫入機制
- **Story 2.4**（後續，v0.9.0）：幻覺偵測攔截也會設定 `status: 'failed'`，屆時也應啟用重送機制
- `transcribe_audio` 的 `wav_buffer.take()` 是一次性消費，重送時 buffer 已空，必須從磁碟讀取

### 依賴 Story 4.4 的前提

Story 4.5 假設以下已完成：
- `transcriptions` 表有 `audio_file_path` 和 `status` 欄位（Migration v4）
- `save_recording_file` Command 已實作並在失敗流程中保存錄音
- `useVoiceFlowStore.handleStopRecording()` 失敗時寫入 `status: 'failed'` 記錄
- `HistoryView` 顯示 failed 記錄的 Badge

### Project Structure Notes

- 不新增新的 Vue 元件檔案
- 不新增新的 store 檔案
- 不新增新的 Rust plugin 檔案（擴展現有 `transcription.rs`）
- 遵循現有依賴方向：App.vue → stores → lib → Rust Commands

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5] — AC 完整定義（lines 835-862）
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-03-15.md#問題 2+3] — 重送機制決策、流程圖、限制條件
- [Source: _bmad-output/implementation-artifacts/4-4-recording-storage-history-playback.md] — 前置 Story 完整規格，audio_file_path 和 status 欄位來源
- [Source: src-tauri/src/plugins/transcription.rs] — 現有 `transcribe_audio` Command（wav_buffer.take() + Groq API 呼叫）
- [Source: src/stores/useVoiceFlowStore.ts] — 現有 `handleStopRecording()` 流程、`failRecordingFlow()`、`completePasteFlow()`
- [Source: src/App.vue] — 現有 `handleRetry()` 只開 Dashboard
- [Source: src/components/NotchHud.vue] — 現有 retry-icon + `@retry` emit
- [Source: src/stores/useHistoryStore.ts] — 現有 `addTranscription()` INSERT 機制
- [Source: src/types/audio.ts] — `TranscriptionResult` 型別定義
- [Source: src/types/transcription.ts] — `TranscriptionRecord` 型別定義

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Rust cargo check: pass, cargo test: 68/68 pass
- vue-tsc --noEmit: pass (no errors)
- Vitest: 302/302 pass (was 290, added 12 new tests)

### Completion Notes List

- Task 1: 提取 `send_transcription_request` 共用函式，`transcribe_audio` 和 `retranscribe_from_file` 共用 API 呼叫邏輯
- Task 2: 新增 4 個 ref + 1 個 computed，在空轉錄和 API 錯誤時設定重送狀態，錄音太短不設定
- Task 3: `handleRetryTranscription()` 完整實作三條路徑（AI 整理成功、AI 整理失敗 fallback、跳過 AI 整理）
- Task 4: `UPDATE_ON_RETRY_SUCCESS_SQL` + `updateTranscriptionOnRetrySuccess()` + emit `TRANSCRIPTION_COMPLETED`
- Task 5: `handleRetry()` 改為呼叫 store 方法，傳遞 `canRetry` prop
- Task 6: retry icon 的 `v-if` 加上 `canRetry` 條件
- Task 7: 5 個 locale 檔案各新增 `voiceFlow.retryFailed`
- Task 8: 8 個 VoiceFlow 重送測試 + 4 個 HistoryStore updateTranscriptionOnRetrySuccess 測試
- Task 9: 手動測試待執行

### Change Log

- 2026-03-15: Tasks 1-8 完成，Task 9（手動測試）待執行
- 2026-03-15: AI Code Review 完成 — 發現 1 CRITICAL + 2 HIGH + 2 MEDIUM + 2 LOW，共 7 個 action items 已建立

### File List

- `src-tauri/src/plugins/transcription.rs` — 提取 `send_transcription_request` + 新增 `retranscribe_from_file` Command
- `src-tauri/src/lib.rs` — 註冊 `retranscribe_from_file` 至 `invoke_handler`
- `src/stores/useVoiceFlowStore.ts` — 重送狀態 refs + `canRetry` computed + `handleRetryTranscription()` + 失敗時設定重送狀態
- `src/stores/useHistoryStore.ts` — `UPDATE_ON_RETRY_SUCCESS_SQL` + `updateTranscriptionOnRetrySuccess()`
- `src/App.vue` — `handleRetry()` 改呼叫 store + 傳遞 `canRetry` prop
- `src/components/NotchHud.vue` — 新增 `canRetry` prop + 條件渲染
- `src/i18n/locales/zh-TW.json` — 新增 `voiceFlow.retryFailed`
- `src/i18n/locales/en.json` — 新增 `voiceFlow.retryFailed`
- `src/i18n/locales/ja.json` — 新增 `voiceFlow.retryFailed`
- `src/i18n/locales/zh-CN.json` — 新增 `voiceFlow.retryFailed`
- `src/i18n/locales/ko.json` — 新增 `voiceFlow.retryFailed`
- `tests/unit/use-voice-flow-store.test.ts` — 8 個重送測試
- `tests/unit/use-history-store.test.ts` — 4 個 updateTranscriptionOnRetrySuccess 測試
- `tests/component/NotchHud.test.ts` — 更新 2 個既有測試 + 新增 1 個 canRetry=false 測試
