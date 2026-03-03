# Story 4.2: 歷史記錄瀏覽、搜尋與複製

Status: done

## Story

As a 使用者,
I want 瀏覽、搜尋和複製我的歷史轉錄記錄,
so that 我能找回之前說過的內容並重新使用。

## Acceptance Criteria

1. **AC1: 歷史記錄列表顯示**
   - Given Main Window 的歷史頁面（HistoryView.vue）
   - When 使用者開啟歷史頁面
   - Then 顯示轉錄記錄列表，按時間倒序排列（最新在上）
   - And 每筆記錄顯示：時間戳、文字預覽（前 50 字截斷）、錄音時長、是否經 AI 整理標記
   - And 記錄列表支援無限捲動或分頁載入

2. **AC2: 記錄展開與詳細資訊**
   - Given 歷史記錄列表
   - When 使用者點擊某筆記錄
   - Then 展開顯示完整文字內容
   - And 若有 AI 整理，同時顯示原始文字和整理後文字
   - And 顯示詳細資訊（錄音時長、轉錄耗時、AI 整理耗時、字數、觸發模式）

3. **AC3: 全文搜尋**
   - Given 歷史頁面頂部搜尋框
   - When 使用者輸入搜尋關鍵字
   - Then 對 rawText 和 processedText 欄位執行全文搜尋
   - And 即時過濾顯示符合的記錄
   - And 搜尋回應 < 200ms
   - And 搜尋框為空時顯示全部記錄

4. **AC4: 複製功能**
   - Given 歷史記錄展開狀態
   - When 使用者點擊複製按鈕
   - Then 將整理後文字（processedText）複製到剪貼簿
   - And 若無整理後文字，複製原始文字（rawText）
   - And 顯示短暫的「已複製」回饋提示

5. **AC5: 空狀態**
   - Given 歷史記錄為空
   - When 使用者開啟歷史頁面
   - Then 顯示空狀態提示（如「尚無轉錄記錄，開始使用語音輸入吧！」）

6. **AC6: 即時更新**
   - Given 歷史頁面已開啟
   - When HUD Window 完成一次新的轉錄
   - Then Main Window 收到 `transcription:completed` 事件
   - And 歷史列表自動在頂部插入新記錄（無需手動重新整理）

## Tasks / Subtasks

