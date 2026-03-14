# Story 4.4: 錄音永久儲存與歷史播放

Status: done

## Story

As a 使用者,
I want 每次錄音檔案永久儲存，並可在歷史記錄中播放,
so that 我能回聽自己說了什麼，也能在辨識失敗時重送。

## Acceptance Criteria

1. **AC1: 錄音檔案寫入磁碟**
   - Given 錄音結束
   - When `stop_recording()` 完成 WAV 編碼
   - Then WAV 檔案寫入 `{APP_DATA}/recordings/{transcription_id}.wav`
   - And `transcriptions` 表的 `audio_file_path` 欄位記錄檔案路徑

2. **AC2: 失敗記錄仍保存錄音**
   - Given 轉錄失敗（Whisper 回傳空字串、錄音太短、API 錯誤）
   - When 失敗流程觸發
   - Then 仍然寫入 `transcriptions` 表，`status` 為 `failed`
   - And 錄音檔案仍然保存於磁碟
   - And 未來 Story 2.4 幻覺攔截也應復用此 `failed` 機制

3. **AC3: 歷史記錄播放按鈕**
   - Given HistoryView 顯示歷史記錄
   - When 該記錄有對應的錄音檔案存在
   - Then 顯示播放按鈕
   - And 點擊後透過 `convertFileSrc()` + HTML5 `<audio>` 播放

4. **AC4: 錄音檔案不存在時按鈕 disabled**
   - Given HistoryView 顯示歷史記錄
   - When 錄音檔案已被清理不存在
   - Then 播放按鈕灰顯 disabled

5. **AC5: 設定頁面錄音儲存管理**
   - Given 設定頁面
   - When 使用者查看錄音儲存設定
   - Then 顯示「刪除所有錄音檔」按鈕（含確認對話框）
   - And 顯示「自動清理」開關 + 天數設定（預設 7 天）

6. **AC6: 自動清理執行**
   - Given 自動清理已啟用
   - When App 啟動
   - Then 自動刪除超過設定天數的錄音檔
   - And 對應的 `transcriptions` 記錄的 `audio_file_path` 設為 null

## Tasks / Subtasks

- [x] Task 1: SQLite Migration v3 → v4（AC: #1, #2）
  - [x] 1.1 在 `database.ts` 新增 migration v4（包裹在 `BEGIN TRANSACTION` / `COMMIT` 中，失敗時 `ROLLBACK`，沿用 v3 migration 模式）
  - [x] 1.2 `ALTER TABLE transcriptions ADD COLUMN audio_file_path TEXT`
  - [x] 1.3 `ALTER TABLE transcriptions ADD COLUMN status TEXT NOT NULL DEFAULT 'success'`
  - [x] 1.4 `CREATE INDEX IF NOT EXISTS idx_transcriptions_status ON transcriptions(status)`
  - [x] 1.5 更新 `schema_version` 至 4

- [x] Task 2: Rust 端錄音檔寫入磁碟（AC: #1）
  - [x] 2.1 在 `audio_recorder.rs` 新增 `save_recording_file` Tauri Command
  - [x] 2.2 Command 接收 `id: String` + `app: AppHandle`，從 `AudioRecorderState.wav_buffer` 取出 WAV 資料
  - [x] 2.3 使用 `app.path().app_data_dir()` 取得 App Data 路徑，建立 `recordings/` 子目錄
  - [x] 2.4 寫入 `recordings/{id}.wav`，回傳檔案完整路徑 `Result<String, String>`
  - [x] 2.5 在 `lib.rs` 的 `invoke_handler` 註冊 `save_recording_file`

