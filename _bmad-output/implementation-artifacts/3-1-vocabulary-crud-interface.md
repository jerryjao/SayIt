# Story 3.1: 詞彙字典 CRUD 介面

Status: done

## Story

As a 使用者,
I want 管理我的個人詞彙字典（新增、刪除、瀏覽）,
so that 我能將常用的專有名詞加入系統以提升辨識準確度。

## Acceptance Criteria

1. **AC1: 字典頁面載入與詞彙清單顯示**
   - Given Main Window 的字典頁面（DictionaryView.vue）
   - When 使用者開啟字典頁面
   - Then 顯示完整的自訂詞彙清單（表格形式）
   - And 頁面頂部顯示詞彙總數統計
   - And 清單為空時顯示空狀態提示（如「尚無自訂詞彙，新增常用術語以提升辨識率」）

2. **AC2: 新增詞彙**
   - Given 字典頁面已開啟
   - When 使用者在新增輸入框中輸入詞彙並按下新增按鈕（或 Enter）
   - Then useVocabularyStore 呼叫 addTerm() 將詞彙寫入 SQLite vocabulary 表
   - And 詞彙清單即時更新顯示新詞彙
   - And 輸入框清空，準備下一次輸入
   - And 發送 `vocabulary:changed` Tauri Event `{ action: 'added', term: '詞彙' }`

3. **AC3: 重複詞彙偵測**
   - Given 使用者嘗試新增詞彙
   - When 輸入的詞彙已存在於字典中
   - Then 顯示提示「此詞彙已存在」
   - And 不重複新增

4. **AC4: 空白輸入防護**
   - Given 使用者嘗試新增詞彙
   - When 輸入框為空白
   - Then 新增按鈕為 disabled 狀態
   - And 不執行新增操作

5. **AC5: 刪除詞彙**
   - Given 詞彙清單中有既有詞彙
   - When 使用者點擊某詞彙旁的刪除按鈕
   - Then useVocabularyStore 呼叫 removeTerm() 從 SQLite 刪除該詞彙
   - And 詞彙清單即時更新
   - And 發送 `vocabulary:changed` Tauri Event `{ action: 'removed', term: '詞彙' }`

6. **AC6: App 啟動載入詞彙**
   - Given useVocabularyStore 已實作
   - When App 啟動或字典頁面載入
   - Then fetchTermList() 從 SQLite 讀取所有詞彙
   - And SQLite column snake_case 正確映射為 TypeScript camelCase

7. **AC7: Tauri Event 跨視窗同步**
   - Given 詞彙新增或刪除操作完成
   - When vocabulary:changed 事件發送
   - Then 事件 payload 遵循 VocabularyChangedPayload 介面定義
   - And 事件可被其他視窗（HUD Window）接收

## Tasks / Subtasks