- [x]Task 1: 擴展 useHistoryStore 搜尋與分頁功能 (AC: #1, #3)
  - [x]1.1 新增 searchQuery ref 和 searchTranscriptionList(query, limit, offset) 方法
  - [x]1.2 SQL 搜尋查詢：WHERE raw_text LIKE '%keyword%' OR processed_text LIKE '%keyword%'
  - [x]1.3 分頁參數：LIMIT + OFFSET，預設每頁 20 筆
  - [x]1.4 新增 hasMore ref 追蹤是否有更多記錄
  - [x]1.5 新增 loadMore() 方法載入下一頁
  - [x]1.6 新增 resetAndFetch() 重置分頁並重新載入

- [x]Task 2: 實作 HistoryView.vue 列表與搜尋 UI (AC: #1, #3, #5)
  - [x]2.1 搜尋框：頂部 input，v-model 綁定搜尋關鍵字，debounce 300ms
  - [x]2.2 記錄列表：v-for 渲染 transcriptionList，卡片式佈局
  - [x]2.3 每筆摘要顯示：formatTimestamp、truncateText(50)、formatDuration、AI 整理標記
  - [x]2.4 空狀態：搜尋無結果 vs 完全無記錄，兩種不同提示
  - [x]2.5 載入狀態：isLoading 時顯示 loading 提示
  - [x]2.6 無限捲動：IntersectionObserver 偵測列表底部 sentinel 元素

- [x]Task 3: 實作記錄展開與詳細資訊 (AC: #2)
  - [x]3.1 expandedRecordId ref 追蹤目前展開的記錄 ID
  - [x]3.2 點擊記錄 toggle 展開/收起
  - [x]3.3 展開區域顯示完整原始文字
  - [x]3.4 若 wasEnhanced 且 processedText 有值，同時顯示整理後文字
  - [x]3.5 詳細資訊區：錄音時長、轉錄耗時、AI 整理耗時、字數、觸發模式

- [x]Task 4: 實作複製功能 (AC: #4)
  - [x]4.1 複製按鈕放在展開區域
  - [x]4.2 複製邏輯：processedText ?? rawText
  - [x]4.3 navigator.clipboard.writeText() 寫入剪貼簿
  - [x]4.4 「已複製」回饋提示（2.5 秒後自動消失）
  - [x]4.5 copiedRecordId ref 追蹤剛複製的記錄 ID（用於按鈕視覺回饋）

- [x]Task 5: 實作即時更新與手動測試 (AC: #6, #1-#5)
  - [x]5.1 onMounted 監聽 TRANSCRIPTION_COMPLETED 事件
  - [x]5.2 收到事件後在列表頂部插入新記錄（或 resetAndFetch 重新載入）
  - [x]5.3 onBeforeUnmount 清理事件監聽
  - [x]5.4 手動測試：驗證列表顯示、搜尋過濾、展開詳細、複製功能、空狀態、即時更新

## Dev Notes

### 現有骨架分析

| 檔案 | 現狀 | Story 4.2 任務 |
|------|------|----------------|
| `src/views/HistoryView.vue` | 空 placeholder（僅 title + subtitle） | 實作完整歷史記錄頁面 |
| `src/stores/useHistoryStore.ts` | fetchTranscriptionList() 為 TODO（Story 4.1 實作基本版） | 擴展搜尋 + 分頁功能 |
| `src/types/transcription.ts` | TranscriptionRecord 完整定義 | 不需修改 |
| `src/types/events.ts` | TranscriptionCompletedPayload 已定義 | 不需修改 |
| `src/composables/useTauriEvents.ts` | TRANSCRIPTION_COMPLETED 常數已定義 | 不需修改 |
| `src/lib/database.ts` | idx_transcriptions_timestamp 索引已建立 | 不需修改 |
| `src/router.ts` | /history 路由已註冊 | 不需修改 |

### 依賴 Story 4.1 的前提

Story 4.2 假設 Story 4.1 已完成以下實作：
- `useHistoryStore.addTranscription()` — SQL INSERT 完成
- `useHistoryStore.fetchTranscriptionList()` — 基本 SQL SELECT + snake_case→camelCase 映射
- `RawTranscriptionRow` interface 和 `mapRowToRecord()` helper（已在 Story 4.1 Dev Notes 中定義）
- HUD Window 中 DB 初始化（Story 3.2 前提）

如果 Story 4.1 的 fetchTranscriptionList() 已含分頁/搜尋，則 Task 1 範圍縮小。如果 Story 4.1 只實作了基本 SELECT ALL，則 Task 1 需要擴展。

### useHistoryStore 搜尋與分頁擴展

Story 4.1 建立的 fetchTranscriptionList() 預計為基本版（SELECT ALL + ORDER BY）。Story 4.2 需要擴展為支援搜尋和分頁：

```typescript
const PAGE_SIZE = 20;
const searchQuery = ref("");
const hasMore = ref(true);
const currentOffset = ref(0);

async function searchTranscriptionList(query: string, limit = PAGE_SIZE, offset = 0): Promise<TranscriptionRecord[]> {
  const db = getDatabase();
  let rows: RawTranscriptionRow[];

  if (query.trim()) {
    const pattern = `%${query.trim()}%`;
    rows = await db.select<RawTranscriptionRow[]>(
      `SELECT id, timestamp, raw_text, processed_text,
              recording_duration_ms, transcription_duration_ms, enhancement_duration_ms,
              char_count, trigger_mode, was_enhanced, was_modified, created_at
       FROM transcriptions
       WHERE raw_text LIKE $1 OR processed_text LIKE $1
       ORDER BY timestamp DESC
       LIMIT $2 OFFSET $3`,
      [pattern, limit, offset]
    );
  } else {
    rows = await db.select<RawTranscriptionRow[]>(
      `SELECT id, timestamp, raw_text, processed_text,
              recording_duration_ms, transcription_duration_ms, enhancement_duration_ms,
              char_count, trigger_mode, was_enhanced, was_modified, created_at
       FROM transcriptions
       ORDER BY timestamp DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }

  return rows.map(mapRowToRecord);
}

async function resetAndFetch() {
  currentOffset.value = 0;
  hasMore.value = true;
  const results = await searchTranscriptionList(searchQuery.value, PAGE_SIZE, 0);
  transcriptionList.value = results;
  currentOffset.value = results.length;
  hasMore.value = results.length >= PAGE_SIZE;
}

async function loadMore() {
  if (!hasMore.value || isLoading.value) return;
  isLoading.value = true;
  try {
    const results = await searchTranscriptionList(searchQuery.value, PAGE_SIZE, currentOffset.value);
    transcriptionList.value.push(...results);
    currentOffset.value += results.length;
    hasMore.value = results.length >= PAGE_SIZE;
  } finally {
    isLoading.value = false;
  }
}
```

**注意**：`mapRowToRecord` 函式已在 Story 4.1 中定義（snake_case → camelCase + boolean 轉換）。直接使用即可。

### SQLite 搜尋效能

- LIKE '%keyword%' 無法使用索引（前置 wildcard），但 transcriptions 表為個人使用（預期 < 10,000 筆），LIKE 效能足夠
- idx_transcriptions_timestamp 索引仍可協助 ORDER BY timestamp DESC 排序
- 如果未來需要真正的全文搜尋，可考慮 SQLite FTS5 extension，但 POC 階段不需要
- NFR 要求：搜尋回應 < 200ms，LIKE 查詢在萬筆量級下可達成

### 無限捲動實作模式

使用 IntersectionObserver 偵測 sentinel 元素進入視口：

```typescript
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && historyStore.hasMore && !historyStore.isLoading) {
        historyStore.loadMore();
      }
    },
    { threshold: 0.1 }
  );
  if (sentinelRef.value) {
    observer.observe(sentinelRef.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
```

Template 中在列表底部放置 sentinel：

```html
<div ref="sentinelRef" class="h-4" />
```

### 搜尋 Debounce 模式

使用手動 setTimeout debounce（不引入新依賴）：

```typescript
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const SEARCH_DEBOUNCE_MS = 300;

function handleSearchInput(query: string) {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    historyStore.searchQuery = query;
    historyStore.resetAndFetch();
  }, SEARCH_DEBOUNCE_MS);
}
```

### 記錄展開/收起模式

使用單一 expandedRecordId ref 追蹤展開的記錄（一次只展開一筆）：

```typescript
const expandedRecordId = ref<string | null>(null);