- [x] Task 3: Rust 端錄音檔清理 Commands（AC: #5, #6）
  - [x] 3.1 新增 `delete_all_recordings` Command：刪除 `recordings/` 目錄下所有 `.wav` 檔案，回傳刪除數量 `Result<u32, String>`
  - [x] 3.2 新增 `cleanup_old_recordings` Command：接收 `days: u32`，刪除修改時間超過指定天數的 `.wav`，回傳被刪除的檔案名稱清單 `Result<Vec<String>, String>`（檔名不含副檔名 = transcription ID，供前端更新 DB）
  - [x] 3.3 在 `lib.rs` 的 `invoke_handler` 註冊兩個新 Command

- [x] Task 4: 更新 TranscriptionRecord 型別與 Store（AC: #1, #2）
  - [x] 4.1 `src/types/transcription.ts`：`TranscriptionRecord` 新增 `audioFilePath: string | null` 和 `status: 'success' | 'failed'`
  - [x] 4.2 `src/stores/useHistoryStore.ts`：`RawTranscriptionRow` 新增 `audio_file_path` 和 `status` 欄位
  - [x] 4.3 `mapRowToRecord()` 新增 `audioFilePath` 和 `status` 映射
  - [x] 4.4 所有 SELECT SQL 常數新增 `audio_file_path, status` 欄位
  - [x] 4.5 `INSERT_SQL` 新增 `audio_file_path, status` 參數（$12, $13）
  - [x] 4.6 `addTranscription()` 傳入 `audioFilePath` 和 `status`

- [x] Task 5: useVoiceFlowStore 整合錄音儲存流程（AC: #1, #2）
  - [x] 5.1 在 `stopListeningFlow()` 中，`stop_recording` 成功後立即呼叫 `invoke('save_recording_file', { id: transcriptionId })`
  - [x] 5.2 `transcriptionId` 在 `stopListeningFlow` 開頭以 `crypto.randomUUID()` 生成，貫穿整個流程
  - [x] 5.3 `buildTranscriptionRecord()` 新增 `audioFilePath` 和 `status` 參數
  - [x] 5.4 成功流程：`status: 'success'`，`audioFilePath` 來自 `save_recording_file` 回傳值
  - [x] 5.5 失敗流程（空轉錄 / 錄音太短）：呼叫 `addTranscription` 寫入 `status: 'failed'`，保留 `audioFilePath`
  - [x] 5.6 `save_recording_file` 失敗時不阻斷主流程，`audioFilePath` 設為 `null` 並 log 警告

- [x] Task 6: HistoryView 播放功能與 failed 記錄顯示（AC: #2, #3, #4）
  - [x] 6.1 新增 `convertFileSrc` import（`@tauri-apps/api/core`）
  - [x] 6.2 每筆記錄旁新增播放按鈕（Play icon from lucide-vue-next）
  - [x] 6.3 按鈕狀態邏輯：`audioFilePath` 有值 → enabled，`audioFilePath` 為 null → disabled
  - [x] 6.8 `status === 'failed'` 的記錄顯示紅色 Badge（shadcn-vue `<Badge variant="destructive">`），文字「辨識失敗」，不隱藏 failed 記錄（Story 4.5 重送需要看到它們）
  - [x] 6.4 播放邏輯：`convertFileSrc(record.audioFilePath)` 取得安全 URL → 建立 `Audio` 物件 → `play()`
  - [x] 6.5 播放狀態追蹤：`playingRecordId` ref，播放中顯示 Pause icon，點擊可暫停
  - [x] 6.6 確保同一時間只有一個錄音在播放（播放新的自動停止舊的）
  - [x] 6.7 `onBeforeUnmount` 時清理 Audio 物件（停止播放、釋放資源）

- [x] Task 7: SettingsView 錄音儲存管理 UI（AC: #5）
  - [x] 7.1 `useSettingsStore` 新增 `isRecordingAutoCleanupEnabled`（boolean）和 `recordingAutoCleanupDays`（number, default 7）設定
  - [x] 7.2 SettingsView 新增「錄音儲存」section（位於現有 section 之後）
  - [x] 7.3 「刪除所有錄音檔」按鈕 + AlertDialog 確認對話框
  - [x] 7.4 「自動清理」Switch + 天數 Input（disabled when switch off）
  - [x] 7.5 刪除操作呼叫 `invoke('delete_all_recordings')`，成功後顯示 feedback 訊息
  - [x] 7.6 刪除後更新所有 transcriptions 的 `audio_file_path` 為 null（SQL UPDATE）

