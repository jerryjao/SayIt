# Story 4.1: 轉錄記錄自動儲存

Status: done

## Story

As a 使用者,
I want 每次語音輸入的完整資料自動被記錄下來,
so that 我能回顧歷史並追蹤使用統計。

## Acceptance Criteria

1. **AC1: 成功轉錄後自動寫入歷史記錄**
   - Given 一次成功的語音轉錄流程完成（含或不含 AI 整理）
   - When useVoiceFlowStore 狀態轉為 'success' 且文字已貼入
   - Then useHistoryStore.addTranscription() 將完整記錄寫入 SQLite transcriptions 表
   - And 記錄包含：id（UUID）、timestamp、rawText、processedText（若有）、recordingDurationMs、transcriptionDurationMs、enhancementDurationMs（若有）、charCount、triggerMode、wasEnhanced、wasModified（若已取得）
   - And created_at 由 SQLite datetime('now') 自動產生

2. **AC2: 儲存後發送 Tauri Event**
   - Given 轉錄記錄已寫入 SQLite
   - When 儲存成功
   - Then 發送 `transcription:completed` Tauri Event 至 Main Window
   - And payload 包含新記錄的摘要資訊 `{ id, rawText, processedText, charCount, wasEnhanced, ... }`
   - And Main Window 的 Dashboard 若已開啟，即時更新

3. **AC3: 失敗不寫入**
   - Given 轉錄流程失敗（API 錯誤、網路斷線）
   - When useVoiceFlowStore 狀態為 'error'
   - Then 不寫入歷史記錄
   - And 不發送 `transcription:completed` 事件

4. **AC4: camelCase → snake_case 映射**
   - Given useHistoryStore 的 addTranscription()
   - When 從 TypeScript camelCase 資料寫入 SQLite
   - Then 正確映射為 SQLite snake_case 欄位名
   - And SQLite WAL 模式確保寫入安全
   - And 寫入操作 < 200ms

5. **AC5: AI 整理跳過時的欄位處理**
   - Given AI 整理被跳過（字數 < 10 或 timeout fallback）
   - When 記錄寫入
   - Then processedText 為 null
   - And wasEnhanced 為 false
   - And enhancementDurationMs 為 null

6. **AC6: AI fallback 時的欄位處理**
   - Given AI 整理失敗但原始文字已貼上（fallback）
   - When 記錄寫入
   - Then processedText 為 null（AI 整理未成功產生結果）
   - And wasEnhanced 為 false
   - And enhancementDurationMs 記錄嘗試的時長（非 null）

## Tasks / Subtasks