function toggleExpand(recordId: string) {
  expandedRecordId.value = expandedRecordId.value === recordId ? null : recordId;
}
```

### 複製功能

```typescript
const copiedRecordId = ref<string | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

async function handleCopyText(record: TranscriptionRecord) {
  const textToCopy = record.processedText ?? record.rawText;
  await navigator.clipboard.writeText(textToCopy);

  if (copiedTimer) clearTimeout(copiedTimer);
  copiedRecordId.value = record.id;
  copiedTimer = setTimeout(() => {
    copiedRecordId.value = null;
  }, 2500);
}
```

### 即時更新（TRANSCRIPTION_COMPLETED 事件）

HistoryView 需監聽 `transcription:completed` 事件，在新轉錄完成時更新列表：

```typescript
import { listenToEvent, TRANSCRIPTION_COMPLETED } from '../composables/useTauriEvents';
import type { TranscriptionCompletedPayload } from '../types/events';
import type { UnlistenFn } from '@tauri-apps/api/event';

let unlistenTranscriptionCompleted: UnlistenFn | null = null;

onMounted(async () => {
  // 初始載入
  await historyStore.resetAndFetch();

  // 監聽新轉錄事件
  unlistenTranscriptionCompleted = await listenToEvent<TranscriptionCompletedPayload>(
    TRANSCRIPTION_COMPLETED,
    () => {
      // 收到新轉錄事件，重新載入列表以確保資料完整（從 DB 讀取含 createdAt 等完整欄位）
      historyStore.resetAndFetch();
    }
  );
});

onBeforeUnmount(() => {
  unlistenTranscriptionCompleted?.();
});
```

**注意**：TranscriptionCompletedPayload 是 Pick 型別，不包含全部 TranscriptionRecord 欄位（缺少 triggerMode、wasModified、createdAt），因此收到事件後選擇 resetAndFetch() 從 DB 重新載入完整記錄，而非直接用 payload 構建 TranscriptionRecord 插入列表。

### 時間格式化 Helper

```typescript
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function truncateText(text: string, maxLength = 50): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
```

### UI 設計參考

遵循既有 UI 模式（DictionaryView.vue 和 SettingsView.vue）：

- **容器**：`rounded-xl border border-zinc-700 bg-zinc-900 p-5`
- **頁面標題**：`text-2xl font-bold text-white` + `text-zinc-400` 副標題
- **輸入框**：`rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-white outline-none transition focus:border-blue-500`
- **按鈕（主要）**：`rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500`
- **標記徽章**：`rounded-full bg-{color}-500/20 px-2 py-0.5 text-xs font-medium text-{color}-400`
- **空狀態**：`rounded-lg border border-dashed border-zinc-600 px-4 py-8 text-center text-zinc-400`
- **回饋訊息**：`text-sm text-green-400`（成功）/ `text-sm text-red-400`（錯誤），搭配 transition fade
- **載入狀態**：`text-center text-zinc-400`
- **卡片 hover**：`transition hover:bg-zinc-800/50`

### 記錄卡片佈局建議

```
┌─────────────────────────────────────────────┐
│ 2026-03-03 14:30    [AI 整理]    3.2 秒     │  ← 摘要行
│ 這是一段轉錄文字的前五十個字截斷預覽...     │  ← 預覽行
│                                              │
│ ▼ 展開後                                     │
│ ┌──────────────────────────────────────────┐ │
│ │ 整理後文字：                              │ │
│ │ （完整的 processedText 內容）             │ │
│ ├──────────────────────────────────────────┤ │
│ │ 原始文字：                                │ │
│ │ （完整的 rawText 內容）                   │ │
│ ├──────────────────────────────────────────┤ │
│ │ 錄音：3.2s  轉錄：1.1s  AI：0.8s        │ │
│ │ 字數：156   模式：hold                    │ │
│ │              [複製]                        │ │
│ └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 不需修改的檔案