- [x] Task 8: App 啟動自動清理（AC: #6）
  - [x] 8.1 在 `main-window.ts` 啟動時讀取 `isRecordingAutoCleanupEnabled` 和 `recordingAutoCleanupDays`
  - [x] 8.2 若自動清理啟用，呼叫 `invoke<string[]>('cleanup_old_recordings', { days })` 執行清理
  - [x] 8.3 用回傳的 ID 清單批次 SQL UPDATE：`UPDATE transcriptions SET audio_file_path = NULL WHERE id IN (...)`
  - [x] 8.4 清理操作在背景執行（`setTimeout(() => ..., 0)` 或 `queueMicrotask`），不阻斷 App 啟動

- [x] Task 9: i18n 翻譯鍵新增
  - [x] 9.1 5 個 locale JSON（`src/i18n/locales/{zh-TW,en,ja,zh-CN,ko}.json`）新增錄音儲存管理相關翻譯鍵
  - [x] 9.2 翻譯鍵包含：播放按鈕 tooltip、刪除確認對話框文字、自動清理設定標籤、清理 feedback 訊息

- [ ] Task 10: 手動測試驗證（AC: #1-#6）
  - [ ] 10.1 驗證錄音後 `recordings/` 目錄出現對應 WAV 檔案
  - [ ] 10.2 驗證 `transcriptions` 表 `audio_file_path` 和 `status` 欄位正確
  - [ ] 10.3 驗證 HistoryView 播放按鈕可播放錄音
  - [ ] 10.4 驗證錄音不存在時按鈕 disabled
  - [ ] 10.5 驗證設定頁面刪除和自動清理功能

## Dev Notes

### 現有骨架分析

| 檔案 | 現狀 | Story 4.4 任務 |
|------|------|----------------|
| `src-tauri/src/plugins/audio_recorder.rs` | `stop_recording` 回傳 `StopRecordingResult { recordingDurationMs }`，WAV 存於 `wav_buffer` | 新增 `save_recording_file`、`delete_all_recordings`、`cleanup_old_recordings` Commands |
| `src-tauri/src/lib.rs` | 已有 `invoke_handler` 註冊區塊 | 新增 3 個 Command 註冊 |
| `src/lib/database.ts` | schema version 3（最新 migration: vocabulary weight/source） | 新增 migration v4：`audio_file_path` + `status` 欄位 |
| `src/types/transcription.ts` | `TranscriptionRecord` 缺少 `audioFilePath`、`status` | 擴展介面 |
| `src/stores/useHistoryStore.ts` | `RawTranscriptionRow`、`mapRowToRecord()`、SQL 常數 | 擴展所有 SQL + 型別映射 |
| `src/stores/useVoiceFlowStore.ts` | `stopListeningFlow()` 完整流程已存在 | 穿插 `save_recording_file` 呼叫 + 失敗記錄寫入 |
| `src/views/HistoryView.vue` | 歷史記錄列表已實作（搜尋、展開、複製） | 新增播放按鈕 + 播放邏輯 |
| `src/views/SettingsView.vue` | 多個設定 section 已存在 | 新增「錄音儲存」section |
| `src/stores/useSettingsStore.ts` | tauri-plugin-store 讀寫已封裝 | 新增清理設定 |

### 依賴 Story 4.1–4.3 的前提

Story 4.4 假設以下已完成：
- `useHistoryStore.addTranscription()` — SQL INSERT + 事件發送（Story 4.1）
- `HistoryView.vue` — 列表顯示、搜尋、展開、複製（Story 4.2）
- `DashboardView.vue` — 統計卡片（Story 4.3）
- `database.ts` — schema version 3，transcriptions 表已存在