- [x]Task 1: 實作 useHistoryStore.addTranscription() SQLite 寫入 (AC: #1, #4, #5, #6)
  - [x]1.1 引入 `getDatabase()` from `lib/database.ts`
  - [x]1.2 實作 camelCase → snake_case 欄位映射
  - [x]1.3 INSERT SQL：所有欄位正確對應 transcriptions 表 schema
  - [x]1.4 wasEnhanced 布林值 → SQLite INTEGER（0/1）轉換
  - [x]1.5 wasModified 布林值/null → SQLite INTEGER/NULL 轉換
  - [x]1.6 錯誤處理：寫入失敗 log 錯誤但不影響主流程

- [x]Task 2: useVoiceFlowStore 在 3 個 success 路徑呼叫 addTranscription (AC: #1, #3, #5, #6)
  - [x]2.1 收集轉錄記錄所需的全部欄位資料
  - [x]2.2 AI 整理成功路徑：組裝完整記錄（含 processedText + enhancementDurationMs）
  - [x]2.3 AI fallback 路徑：processedText=null, wasEnhanced=false, enhancementDurationMs=嘗試時長
  - [x]2.4 跳過 AI 路徑：processedText=null, wasEnhanced=false, enhancementDurationMs=null
  - [x]2.5 triggerMode 從 useSettingsStore 取得
  - [x]2.6 addTranscription 呼叫為 fire-and-forget（不 await 阻塞主流程）

- [x]Task 3: addTranscription 成功後發送 Tauri Event (AC: #2)
  - [x]3.1 在 INSERT 成功後呼叫 `emitToWindow('main-window', TRANSCRIPTION_COMPLETED, payload)`
  - [x]3.2 payload 遵循 TranscriptionCompletedPayload 型別
  - [x]3.3 使用 emitToWindow 而非 emitEvent（僅 Main Window 需要此事件）

- [x]Task 4: useHistoryStore.fetchTranscriptionList() 實作 (AC: #4)
  - [x]4.1 SELECT 全部記錄 + snake_case → camelCase 映射
  - [x]4.2 按 timestamp DESC 排序
  - [x]4.3 wasEnhanced INTEGER → boolean 轉換
  - [x]4.4 wasModified INTEGER/NULL → boolean/null 轉換

- [x]Task 5: 手動整合測試 (AC: #1-#6)
  - [x]5.1 驗證語音轉錄成功後記錄寫入 SQLite
  - [x]5.2 驗證 AI 整理成功時 processedText 有值
  - [x]5.3 驗證 AI 跳過時 processedText 為 null
  - [x]5.4 驗證 AI fallback 時的欄位值
  - [x]5.5 驗證轉錄失敗時不寫入
  - [x]5.6 驗證 transcription:completed 事件發送
  - [x]5.7 驗證 App 重啟後記錄持久化

## Dev Notes

### 現有骨架分析

| 檔案 | 現狀 | Story 4.1 任務 |
|------|------|----------------|
| `src/stores/useHistoryStore.ts` | 骨架：addTranscription + fetchTranscriptionList 為 TODO | 實作 SQL INSERT + SELECT |
| `src/stores/useVoiceFlowStore.ts` | 3 個 success 路徑均無 addTranscription 呼叫 | 在每個 success 路徑加入記錄儲存 |
| `src/types/transcription.ts` | TranscriptionRecord 完整定義 | 不需修改 |
| `src/types/events.ts` | TranscriptionCompletedPayload 已定義 | 不需修改 |
| `src/composables/useTauriEvents.ts` | TRANSCRIPTION_COMPLETED 常數已定義 | 不需修改 |
| `src/lib/database.ts` | transcriptions 表 schema 已建立 | 不需修改 |

### SQLite transcriptions 表 Schema

```sql
CREATE TABLE IF NOT EXISTS transcriptions (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  raw_text TEXT NOT NULL,
  processed_text TEXT,
  recording_duration_ms INTEGER NOT NULL,
  transcription_duration_ms INTEGER NOT NULL,
  enhancement_duration_ms INTEGER,
  char_count INTEGER NOT NULL,
  trigger_mode TEXT NOT NULL CHECK(trigger_mode IN ('hold', 'toggle')),
  was_enhanced INTEGER NOT NULL DEFAULT 0,
  was_modified INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

[Source: src/lib/database.ts lines 13-28]

### camelCase → snake_case 映射

```typescript
interface RawTranscriptionRow {
  id: string;
  timestamp: number;
  raw_text: string;
  processed_text: string | null;
  recording_duration_ms: number;
  transcription_duration_ms: number;
  enhancement_duration_ms: number | null;
  char_count: number;
  trigger_mode: string;
  was_enhanced: number;       // SQLite INTEGER: 0 or 1
  was_modified: number | null; // SQLite INTEGER or NULL
  created_at: string;
}

// INSERT 映射（camelCase → snake_case）
function buildInsertParams(record: TranscriptionRecord) {
  return [
    record.id,
    record.timestamp,
    record.rawText,
    record.processedText,
    record.recordingDurationMs,
    record.transcriptionDurationMs,
    record.enhancementDurationMs,
    record.charCount,
    record.triggerMode,
    record.wasEnhanced ? 1 : 0,           // boolean → INTEGER
    record.wasModified === null ? null : (record.wasModified ? 1 : 0),
  ];
}

// SELECT 映射（snake_case → camelCase）
function mapRowToRecord(row: RawTranscriptionRow): TranscriptionRecord {
  return {
    id: row.id,
    timestamp: row.timestamp,
    rawText: row.raw_text,
    processedText: row.processed_text,
    recordingDurationMs: row.recording_duration_ms,
    transcriptionDurationMs: row.transcription_duration_ms,
    enhancementDurationMs: row.enhancement_duration_ms,
    charCount: row.char_count,
    triggerMode: row.trigger_mode as TriggerMode,
    wasEnhanced: row.was_enhanced === 1,   // INTEGER → boolean
    wasModified: row.was_modified === null ? null : row.was_modified === 1,
    createdAt: row.created_at,
  };
}
```

### useVoiceFlowStore 的 3 個 Success 路徑

handleStopRecording() 有 3 個 success 路徑需要加入 addTranscription：

```
路徑 1: AI 整理成功（lines 275-297）
  → enhancedText 有值
  → processedText = enhancedText
  → wasEnhanced = true
  → enhancementDurationMs = 有值

路徑 2: AI 整理失敗 fallback（lines 298-308）
  → 使用 result.rawText 貼上
  → processedText = null（AI 未成功產生結果）
  → wasEnhanced = false
  → enhancementDurationMs = 嘗試的時長（非 null）

路徑 3: 跳過 AI（字數 < 10）（lines 309-321）
  → 直接使用 result.rawText 貼上
  → processedText = null
  → wasEnhanced = false
  → enhancementDurationMs = null
```

### 記錄組裝策略

建議在 handleStopRecording 中使用 helper 函式組裝記錄，避免 3 個路徑重複組裝邏輯：

```typescript
function buildTranscriptionRecord(params: {
  rawText: string;
  processedText: string | null;
  recordingDurationMs: number;
  transcriptionDurationMs: number;
  enhancementDurationMs: number | null;
  wasEnhanced: boolean;
}): TranscriptionRecord {
  const settingsStore = useSettingsStore();
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    rawText: params.rawText,
    processedText: params.processedText,
    recordingDurationMs: Math.round(params.recordingDurationMs),
    transcriptionDurationMs: Math.round(params.transcriptionDurationMs),
    enhancementDurationMs: params.enhancementDurationMs
      ? Math.round(params.enhancementDurationMs)
      : null,
    charCount: (params.processedText ?? params.rawText).length,
    triggerMode: settingsStore.triggerMode,
    wasEnhanced: params.wasEnhanced,
    wasModified: null,   // 品質監控結果稍後由 quality-monitor:result 事件更新
    createdAt: '',       // SQLite datetime('now') 自動產生，前端不填
  };
}
```

### triggerMode 取得

useVoiceFlowStore 目前不追蹤 triggerMode。從 `useSettingsStore().triggerMode` computed 取得：

```typescript
const settingsStore = useSettingsStore();
const triggerMode = settingsStore.triggerMode; // computed → 'hold' | 'toggle'
```

useSettingsStore 已在 useVoiceFlowStore 中 import 並使用（line 39, lines 239-245）。

### Fire-and-forget 儲存模式

addTranscription 不應阻塞主流程（貼上 + HUD 狀態轉換已完成）。使用 `void` fire-and-forget：

```typescript
// 在 transitionTo("success", ...) 之後
const historyStore = useHistoryStore();
void historyStore.addTranscription(record).catch((err) =>
  writeErrorLog(`useVoiceFlowStore: addTranscription failed: ${extractErrorMessage(err)}`)
);
```

### Tauri Event 發送

使用 `emitToWindow` 而非 `emitEvent`，因為只有 Main Window 需要接收此事件（Dashboard 即時更新）。HUD Window 不消費歷史記錄。

```typescript
import { emitToWindow, TRANSCRIPTION_COMPLETED } from '../composables/useTauriEvents';
import type { TranscriptionCompletedPayload } from '../types/events';

// addTranscription 成功後
const payload: TranscriptionCompletedPayload = {
  id: record.id,
  rawText: record.rawText,
  processedText: record.processedText,
  recordingDurationMs: record.recordingDurationMs,
  transcriptionDurationMs: record.transcriptionDurationMs,
  enhancementDurationMs: record.enhancementDurationMs,
  charCount: record.charCount,
  wasEnhanced: record.wasEnhanced,
};
await emitToWindow('main-window', TRANSCRIPTION_COMPLETED, payload);
```

### wasModified 延遲更新

TranscriptionRecord.wasModified 在儲存當下為 `null`（品質監控尚未回報結果）。Story 2.3 的 `quality-monitor:result` 事件稍後回報 wasModified，但 **Story 4.1 不需處理此更新** — wasModified 的 SQLite UPDATE 將在未來 story 中處理（或由 quality monitor result 事件直接更新最近一筆記錄）。

目前：
- `lastWasModified` ref 在 useVoiceFlowStore 中由 QUALITY_MONITOR_RESULT 事件更新（line 365-370）
- 但尚無邏輯將 lastWasModified 回寫至 SQLite transcriptions 表
- Story 4.1 先寫入 wasModified=null，後續可在 quality monitor result 回來後 UPDATE

### INSERT SQL

```sql
INSERT INTO transcriptions (
  id, timestamp, raw_text, processed_text,
  recording_duration_ms, transcription_duration_ms, enhancement_duration_ms,
  char_count, trigger_mode, was_enhanced, was_modified
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
```

**注意**：不 INSERT `created_at`，讓 SQLite DEFAULT datetime('now') 自動產生。

### fetchTranscriptionList SQL

```sql
SELECT id, timestamp, raw_text, processed_text,
       recording_duration_ms, transcription_duration_ms, enhancement_duration_ms,
       char_count, trigger_mode, was_enhanced, was_modified, created_at
FROM transcriptions
ORDER BY timestamp DESC
```

### charCount 計算

`charCount` 應為最終貼上文字的字數：
- AI 整理成功：`enhancedText.length`
- AI fallback / 跳過 AI：`rawText.length`

即 `(processedText ?? rawText).length`。

### HUD Window 中 useHistoryStore 的可用性

語音流程在 HUD Window 執行。addTranscription 需在 HUD Window 中呼叫 useHistoryStore。由於 Story 3.2 已在 HUD Window 初始化 database（App.vue onMounted 中 `await initializeDatabase()`），useHistoryStore 的 SQL 操作可以正常執行。

**前提**：Story 3.2 已完成 HUD Window DB 初始化。如果 Story 3.2 尚未實作，Story 4.1 的 Dev 需確認 DB 在 HUD Window 中可用。

### 不需修改的檔案

- `src/types/transcription.ts` — TranscriptionRecord、DashboardStats 已定義
- `src/types/events.ts` — TranscriptionCompletedPayload 已定義
- `src/composables/useTauriEvents.ts` — TRANSCRIPTION_COMPLETED 常數已定義
- `src/lib/database.ts` — transcriptions 表 schema 已建立
- `src/types/index.ts` — TriggerMode 已定義

### 需要修改的檔案清單

| 檔案 | 修改範圍 |
|------|---------|
| `src/stores/useHistoryStore.ts` | 實作 addTranscription() SQL INSERT + fetchTranscriptionList() SQL SELECT + Tauri Event 發送 |
| `src/stores/useVoiceFlowStore.ts` | 在 3 個 success 路徑呼叫 addTranscription（fire-and-forget） |

### 跨 Story 備註

- **Story 4.2** 會消費 fetchTranscriptionList() 在 HistoryView 中顯示歷史記錄
- **Story 4.3** 會消費 calculateDashboardStats()（已在 useHistoryStore 中有基本骨架）和 transcription:completed 事件在 Dashboard 即時更新
- **wasModified UPDATE** 尚無 story 覆蓋：quality monitor result 回來後需 UPDATE 最近一筆 transcription 的 was_modified 欄位。這可以在 Story 4.1 Dev 中順帶實作（在 QUALITY_MONITOR_RESULT listener 中），或留待後續

### Project Structure Notes

- 不新增任何新檔案
- 所有修改在既有專案結構內
- 依賴方向符合：`useVoiceFlowStore → useHistoryStore → database.ts`
- useHistoryStore 在 HUD Window 中使用（需 DB 已初始化）

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1] — AC 完整定義（lines 623-658）
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — transcriptions 表 schema、前端直接 SQL
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] — snake_case/camelCase 映射規則
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns] — Tauri Event 發送、emitToWindow
- [Source: src/stores/useHistoryStore.ts] — 現有骨架（addTranscription/fetchTranscriptionList TODO）
- [Source: src/stores/useVoiceFlowStore.ts] — 3 個 success 路徑（lines 275-321）、QUALITY_MONITOR_RESULT listener（lines 365-370）
- [Source: src/types/transcription.ts] — TranscriptionRecord 完整欄位定義
- [Source: src/types/events.ts] — TranscriptionCompletedPayload 定義
- [Source: src/composables/useTauriEvents.ts] — TRANSCRIPTION_COMPLETED 常數
- [Source: src/lib/database.ts] — transcriptions 表 CREATE TABLE（lines 13-28）
- [Source: src/stores/useSettingsStore.ts] — triggerMode computed（line 19-21）

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- vue-tsc: 無新增錯誤
- pnpm test: 147 tests passed

### Completion Notes List

- useHistoryStore 完整重寫（addTranscription SQL INSERT, fetchTranscriptionList, mapRowToRecord snake_case→camelCase）
- useVoiceFlowStore 整合 buildTranscriptionRecord + saveTranscriptionRecord (fire-and-forget)
- TRANSCRIPTION_COMPLETED Tauri Event 發送至 Main Window

### Change Log

- Story 4.1 完整實作 — 轉錄記錄自動儲存

### File List

- src/stores/useHistoryStore.ts
- src/stores/useVoiceFlowStore.ts
- src/types/transcription.ts
- tests/unit/use-history-store.test.ts (new)
- tests/unit/use-voice-flow-store.test.ts