- `src/types/transcription.ts` — TranscriptionRecord 已定義
- `src/types/events.ts` — TranscriptionCompletedPayload 已定義
- `src/composables/useTauriEvents.ts` — 事件常數已定義
- `src/lib/database.ts` — schema 和索引已建立
- `src/router.ts` — /history 路由已註冊
- `src/MainApp.vue` — sidebar 導航已包含歷史記錄

### 需要修改的檔案清單

| 檔案 | 修改範圍 |
|------|---------|
| `src/stores/useHistoryStore.ts` | 擴展搜尋 + 分頁功能（searchTranscriptionList, resetAndFetch, loadMore, searchQuery, hasMore, currentOffset） |
| `src/views/HistoryView.vue` | 從 placeholder 實作為完整頁面（搜尋框、記錄列表、展開詳細、複製、空狀態、無限捲動、即時更新） |

### 跨 Story 備註

- **Story 4.1** 是前提：提供 addTranscription + 基本 fetchTranscriptionList + mapRowToRecord
- **Story 4.3** 會使用 useHistoryStore.calculateDashboardStats() 和 transcription:completed 事件
- 本 Story 新增的 searchTranscriptionList 和分頁 API 只在 HistoryView 使用，不影響其他消費者
- mapRowToRecord 是 Story 4.1 建立的共用 helper，本 Story 直接使用

### Project Structure Notes

- 不新增任何新檔案
- 所有修改在既有專案結構內
- HistoryView.vue 是 Main Window 頁面，只在 Main Window 中渲染
- 路由已在 router.ts 中註冊，無需修改

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2] — AC 完整定義（lines 660-696）
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — 前端直接 SQL、SQLite WAL
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — Tauri Events 跨視窗同步、Pinia stores 結構
- [Source: _bmad-output/planning-artifacts/architecture.md#NFR] — SQLite 查詢 < 200ms
- [Source: _bmad-output/implementation-artifacts/4-1-transcription-auto-save.md] — 前一 Story：SQL 映射、fetchTranscriptionList 骨架、TranscriptionCompletedPayload 定義
- [Source: src/stores/useHistoryStore.ts] — 現有骨架（fetchTranscriptionList TODO）
- [Source: src/views/HistoryView.vue] — 空 placeholder
- [Source: src/views/DictionaryView.vue] — UI 設計參考（section cards、feedback、empty state、table）
- [Source: src/views/SettingsView.vue] — UI 設計參考（input 樣式、按鈕樣式、feedback transition）
- [Source: src/types/transcription.ts] — TranscriptionRecord 完整欄位
- [Source: src/types/events.ts] — TranscriptionCompletedPayload
- [Source: src/composables/useTauriEvents.ts] — TRANSCRIPTION_COMPLETED、listenToEvent
- [Source: src/lib/database.ts] — transcriptions 表 schema + 索引（timestamp DESC）
- [Source: src/router.ts] — /history 路由已註冊

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- vue-tsc: 無新增錯誤
- pnpm test: 160 tests passed

### Completion Notes List

- useHistoryStore 新增 searchTranscriptionList (LIKE + pagination) + resetAndFetch + loadMore
- HistoryView 完整重寫（search debounce 300ms, record list expand/collapse, copy clipboard, IntersectionObserver infinite scroll, transcription:completed event-driven updates）

### Change Log

- Story 4.2 完整實作 — 歷史記錄瀏覽、搜尋與複製

### File List

- src/stores/useHistoryStore.ts
- src/views/HistoryView.vue
- src/lib/formatUtils.ts (new, shared with DashboardView)
- tests/unit/use-history-store.test.ts