### Rust `save_recording_file` 實作要點

```rust
#[command]
pub fn save_recording_file(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AudioRecorderState>,
) -> Result<String, String> {
    let wav_data = state
        .wav_buffer
        .lock()
        .map_err(|e| format!("Failed to lock wav_buffer: {}", e))?
        .clone()
        .ok_or_else(|| "No WAV data available".to_string())?;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let recordings_dir = app_data_dir.join("recordings");
    std::fs::create_dir_all(&recordings_dir)
        .map_err(|e| format!("Failed to create recordings dir: {}", e))?;

    let file_path = recordings_dir.join(format!("{}.wav", id));
    std::fs::write(&file_path, &wav_data)
        .map_err(|e| format!("Failed to write WAV file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}
```

### Rust `delete_all_recordings` 實作要點

```rust
#[command]
pub fn delete_all_recordings(
    app: tauri::AppHandle,
) -> Result<u32, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let recordings_dir = app_data_dir.join("recordings");
    if !recordings_dir.exists() {
        return Ok(0);
    }

    let mut count = 0u32;
    for entry in std::fs::read_dir(&recordings_dir)
        .map_err(|e| format!("Failed to read recordings dir: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read dir entry: {}", e))?;
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "wav") {
            std::fs::remove_file(&path)
                .map_err(|e| format!("Failed to delete {}: {}", path.display(), e))?;
            count += 1;
        }
    }
    Ok(count)
}
```

### Rust `cleanup_old_recordings` 實作要點

回傳被刪除的檔案名稱清單（不含副檔名 = transcription ID），供前端更新 DB：

```rust
#[command]
pub fn cleanup_old_recordings(
    days: u32,
    app: tauri::AppHandle,
) -> Result<Vec<String>, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let recordings_dir = app_data_dir.join("recordings");
    if !recordings_dir.exists() {
        return Ok(vec![]);
    }

    let cutoff = std::time::SystemTime::now()
        - std::time::Duration::from_secs(u64::from(days) * 24 * 60 * 60);

    let mut deleted_id_list: Vec<String> = Vec::new();
    for entry in std::fs::read_dir(&recordings_dir)
        .map_err(|e| format!("Failed to read recordings dir: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read dir entry: {}", e))?;
        let path = entry.path();
        if !path.extension().map_or(false, |ext| ext == "wav") {
            continue;
        }
        let metadata = std::fs::metadata(&path)
            .map_err(|e| format!("Failed to get metadata: {}", e))?;
        let modified = metadata.modified()
            .map_err(|e| format!("Failed to get modified time: {}", e))?;
        if modified < cutoff {
            // 取得不含副檔名的 stem（= transcription ID）
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                deleted_id_list.push(stem.to_string());
            }
            std::fs::remove_file(&path)
                .map_err(|e| format!("Failed to delete {}: {}", path.display(), e))?;
        }
    }
    Ok(deleted_id_list)
}
```

### Database Migration v4

沿用 v3 migration 的 TRANSACTION 模式（BEGIN → COMMIT / ROLLBACK）：

```typescript
// --- Migration v3 → v4: recording storage + status ---
const v4VersionRows = await connection.select<{ version: number }[]>(
  "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
);
const v4CurrentVersion = v4VersionRows[0]?.version ?? 1;

if (v4CurrentVersion < 4) {
  await connection.execute("BEGIN TRANSACTION;");
  try {
    await connection.execute(
      "ALTER TABLE transcriptions ADD COLUMN audio_file_path TEXT;",
    );
    await connection.execute(
      "ALTER TABLE transcriptions ADD COLUMN status TEXT NOT NULL DEFAULT 'success';",
    );
    await connection.execute(
      "CREATE INDEX IF NOT EXISTS idx_transcriptions_status ON transcriptions(status);",
    );
    await connection.execute(
      "INSERT OR REPLACE INTO schema_version (version) VALUES (4);",
    );
    await connection.execute("COMMIT;");
  } catch (migrationError) {
    await connection.execute("ROLLBACK;");
    throw migrationError;
  }
  console.log("[database] Migration v3 → v4: recording storage + status columns");
}
```