- [x]Task 1: 實作 useVocabularyStore SQLite CRUD (AC: #1, #2, #3, #5, #6)
  - [x]1.1 引入 `getDatabase()` from `lib/database.ts`，建立 SQL 查詢
  - [x]1.2 實作 `fetchTermList()`：SELECT 全部詞彙 + snake_case → camelCase 映射
  - [x]1.3 實作 `addTerm(term: string)`：驗證 → INSERT → 更新 termList → 發送 Tauri Event
  - [x]1.4 實作 `removeTerm(id: string)`：DELETE → 更新 termList → 發送 Tauri Event
  - [x]1.5 新增 `hasDuplicateTerm(term: string): boolean` computed helper
  - [x]1.6 新增 `termCount` computed 屬性
  - [x]1.7 錯誤處理：try/catch + extractErrorMessage，新增/刪除失敗不影響已載入的清單

- [x]Task 2: 建構 DictionaryView.vue UI (AC: #1, #2, #3, #4, #5)
  - [x]2.1 頂部統計區：顯示詞彙總數（Badge 或簡單文字）
  - [x]2.2 新增輸入區：Input + Button，支援 Enter 送出 + disabled 空白防護
  - [x]2.3 重複詞彙回饋：inline 錯誤文字提示「此詞彙已存在」
  - [x]2.4 詞彙清單表格：使用 Tailwind 手刻或 shadcn-vue Table 元件
  - [x]2.5 刪除按鈕：每行詞彙旁顯示刪除按鈕（紅色 hover 樣式）
  - [x]2.6 空狀態提示：清單為空時顯示引導文字
  - [x]2.7 Loading 狀態：fetchTermList 期間顯示 loading 指示

- [x]Task 3: 字典頁面初始載入整合 (AC: #6)
  - [x]3.1 DictionaryView.vue `onMounted` 呼叫 `vocabularyStore.fetchTermList()`
  - [x]3.2 確認 database 已在 main-window.ts bootstrap 中初始化

- [x]Task 4: Tauri Event 詞彙變更通知 (AC: #7)
  - [x]4.1 在 addTerm/removeTerm 成功後呼叫 `emitEvent(VOCABULARY_CHANGED, payload)`
  - [x]4.2 payload 遵循 VocabularyChangedPayload：`{ action: 'added' | 'removed', term: string }`

- [x]Task 5: 手動整合測試 (AC: #1-#7)
  - [x]5.1 驗證字典頁面載入顯示詞彙清單
  - [x]5.2 驗證新增詞彙成功寫入 + 清單即時更新
  - [x]5.3 驗證重複詞彙提示
  - [x]5.4 驗證空白輸入 disabled
  - [x]5.5 驗證刪除詞彙成功 + 清單即時更新
  - [x]5.6 驗證空狀態提示顯示
  - [x]5.7 驗證 App 重啟後詞彙持久化

## Dev Notes

### 現有骨架分析

Story 3.1 有明確的骨架基礎，以下文件已建立但內容為 TODO：

| 檔案 | 現狀 | Story 3.1 任務 |
|------|------|----------------|
| `src/stores/useVocabularyStore.ts` | 骨架：termList ref + 3 個 TODO stub | 實作 SQL CRUD 完整邏輯 |
| `src/views/DictionaryView.vue` | 空白佔位（僅標題文字） | 建構完整 CRUD UI |
| `src/types/vocabulary.ts` | `VocabularyEntry { id, term, createdAt }` 已定義 | 不需修改 |
| `src/types/events.ts` | `VocabularyChangedPayload { action: 'added' \| 'removed', term }` 已定義 | 不需修改 |
| `src/composables/useTauriEvents.ts` | `VOCABULARY_CHANGED` 常數已定義 | 不需修改 |
| `src/lib/database.ts` | vocabulary 表 schema 已建立（id, term UNIQUE, created_at） | 不需修改 |

### SQLite 操作模式

架構決策：**前端直接 SQL**（tauri-plugin-sql），資料存取邏輯集中在 Pinia store actions。

```typescript
// 正確的 SQL 操作模式 [Source: architecture.md#Data Architecture]
import { getDatabase } from '../lib/database';

// SELECT 查詢
const db = getDatabase();
const rows = await db.select<RawVocabularyRow[]>(
  'SELECT id, term, created_at FROM vocabulary ORDER BY created_at DESC'
);

// INSERT 操作
await db.execute(
  'INSERT INTO vocabulary (id, term) VALUES ($1, $2)',
  [uuid, term]
);

// DELETE 操作
await db.execute(
  'DELETE FROM vocabulary WHERE id = $1',
  [id]
);
```

### snake_case → camelCase 映射

SQLite 欄位 `created_at` 需映射為 TypeScript 的 `createdAt`。映射在 store action 中處理。

```typescript
interface RawVocabularyRow {
  id: string;
  term: string;
  created_at: string;  // SQLite 原始欄位名
}

function mapRowToEntry(row: RawVocabularyRow): VocabularyEntry {
  return {
    id: row.id,
    term: row.term,
    createdAt: row.created_at,
  };
}
```

### UUID 產生

vocabulary 表 id 為 TEXT PRIMARY KEY，需要在前端產生 UUID。使用 `crypto.randomUUID()`（所有現代瀏覽器 + Tauri WebView 都支援）。

```typescript
const id = crypto.randomUUID();
```

### 重複詞彙偵測策略

SQLite vocabulary 表的 `term` 欄位已設為 `UNIQUE` 約束。兩層防護：

1. **前端先行檢查**（UX 友善）：在 `addTerm()` 前比對 `termList` 中是否已存在（不區分大小寫 trim 後比較）
2. **SQLite UNIQUE 約束**（最終防線）：即使前端比對遺漏，INSERT 會因 UNIQUE 約束失敗

```typescript
function isDuplicateTerm(term: string): boolean {
  const normalizedInput = term.trim().toLowerCase();
  return termList.value.some(
    entry => entry.term.trim().toLowerCase() === normalizedInput
  );
}
```

### Tauri Event 發送模式

```typescript
import { emitEvent, VOCABULARY_CHANGED } from '../composables/useTauriEvents';
import type { VocabularyChangedPayload } from '../types/events';

// 新增後發送
await emitEvent(VOCABULARY_CHANGED, {
  action: 'added',
  term: newTerm,
} satisfies VocabularyChangedPayload);

// 刪除後發送
await emitEvent(VOCABULARY_CHANGED, {
  action: 'removed',
  term: removedTerm,
} satisfies VocabularyChangedPayload);
```

**注意**：使用 `emitEvent`（即 `emit` from `@tauri-apps/api/event`），不是 `emitToWindow`。`emit` 會廣播至所有視窗，確保 HUD Window 也能接收。Story 3.2 的 Whisper 詞彙注入需要監聽此事件即時更新詞彙快取。

### DictionaryView.vue UI 設計參考

遵循 SettingsView.vue 已建立的 UI 模式：
- 頁面容器：`<div class="p-6 text-white">`
- Section 卡片：`rounded-xl border border-zinc-700 bg-zinc-900 p-5`
- 標題：`text-2xl font-bold text-white` + 副標題 `text-zinc-400`
- 輸入框：`rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-white outline-none transition focus:border-blue-500`
- 按鈕（主要）：`rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50`
- 按鈕（危險/刪除）：`rounded-lg bg-red-600/20 px-4 py-2 text-sm text-red-400 transition hover:bg-red-600/30`
- 回饋訊息：`text-sm text-green-400` 或 `text-sm text-red-400`

可使用的 shadcn-vue 元件（已安裝）：
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` — 詞彙清單表格
- `Button` — 新增/刪除按鈕
- `Input` — 新增詞彙輸入框
- `Badge` — 詞彙總數統計

但目前 SettingsView.vue 使用原生 HTML + Tailwind（不使用 shadcn-vue），**建議保持一致使用原生 HTML + Tailwind**，避免同一 App 中混用兩種風格。

### 頁面佈局結構

```
+----------------------------------------------+
| 自訂字典                                      |
| 管理自訂詞彙以提升轉錄精準度                    |
|                                              |
| +------------------------------------------+ |
| | 詞彙總數: 12                  [輸入詞彙] [新增] | |
| +------------------------------------------+ |
| |                                          | |
| | 詞彙          新增時間           操作      | |
| | ─────────────────────────────────────     | |
| | SayIt         2026-03-01        [刪除]   | |
| | Tauri         2026-03-01        [刪除]   | |
| | Groq          2026-03-02        [刪除]   | |
| | ...                                      | |
| +------------------------------------------+ |
+----------------------------------------------+
```

### 錯誤處理模式

遵循架構決策：Service 層拋出 → Store 層 catch + 降級 + 使用者提示。

```
addTerm() / removeTerm() 失敗:
  → Store catch error
  → 不影響已載入的 termList（不回滾 UI）
  → throw error 給 View 層
  → View 顯示回饋提示（紅色文字）
  → 2.5 秒後自動消失
```

### 不需修改的檔案

以下檔案已具備 Story 3.1 所需的定義，**不需要任何修改**：

- `src/types/vocabulary.ts` — VocabularyEntry 介面已正確定義
- `src/types/events.ts` — VocabularyChangedPayload 已正確定義，action 使用 'added' | 'removed'
- `src/composables/useTauriEvents.ts` — VOCABULARY_CHANGED 常數已定義
- `src/lib/database.ts` — vocabulary 表 schema 已建立（含 UNIQUE 約束）
- `src/lib/errorUtils.ts` — extractErrorMessage helper 已存在
- `src/main-window.ts` — DB 初始化已在 bootstrap 中執行
- `src/MainApp.vue` — 字典頁面路由已在 navItems 中配置
- `src/router.ts` — /dictionary 路由已存在

### 需要修改的檔案清單

| 檔案 | 修改範圍 |
|------|---------|
| `src/stores/useVocabularyStore.ts` | 完整實作 CRUD 邏輯（替換 3 個 TODO stub） |
| `src/views/DictionaryView.vue` | 完整重寫為 CRUD UI |

### 跨 Story 備註

- **Story 3.2** 會消費 `vocabulary:changed` 事件和 `useVocabularyStore.termList` 來注入 Whisper prompt 和 AI 上下文
- **Story 2.2（已實作）** 的 enhancer.ts 已預留 `<vocabulary>` 標籤注入位置，Story 3.2 將補上讀取 vocabularyStore 的邏輯
- **useVocabularyStore** 目前不需在 HUD Window 初始化（HUD 不操作詞彙）。但 Story 3.2 可能需要 HUD Window 存取詞彙快取以注入 transcriber/enhancer — 屆時再決定是否在 HUD 初始化 vocabularyStore 或改用 Tauri Event 傳遞詞彙資料

### Project Structure Notes

- 所有修改均在既有專案結構內，不新增任何新檔案
- `useVocabularyStore.ts` 和 `DictionaryView.vue` 已存在於正確目錄
- 命名遵循架構規範：store camelCase、Vue PascalCase、SQL snake_case
- 依賴方向符合：`DictionaryView → useVocabularyStore → database.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1] — AC 完整定義
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — 前端直接 SQL、SQLite schema
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] — snake_case/camelCase 映射規則
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns] — Tauri Event 命名、Store Action 命名
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns] — 專案目錄結構
- [Source: src/stores/useVocabularyStore.ts] — 現有骨架
- [Source: src/views/DictionaryView.vue] — 現有空白佔位
- [Source: src/types/vocabulary.ts] — VocabularyEntry 介面
- [Source: src/types/events.ts] — VocabularyChangedPayload 介面
- [Source: src/composables/useTauriEvents.ts] — VOCABULARY_CHANGED 常數 + emitEvent
- [Source: src/lib/database.ts] — SQLite schema（vocabulary 表 + UNIQUE 約束）
- [Source: src/views/SettingsView.vue] — UI 模式參考（Tailwind classes、回饋訊息、section 卡片）
- [Source: src/stores/useSettingsStore.ts] — Store 模式參考（error handling、plugin-store pattern）
- [Source: src/lib/errorUtils.ts] — extractErrorMessage helper

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- vue-tsc: 無新增錯誤
- pnpm test: 116 tests passed

### Completion Notes List

- useVocabularyStore 完整 SQLite CRUD（fetchTermList, addTerm, removeTerm, isDuplicateTerm）
- DictionaryView 完整 UI（新增/刪除/列表/空狀態/統計 badge）
- vocabulary:changed Tauri Event 跨視窗同步

### Change Log

- Story 3.1 完整實作 — 詞彙字典 CRUD 介面

### File List

- src/stores/useVocabularyStore.ts
- src/views/DictionaryView.vue