### TranscriptionRecord 型別擴展

```typescript
export interface TranscriptionRecord {
  // ...existing fields...
  audioFilePath: string | null;
  status: 'success' | 'failed';
}
```

### RawTranscriptionRow 擴展

```typescript
interface RawTranscriptionRow {
  // ...existing fields...
  audio_file_path: string | null;
  status: string;
}
```

### mapRowToRecord 擴展

```typescript
function mapRowToRecord(row: RawTranscriptionRow): TranscriptionRecord {
  return {
    // ...existing mappings...
    audioFilePath: row.audio_file_path,
    status: row.status as 'success' | 'failed',
  };
}
```

### useVoiceFlowStore 流程修改重點

`stopListeningFlow()` 核心變更：

1. 流程開頭生成 `transcriptionId = crypto.randomUUID()`
2. `stop_recording` 成功後，立即 `invoke('save_recording_file', { id: transcriptionId })`
3. 保存回傳的 `audioFilePath`（失敗時設 null）
4. 所有 `buildTranscriptionRecord()` 呼叫傳入 `audioFilePath` 和 `status`
5. 失敗流程（空轉錄、錄音太短）也呼叫 `addTranscription` 寫入 DB，`status: 'failed'`

**失敗記錄寫入時機**：
- `isEmptyTranscription(result.rawText)` → 寫入 failed 記錄
- `recordingDurationMs < MINIMUM_RECORDING_DURATION_MS` → 寫入 failed 記錄
- API 錯誤（transcribe_audio invoke 失敗）→ 寫入 failed 記錄（如果有 audioFilePath）

### HistoryView 播放 UI 模式

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';

const playingRecordId = ref<string | null>(null);
let currentAudio: HTMLAudioElement | null = null;

function handlePlayRecording(record: TranscriptionRecord) {
  // 停止正在播放的
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  // 如果點擊同一個（暫停）
  if (playingRecordId.value === record.id) {
    playingRecordId.value = null;
    return;
  }

  if (!record.audioFilePath) return;

  const audioSrc = convertFileSrc(record.audioFilePath);
  currentAudio = new Audio(audioSrc);
  playingRecordId.value = record.id;

  currentAudio.addEventListener('ended', () => {
    playingRecordId.value = null;
    currentAudio = null;
  });

  currentAudio.play().catch(() => {
    playingRecordId.value = null;
    currentAudio = null;
  });
}

// onBeforeUnmount 清理
onBeforeUnmount(() => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  playingRecordId.value = null;
});
```

### Tauri v2 Asset Protocol 配置（重要）

`convertFileSrc()` 在 Tauri v2 中將本地檔案路徑轉換為 `http://asset.localhost/...` URL。需要兩處配置：

**1. CSP 允許 asset protocol（`tauri.conf.json`）：**

現有 CSP 為 `default-src 'self'`，會阻擋 `http://asset.localhost` 域名的請求。需擴展 CSP：

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; connect-src 'self' https://api.groq.com; style-src 'self' 'unsafe-inline'; script-src 'self'; media-src 'self' http://asset.localhost"
    }
  }
}
```

新增 `media-src 'self' http://asset.localhost` 允許 `<audio>` 載入 asset protocol URL。

**2. Asset Protocol Scope（`tauri.conf.json`）：**

Tauri v2 需在 `app.security` 中啟用 asset protocol scope，限制可存取的本地路徑：

```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": ["$APPDATA/recordings/**"]
      }
    }
  }
}
```

**注意**：`tauri.conf.json` 是保護檔案（CLAUDE.md: 🟡 警告級），修改前需確認必要性。此處修改是功能性需求，必須執行。

### SettingsView 新 Section 佈局

新增在現有 sections 之後，沿用同樣的 Card + Section Header 模式：

```
┌─────────────────────────────────────────┐
│ 錄音儲存管理                             │
│                                          │
│ 自動清理  [Switch]                       │
│ 保留天數  [7] 天                         │
│                                          │
│ [刪除所有錄音檔]  (destructive button)   │
└─────────────────────────────────────────┘
```

### useSettingsStore 新增設定

```typescript
const isRecordingAutoCleanupEnabled = ref(false);
const recordingAutoCleanupDays = ref(7);
```

使用 `tauri-plugin-store` 持久化，key：
- `recordingAutoCleanupEnabled` (boolean)
- `recordingAutoCleanupDays` (number)

### 不需修改的檔案

- `src/composables/useTauriEvents.ts` — 不新增事件常數
- `src/router.ts` — 路由不變
- `src/MainApp.vue` — sidebar 不變
- `src/components/NotchHud.vue` — HUD 不變（重送功能屬 Story 4.5）
- `src/App.vue` — HUD 視窗不變

### 需要修改的檔案清單

| 檔案 | 修改範圍 |
|------|---------|
| `src-tauri/src/plugins/audio_recorder.rs` | 新增 `save_recording_file`、`delete_all_recordings`、`cleanup_old_recordings` Commands |
| `src-tauri/src/lib.rs` | `invoke_handler` 註冊 3 個新 Command |
| `src/lib/database.ts` | Migration v3 → v4（`audio_file_path` + `status` 欄位） |
| `src/types/transcription.ts` | `TranscriptionRecord` 擴展 `audioFilePath`、`status` |
| `src/stores/useHistoryStore.ts` | `RawTranscriptionRow` 擴展 + SQL 常數擴展 + `addTranscription` 擴展 |
| `src/stores/useVoiceFlowStore.ts` | `stopListeningFlow` 穿插錄音儲存 + 失敗記錄寫入 |
| `src/views/HistoryView.vue` | 新增播放按鈕 + 播放邏輯 |
| `src/views/SettingsView.vue` | 新增「錄音儲存管理」section |
| `src/stores/useSettingsStore.ts` | 新增 `isRecordingAutoCleanupEnabled`、`recordingAutoCleanupDays` |
| `src/main-window.ts` | App 啟動時執行自動清理 |
| `src-tauri/tauri.conf.json` | 可能需啟用 asset protocol scope |
| `src/i18n/locales/*.json`（5 個） | 新增翻譯鍵 |

### 跨 Story 備註

- **Story 4.1–4.3** 是前提：提供 transcriptions 表基本結構 + HistoryView + useHistoryStore
- **Story 4.5**（轉錄失敗一鍵重送）依賴 4.4：需要磁碟上的 WAV 檔案才能重送，以及 `status` 欄位判斷失敗記錄
- **Story 2.4**（幻覺偵測）與 4.4 的 `status: 'failed'` 欄位有交互：幻覺攔截也應記為 failed（但 Story 2.4 排在 v0.9.0，4.4 先行）
- 本 Story 新增的 `audioFilePath` 和 `status` 欄位會被 Story 4.5 消費（重送按鈕讀取 audioFilePath）
- `StopRecordingResult` 新增 `peakEnergyLevel` 欄位的需求（sprint-change-proposal 提及）本 Story 不處理，留給 Story 4.5 或 2.4

### Project Structure Notes

- 不新增新的 Vue 元件檔案，播放邏輯直接在 HistoryView.vue 內實作
- 不新增新的 store 檔案，擴展現有 useSettingsStore 和 useHistoryStore
- Rust 端不新增新的 plugin 檔案，擴展現有 audio_recorder.rs
- 遵循現有依賴方向：views → stores → lib → Rust Commands

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4] — AC 完整定義（lines 803-834）
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-03-15.md#問題 2+3] — 錄音儲存決策、清理策略、歷史播放技術方案
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — SQLite Schema（`audio_file_path`、`status` 欄位定義）
- [Source: _bmad-output/planning-artifacts/architecture.md#錄音檔管理] — 儲存位置、格式、命名、清理策略
- [Source: _bmad-output/planning-artifacts/architecture.md#Tauri Commands] — `save_recording_file`、`delete_all_recordings`、`cleanup_old_recordings` 定義
- [Source: _bmad-output/planning-artifacts/prd.md#FR37] — 錄音永久儲存與播放功能需求
- [Source: _bmad-output/planning-artifacts/prd.md#FR39] — 錄音檔清理設定（設定頁面部分）
- [Source: src-tauri/src/plugins/audio_recorder.rs] — 現有 `StopRecordingResult`、`AudioRecorderState.wav_buffer`
- [Source: src/lib/database.ts] — 現有 schema version 3、migration 模式
- [Source: src/types/transcription.ts] — 現有 `TranscriptionRecord` 定義
- [Source: src/stores/useHistoryStore.ts] — 現有 SQL 常數、`RawTranscriptionRow`、`mapRowToRecord()`
- [Source: src/stores/useVoiceFlowStore.ts] — 現有 `stopListeningFlow()` 流程
- [Source: src/views/HistoryView.vue] — 現有歷史記錄列表 UI
- [Source: src/views/SettingsView.vue] — 現有設定頁面 section 模式
- [Source: src/stores/useSettingsStore.ts] — 現有 tauri-plugin-store 讀寫封裝

## Dev Agent Record

### Agent Model Used
claude-opus-4-6[1m]

### Debug Log References

### Completion Notes List
- Task 1-9 全部完成，Task 10（手動測試）需使用者驗證
- Rust cargo check 通過，68 個 Rust 測試全過
- TypeScript vue-tsc --noEmit 通過
- Vitest 289 個測試全過（16 個測試檔案）
- 既有測試已更新以匹配新的 `audioFilePath` 和 `status` 欄位
- `Cargo.toml` 新增 `protocol-asset` feature（asset protocol 需要）
- `tauri.conf.json` CSP 新增 `media-src` + `assetProtocol` scope（播放錄音需要）
- `buildTranscriptionRecord` 的 `id` 參數改為外部傳入，不再內部生成（ID 需在流程開頭生成以供 save_recording_file 使用）

### Change Log
- 2026-03-15: Task 1-9 實作完成

### File List
- `src/lib/database.ts` — Migration v3→v4
- `src-tauri/src/plugins/audio_recorder.rs` — 3 個新 Commands + Manager import
- `src-tauri/src/lib.rs` — invoke_handler 註冊 3 個新 Commands
- `src-tauri/Cargo.toml` — 新增 protocol-asset feature
- `src-tauri/tauri.conf.json` — CSP media-src + assetProtocol scope
- `src/types/transcription.ts` — TranscriptionRecord 擴展
- `src/stores/useHistoryStore.ts` — SQL + 型別 + clearAudioFilePath 方法
- `src/stores/useVoiceFlowStore.ts` — 錄音儲存整合 + 失敗記錄寫入
- `src/stores/useSettingsStore.ts` — 新增清理設定
- `src/views/HistoryView.vue` — 播放按鈕 + failed Badge
- `src/views/SettingsView.vue` — 錄音儲存管理 section
- `src/main-window.ts` — App 啟動自動清理
- `src/i18n/locales/zh-TW.json` — 翻譯鍵
- `src/i18n/locales/en.json` — 翻譯鍵
- `src/i18n/locales/ja.json` — 翻譯鍵
- `src/i18n/locales/zh-CN.json` — 翻譯鍵
- `src/i18n/locales/ko.json` — 翻譯鍵
- `tests/unit/use-history-store.test.ts` — 更新測試
- `tests/unit/use-voice-flow-store.test.ts` — 更新測試
