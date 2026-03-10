---
title: '智慧字典學習系統'
slug: 'smart-dictionary-learning'
created: '2026-03-09'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
tech_stack: ['Rust (AXUIElement / UI Automation)', 'Tauri Command', 'macOS Accessibility API', 'Windows UI Automation', 'Groq Chat API', 'SQLite']
files_to_modify: ['src-tauri/src/plugins/keyboard_monitor.rs', 'src-tauri/src/plugins/text_field_reader.rs', 'src-tauri/src/plugins/sound_feedback.rs', 'src-tauri/src/plugins/mod.rs', 'src-tauri/src/lib.rs', 'src/stores/useVocabularyStore.ts', 'src/stores/useVoiceFlowStore.ts', 'src/stores/useSettingsStore.ts', 'src/stores/useHistoryStore.ts', 'src/views/DictionaryView.vue', 'src/views/SettingsView.vue', 'src/views/DashboardView.vue', 'src/components/NotchHud.vue', 'src/lib/database.ts', 'src/lib/vocabularyAnalyzer.ts', 'src/types/vocabulary.ts', 'src/types/events.ts', 'src/composables/useTauriEvents.ts', 'CLAUDE.md']
code_patterns: ['cfg(target_os) 條件編譯', 'Tauri Command 註冊在 lib.rs invoke_handler', 'plugins/mod.rs 註冊新模組', 'Pinia store 封裝 DB 操作', 'useFeedbackMessage composable', 'shadcn-vue 元件系統']
test_patterns: ['Rust #[cfg(test)] mod tests 在同檔案底部', 'Vitest + jsdom 前端測試']
---

# Tech-Spec: 智慧字典學習系統

**Created:** 2026-03-09

## Overview

### Problem Statement

SayIt 的字典功能目前完全依賴使用者手動輸入。字典越豐富，Whisper 語音辨識和 AI 增強的品質就越好，但使用者往往懶得維護字典。同時，使用者每次修正轉錄錯字的行為本身就是最有價值的訓練信號，卻被白白浪費了。

### Solution

建立一套三層機制的智慧字典學習系統：

1. **權重系統**：追蹤每個字典詞彙的使用頻率，高頻詞優先餵給 Whisper/AI
2. **修正偵測**：貼上文字後監聽使用者按鍵活動，偵測到修正時用 Accessibility API 讀取修正後的文字
3. **AI 分析**：將原始轉錄與修正後文字送給 AI，嚴格篩選出字典級詞彙，自動加入字典

### Scope

**In Scope:**
- vocabulary 表新增 `weight`、`source` 欄位（DB migration v3）
- 每次轉錄完成後掃描輸出文字，命中的字典詞 weight += 1
- Whisper prompt 取 weight 前 50 個詞，AI enhancement 取前 50 個
- 擴展 keyboard_monitor.rs 偵測任意按鍵（不只 Backspace/Delete）
- 新增 text_field_reader.rs 透過 AXUIElement (macOS) / UI Automation (Windows) 讀取 focused text field
- 新增 vocabularyAnalyzer.ts 呼叫 Groq Chat API 分析修正差異
- AI 推薦的詞自動加入字典（source='ai'），已存在的詞則 weight += 1
- DictionaryView 分為「AI 推薦」和「手動新增」兩個區塊，按 weight DESC 排序
- SettingsView 新增「智慧字典學習」開關（macOS 預設開啟，Windows 預設關閉）
- DashboardView 顯示 vocabulary_analysis API 成本
- HUD 短暫顯示新學習的詞彙
- macOS + Windows 雙平台支援

**Out of Scope:**
- 批次歷史分析（分析過去的 raw_text vs processed_text）
- 使用者在 app 內手動修正歷史記錄
- 字典詞彙的自動刪除/過期機制
- 字典詞彙的匯出/匯入

## Context for Development

### Codebase Patterns

- 轉錄流程由 `useVoiceFlowStore.ts` 的 `handleStopRecording()` → `completePasteFlow()` 驅動
- 品質監控由 `keyboard_monitor.rs` 的持久 CGEventTap（macOS）/ Low-Level Hook（Windows）執行
- 字典管理在 `useVocabularyStore.ts`，資料存 SQLite `vocabulary` 表
- 字典詞彙在兩處使用：
  - Whisper API prompt（Rust `transcription.rs`，`format_whisper_prompt()`，上限 `MAX_WHISPER_PROMPT_TERMS`）
  - AI enhancement system prompt（`enhancer.ts`，`buildSystemPrompt()`，上限 `MAX_VOCABULARY_TERMS`）
- AI 增強使用 Groq Chat API（`enhancer.ts`），model 預設 `mixtral-8x7b-32768`
- 設定儲存在 `tauri-plugin-store`（不用 SQLite）
- API 用量記錄在 `api_usage` 表，由 `useHistoryStore.ts` 的 `addApiUsage()` 寫入
- HUD 透過 Tauri event 跨視窗通訊
- 平台特定邏輯使用 `#[cfg(target_os = "...")]` + 各平台子模組

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/stores/useVoiceFlowStore.ts` | 轉錄流程主控 store（權重更新 + 修正偵測插入點） |
| `src/stores/useVocabularyStore.ts` | 字典 CRUD store（需擴展 weight/source 方法） |
| `src/stores/useHistoryStore.ts` | API 用量記錄（addApiUsage 參考） |
| `src/stores/useSettingsStore.ts` | 設定讀寫模式參考 |
| `src/lib/enhancer.ts` | AI 增強呼叫模式參考（Groq Chat API 呼叫方式） |
| `src/lib/database.ts` | DB 初始化 + migration 機制 |
| `src-tauri/src/plugins/keyboard_monitor.rs` | 現有品質監控（擴展基礎） |
| `src-tauri/src/plugins/transcription.rs` | Whisper prompt 組裝（`format_whisper_prompt`） |
| `src/views/DictionaryView.vue` | 字典頁面（需改版） |
| `src/views/SettingsView.vue` | 設定頁面（新增開關） |
| `src/views/DashboardView.vue` | Dashboard（新增 API 成本項目） |
| `src/components/NotchHud.vue` | HUD 元件（新增學習通知） |

### Technical Decisions

- **偵測觸發策略**：貼上後監聽**任意** KeyDown（不只 Backspace/Delete）。一偵測到首次按鍵就立即進入 Phase 2（不等滿 5 秒）。Phase 2 中每次按鍵都做一次 AX 預讀（snapshot），偵測到 Enter 時用最新 snapshot 送 AI（解決 LINE 等通訊軟體按 Enter 會清空欄位的問題），fallback 為 3 秒 idle（最後按鍵後 3 秒無新按鍵），硬上限 15 秒
- **AX 文字讀取範圍**：透過 `kAXSelectedTextRangeAttribute` 取得選取範圍（`CFRange { location, length }`）。`length = 0` 時 `location` 即為游標位置；`length > 0` 時用 `location` 作定位點。從 `kAXValueAttribute` 全文中截取定位點前後 50 字。對 `AXWebArea`（Chromium 系瀏覽器）優先找其 focused child element 再讀取，避免取到整頁 DOM 文字
- **AI 分析不做程式 diff**：直接將 pastedText + fieldText 送 AI，讓 AI 判斷哪些修正值得加入字典
- **AI prompt 嚴格限縮**：只接受專有名詞、技術術語、特定領域用語，排除一般中文詞彙、標點修正、語序調整
- **重複詞彙處理**：AI 回傳的詞若已存在字典，不重複插入，而是 weight += 1（相同信號不浪費）
- **權重統一 +1**：不管是被動命中（轉錄輸出包含字典詞）還是修正觸發（AI 分析回傳已存在的詞），統一 weight += 1
- **權重命中匹配規則**：英文詞使用 word boundary 匹配（正則 `\b`），避免「AI」匹配到「KAISER」等子字串誤判；中文詞使用 `includes()` 子字串匹配（中文無 word boundary 概念，「台北」匹配「台北市」是合理的）
- **功能預設狀態**：智慧字典學習在 SettingsView 有獨立開關，macOS 預設 ON（AX API 可用），Windows 預設 OFF（text_field_reader 尚為 no-op）。權重系統獨立於此開關，始終啟用
- **API 成本追蹤**：每次 AI 分析記錄為 `api_type = 'vocabulary_analysis'` 到 `api_usage` 表
- **HUD 通知**：新學習的詞彙以短暫通知顯示在 HUD，不干擾現有狀態流
- **先做 macOS**：`text_field_reader.rs` 先實作 macOS AXUIElement，Windows UI Automation 作為後續 task
- **兩個 monitor 的時序關係**：`start_quality_monitor`（現有 5 秒）和 `start_correction_monitor`（新增）同時啟動，使用完全獨立的 flag 集，CGEventTap callback 中兩者邏輯互不干擾

## Implementation Plan

### Tasks

- [x] Task 1: DB migration v3 — vocabulary 表新增欄位 + api_usage 表重建
  - File: `src/lib/database.ts`
  - Action: 在 migration 機制中新增 v2 → v3 遷移
  - Notes:
    - vocabulary 表新增欄位：
      - `ALTER TABLE vocabulary ADD COLUMN weight INTEGER NOT NULL DEFAULT 1;`
      - `ALTER TABLE vocabulary ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';`
      - source 值：`'manual'`（使用者手動新增）| `'ai'`（AI 推薦自動加入）
      - 新增索引：`CREATE INDEX idx_vocabulary_weight ON vocabulary(weight DESC);`
      - 現有的手動新增詞彙全部 weight = 1, source = 'manual'
    - api_usage 表重建（更新 CHECK constraint 加入 `'vocabulary_analysis'`）：
      - SQLite 不支援 `ALTER TABLE ... MODIFY CONSTRAINT`，必須重建表
      - 步驟：
        1. `CREATE TABLE api_usage_new (... CHECK(api_type IN ('whisper', 'chat', 'vocabulary_analysis')) ...)`
        2. `INSERT INTO api_usage_new SELECT * FROM api_usage`
        3. `DROP TABLE api_usage`
        4. `ALTER TABLE api_usage_new RENAME TO api_usage`
        5. 重建索引 `idx_api_usage_transcription_id`
      - 必須在 transaction 中執行，確保原子性
    - 更新 `schema_version` 為 3

- [x] Task 2: 更新 VocabularyEntry 型別 + RawVocabularyRow + ApiType
  - Files: `src/types/vocabulary.ts`, `src/types/transcription.ts`
  - Action: 擴展 VocabularyEntry 介面和 ApiType 型別
  - Notes:
    - `src/types/vocabulary.ts`：
      - 新增 `weight: number`（使用權重，預設 1）
      - 新增 `source: 'manual' | 'ai'`（來源）
    - `src/types/transcription.ts`：
      - 更新 `ApiType = "whisper" | "chat" | "vocabulary_analysis"`（從 2 值擴展為 3 值）
    - 同步更新 `useVocabularyStore.ts` 的 `RawVocabularyRow` 和 `mapRowToEntry()`

- [x] Task 3: 擴展 useVocabularyStore — 權重 + AI 方法
  - File: `src/stores/useVocabularyStore.ts`
  - Action: 新增權重相關方法，修改查詢排序
  - Notes:
    - 修改 `fetchTermList()` 查詢：`ORDER BY weight DESC, created_at DESC`
    - 新增 `addAiSuggestedTerm(term: string)`：INSERT with `source = 'ai'`, `weight = 1`。新增後必須 emit `VOCABULARY_CHANGED` 事件（複用 `addTerm()` 的事件發送邏輯），確保跨視窗同步
    - 新增 `batchIncrementWeights(termIdList: string[])`：逐一執行 `UPDATE vocabulary SET weight = weight + 1 WHERE id = $1`（tauri-plugin-sql 不支援陣列參數展開，不能用 `WHERE id IN ($1)` 傳陣列）
    - 新增 `getTopTermListByWeight(limit: number): string[]`：回傳前 N 個高權重詞的 term 字串
    - 新增 computed `manualTermList`：`source = 'manual'` 的詞條
    - 新增 computed `aiSuggestedTermList`：`source = 'ai'` 的詞條
    - 修改 `addTerm(term)` 確保 `source = 'manual'`

- [x] Task 4: voiceFlowStore — 權重更新邏輯
  - File: `src/stores/useVoiceFlowStore.ts`
  - Action: 在 `completePasteFlow()` 完成後新增權重更新
  - Notes:
    - 在成功貼上並儲存 transcription 後執行
    - `finalText = processedText ?? rawText`
    - 掃描 `vocabularyStore.termList` 中每個 entry：
      - 英文詞（`/^[a-zA-Z]/.test(term)`）：用正則 `new RegExp('\\b' + escapeRegex(term) + '\\b', 'i')` 做 word boundary 匹配，避免「AI」匹配到「KAISER」
      - 中文/混合詞：用 `finalText.includes(entry.term)` 子字串匹配（中文無 word boundary 概念）
    - 收集所有命中的 `entry.id` → `vocabularyStore.batchIncrementWeights(matchedIdList)`
    - 權重更新失敗時靜默處理（`catch` + `writeErrorLog`），不影響主流程
    - 權重更新是 fire-and-forget，不阻塞後續流程

- [x] Task 5: 修改 Whisper / AI enhancement 字典注入 — 改用權重排序
  - Files: `src/stores/useVoiceFlowStore.ts`, `src-tauri/src/plugins/transcription.rs`, `src/lib/enhancer.ts`
  - Action: 改用 `getTopTermListByWeight()` 取代直接取全部 termList
  - Notes:
    - `useVoiceFlowStore.ts`：Whisper 呼叫時 `vocabularyStore.getTopTermListByWeight(50)` 取前 50 個
    - `useVoiceFlowStore.ts`：AI enhancement 呼叫時 `vocabularyStore.getTopTermListByWeight(50)` 取前 50 個
    - `transcription.rs`：`MAX_WHISPER_PROMPT_TERMS` 維持 50（與前端一致）
    - `enhancer.ts`：`MAX_VOCABULARY_TERMS` 改為 50（從 100 降）
    - 前端已做篩選，Rust 端的 limit 作為安全護欄

- [x] Task 6: DictionaryView 改版 — 權重顯示 + 分區 + 排序
  - File: `src/views/DictionaryView.vue`
  - Action: 重構字典頁面 UI
  - Notes:
    - 兩個區塊：「AI 推薦」（`aiSuggestedTermList`）和「手動新增」（`manualTermList`）
    - 兩個區塊內各自按 weight DESC 排序（store 查詢已處理）
    - Table 新增「權重」欄位，顯示方式：
      - weight ≥ 30 → `Badge variant="default"`（高頻，醒目）
      - weight ≥ 10 → `Badge variant="secondary"`（中頻）
      - weight < 10 → `Badge variant="outline"`（冷門）
    - 「AI 推薦」區塊標題旁顯示 Badge 計數（如「3 個詞」）
    - AI 推薦區塊的每個詞旁顯示 🤖 標示
    - 手動區塊的每個詞旁顯示 ✋ 標示
    - 刪除功能兩個區塊都有，操作方式不變
    - 新增按鈕仍只在頂部（手動新增的入口不變）
    - 空狀態分別處理：AI 區塊為空時顯示 `t('dictionary.noAiSuggestions')`
    - 頁面頂部新增說明區塊（Info icon + `t('dictionary.description')` + `t('dictionary.weightDescription', { limit: 50 })`），解釋字典用途和權重機制
    - 所有新增 UI 文字必須走 i18n（`t('dictionary.aiRecommended')`、`t('dictionary.manualAdded')`、`t('dictionary.weight')` 等）

- [x] Task 7: 擴展 keyboard_monitor.rs — 任意按鍵 + Enter 偵測
  - File: `src-tauri/src/plugins/keyboard_monitor.rs`
  - Action: 新增 `start_correction_monitor` command，支援任意按鍵偵測 + Enter 優先 + idle fallback
  - Notes:
    - 新增 state 欄位（與現有 quality monitor 的 state 完全獨立）：
      - `any_key_pressed: Arc<AtomicBool>` — 任意按鍵偵測
      - `enter_pressed: Arc<AtomicBool>` — Enter 偵測
      - `last_key_time: Arc<Mutex<Instant>>` — idle 偵測用
      - `correction_monitoring: Arc<AtomicBool>` — 修正監控模式 flag
      - `correction_cancel_token: Arc<AtomicBool>` — 取消 token
    - 擴展 CGEventTap callback（macOS）和 Hook callback（Windows）：
      - 當 `correction_monitoring = true` 時（與 `is_monitoring` 獨立判斷，兩者可同時為 true）：
        - 任意 KeyDown → `any_key_pressed = true`，更新 `last_key_time`
        - Enter（macOS keycode 36 / Windows VK_RETURN 0x0D）→ `enter_pressed = true`
      - 原有的 `is_monitoring` 邏輯不變（Backspace/Delete → `was_modified`）
    - 新增 `#[tauri::command] pub fn start_correction_monitor(app: AppHandle)`：
      - 重置所有 correction state
      - 啟動計時器執行緒：
        - **Phase 1**：100ms 間隔輪詢 `any_key_pressed`，最長等 5 秒
          - 一偵測到首次按鍵 → **立即進入 Phase 2**（不等滿 5 秒）
          - 5 秒內無按鍵 → emit `correction-monitor:result { anyKeyPressed: false }` → 結束
        - **Phase 2**：循環檢查（100ms 間隔）
          - `enter_pressed = true` → emit result（`enterPressed: true`）→ 結束
          - `last_key_time` 距今 ≥ 3 秒 → idle timeout → emit result（`idleTimeout: true`）→ 結束
          - 總時間 ≥ 15 秒 → 硬上限 → emit result → 結束
      - emit event：`correction-monitor:result`
    - 新增 payload struct：
      ```rust
      struct CorrectionMonitorResultPayload {
          any_key_pressed: bool,
          enter_pressed: bool,
          idle_timeout: bool,
      }
      ```
    - 新增 macOS keycode：`ENTER: u16 = 36`
    - 新增 Windows VK code：`VK_RETURN: u32 = 0x0D`
    - IME Enter 去抖：Enter keyDown 後啟動 500ms debounce timer，期間若有新 keyDown（使用者在 IME 候選字中按 Enter 選字後繼續打字）則重置 timer。只有 500ms 無新按鍵才設定 `enter_pressed = true`，避免 IME 選字的 Enter 被誤判為送出
    - 現有的 `start_quality_monitor` 和相關邏輯完全不變，兩個 monitor 使用完全獨立的 flag 集

- [x] Task 8: 新增 text_field_reader.rs — macOS AXUIElement 實作
  - File: `src-tauri/src/plugins/text_field_reader.rs`
  - Action: 建立新 plugin，透過 Accessibility API 讀取 focused text field 的游標附近文字
  - Notes:
    - macOS 實作流程（`mod macos`）：
      1. `AXUIElementCreateSystemWide()` → systemWide element
      2. `AXUIElementCopyAttributeValue(systemWide, kAXFocusedApplication)` → focused app
      3. `AXUIElementCopyAttributeValue(app, kAXFocusedUIElement)` → focused element
      4. 檢查 `kAXRoleAttribute`：
         - `AXTextField` / `AXTextArea` / `AXComboBox` → 直接使用此 element
         - `AXWebArea`（Chromium 系瀏覽器）→ 嘗試 `kAXFocusedUIElementAttribute` 取 child focused element，成功則用 child，失敗則 fallback 用 WebArea 本身
         - 其他 role → 回傳 `Ok(None)`
      5. `AXUIElementCopyAttributeValue(element, kAXSelectedTextRangeAttribute)` → 回傳 `AXValue` 包裝的 `CFRange { location, length }`
         - `length = 0`：游標無選取，`location` 即為游標位置
         - `length > 0`：有選取範圍，用 `location` 作為定位點
         - 讀取失敗：fallback 取全文末尾 100 字
      6. `AXUIElementCopyAttributeValue(element, kAXValueAttribute)` → 全文 CFString
      7. 截取 `location - 50 .. location + 50`（邊界 clamp，處理 char boundary 對齊）
      8. 回傳 `Ok(Some(excerpt))`
    - AX API 透過 `extern "C"` FFI 宣告（參考 `hotkey_listener.rs` 的 `AXIsProcessTrusted`）
    - 需要的 FFI 宣告：
      - `AXUIElementCreateSystemWide() -> AXUIElementRef`
      - `AXUIElementCopyAttributeValue(element, attribute, value_out) -> AXError`
      - `kAXFocusedApplicationAttribute`, `kAXFocusedUIElementAttribute`
      - `kAXValueAttribute`, `kAXSelectedTextRangeAttribute`, `kAXRoleAttribute`
    - `AXError != 0` 時回傳 `Ok(None)`（不是 error，只是讀不到）
    - 所有 CF 物件需正確 `CFRelease`（使用 `core_foundation` crate 的 wrapper 自動管理）
    - Tauri command：`#[command] pub fn read_focused_text_field() -> Result<Option<String>, String>`
    - Windows 實作先用 no-op placeholder：`Ok(None)`（後續 task 補上 UI Automation）

- [x] Task 9: 註冊新 plugin + command
  - Files: `src-tauri/src/plugins/mod.rs`, `src-tauri/src/lib.rs`
  - Action: 註冊 text_field_reader 模組和 commands
  - Notes:
    - `mod.rs`：`pub mod text_field_reader;`
    - `lib.rs` `generate_handler![]`：新增 `plugins::text_field_reader::read_focused_text_field`
    - `lib.rs` `generate_handler![]`：新增 `plugins::keyboard_monitor::start_correction_monitor`

- [x] Task 10: 新增 vocabularyAnalyzer.ts — AI 分析邏輯
  - File: `src/lib/vocabularyAnalyzer.ts`
  - Action: 建立字典分析模組，呼叫 Groq Chat API 比對原始與修正文字
  - Notes:
    - 使用 `@tauri-apps/plugin-http` 的 `fetch`（**不用瀏覽器原生 fetch**）
    - API 端點：`https://api.groq.com/openai/v1/chat/completions`
    - Model：使用 `settingsStore.selectedVocabularyAnalysisModelId`（獨立於 enhancer，預設 `llama-3.3-70b-versatile`，可選 Kimi K2 Instruct）
    - Temperature：0.1（比 enhancer 的 0.3 更低，要求更確定性的回答）
    - max_tokens：256（回傳 JSON array，不需要太多 token）
    - System prompt（嚴格版）：
      ```
      你是語音轉錄字典助手。
      比較以下「原始轉錄輸出」和「使用者修正後的文字」，
      找出因為語音辨識錯誤而被修正的詞彙。

      【只回傳符合以下條件的修正後詞彙】
      ✅ 專有名詞（人名、地名、品牌、公司名、產品名）
      ✅ 技術術語（框架、程式語言、工具、協定）
      ✅ 特定領域用語（行業術語、學術用語）

      【嚴格排除】
      ❌ 一般常用中文詞彙
      ❌ 標點符號修正
      ❌ 語序調整、贅詞刪除
      ❌ 大小寫差異的英文常見詞
      ❌ 使用者新增的補充內容（不在原文中的）
      ❌ 模糊不確定的推測

      回傳格式：JSON array，例如 ["Vue.js", "泰呈"]
      沒有符合條件的詞就回傳 []
      絕對不要回傳空字串或解釋文字，只要 JSON array。
      ```
    - User message：`<original>{pastedText}</original>\n<corrected>{fieldText}</corrected>`
    - 回傳型別：`VocabularyAnalysisResult { suggestedTermList: string[], usage: ApiUsageInfo }`
    - 解析 AI 回傳：嘗試 `JSON.parse()`，失敗則回傳空陣列
    - 參考 `enhancer.ts` 的 API 呼叫模式（headers、error handling）
    - 匯出函式：`analyzeCorrections(pastedText: string, fieldText: string, apiKey: string, options?: { modelId?: string }): Promise<VocabularyAnalysisResult>`

- [x] Task 11: voiceFlowStore — 整合修正偵測流程
  - File: `src/stores/useVoiceFlowStore.ts`
  - Action: 在 `completePasteFlow()` 後新增修正偵測 + AI 分析流程
  - Notes:
    - 完整流程（在 `completePasteFlow` 之後，fire-and-forget）：
      1. 檢查 `settingsStore.isSmartDictionaryEnabled` → false 則跳過
      2. 捕獲必要變數到 closure：`const pastedText = params.text`、`const transcriptionId = params.record.id`、`const apiKey = ...`
      3. `invoke("start_correction_monitor")` — 啟動修正監控
      4. **Snapshot 機制**：在 Phase 2 期間，前端啟動一個 polling（每 500ms）呼叫 `invoke("read_focused_text_field")`，將結果存入 `latestSnapshot` 變數。這是為了解決 LINE 等通訊軟體按 Enter 後文字欄位會清空的問題——Enter 觸發時用的是「最後一次成功讀到的 snapshot」
      5. 監聽 `correction-monitor:result` 事件（一次性 listener），收到結果：
         - `anyKeyPressed = false` → 停止 polling、結束
         - `anyKeyPressed = true` →
           - 停止 snapshot polling
           - 如果 `enterPressed = true`：先嘗試 fresh read（`invoke("read_focused_text_field")`），若結果非空則用 fresh read；若為空（LINE 等 app 已清空）則 fallback 使用 `latestSnapshot`
           - 如果 `idleTimeout = true`：做最後一次 `invoke("read_focused_text_field")` 取最新值
           - `fieldText === null` → 結束（所有讀取都失敗）
           - `fieldText.includes(pastedText)` → 結束（使用者沒修改我們貼的文字）
           - 呼叫 `analyzeCorrections(pastedText, fieldText, apiKey)`
           - 回傳空陣列 → 結束
           - 非空陣列 → 處理每個 suggestedTerm：
             - `vocabularyStore.isDuplicateTerm(term)` ?
               - true → 找到該 entry，`vocabularyStore.batchIncrementWeights([entry.id])`
               - false → `vocabularyStore.addAiSuggestedTerm(term)`
           - 記錄 `historyStore.addApiUsage({ apiType: 'vocabulary_analysis', transcriptionId, ... })`
           - emit `VOCABULARY_LEARNED` 事件給 HUD（只包含新增的詞，不包含已存在的）
      6. 所有錯誤靜默處理 + `writeErrorLog` + `captureError`
    - 修正偵測流程包裹在 `void (async () => { ... })()` 中，不阻塞任何現有流程
    - 如果使用者在修正偵測期間觸發了新的轉錄，`start_correction_monitor` 會覆蓋前一次監控（利用現有的 cancel 機制），前端也需要停止舊的 snapshot polling

- [x] Task 12: useSettingsStore — 新增智慧字典開關
  - File: `src/stores/useSettingsStore.ts`
  - Action: 新增 `isSmartDictionaryEnabled` 設定
  - Notes:
    - 預設值：macOS `true`（開啟），Windows `false`（關閉，text_field_reader 尚為 no-op）
    - 存儲在 `tauri-plugin-store`（與其他設定一致）
    - key：`smartDictionaryEnabled`
    - 提供 getter 和 setter（與現有 `isEnhancementThresholdEnabled` 模式一致）

- [x] Task 13: SettingsView — 新增智慧字典設定區塊
  - File: `src/views/SettingsView.vue`
  - Action: 在設定頁面新增智慧字典學習的開關
  - Notes:
    - 新增一個 Card 區塊（位置：在「短文字門檻」之後）
    - 標題：智慧字典學習
    - Switch 綁定：`:model-value="settingsStore.isSmartDictionaryEnabled"` + `@update:model-value`
    - 說明文字：`t('settings.smartDictionary.description')`
    - 補充說明（text-muted-foreground text-xs）：`t('settings.smartDictionary.privacyNote')`
    - 所有文字走 i18n，不硬編碼
    - 使用與現有 Switch 一致的 layout 模式

- [x] Task 14: 新增 events — VOCABULARY_LEARNED + CORRECTION_MONITOR_RESULT
  - Files: `src/types/events.ts`, `src/composables/useTauriEvents.ts`
  - Action: 定義新事件常量和 payload 型別
  - Notes:
    - `VOCABULARY_LEARNED = 'vocabulary:learned'`
    - `VocabularyLearnedPayload { termList: string[] }`（新增的詞列表）
    - `CORRECTION_MONITOR_RESULT = 'correction-monitor:result'`
    - `CorrectionMonitorResultPayload { anyKeyPressed: boolean, enterPressed: boolean, idleTimeout: boolean }`

- [x] Task 15: NotchHud — 學習通知
  - File: `src/components/NotchHud.vue`
  - Action: 新增學習通知的視覺回饋
  - Notes:
    - 監聽 `VOCABULARY_LEARNED` 事件
    - 收到事件時進入 expanded mode（notch 高度 42→72px，與 error 模式相同）
    - 上排：左側 book icon（lucide BookOpen SVG inline），右側 label `t('voiceFlow.vocabularyLearnedLabel')`（如「新增字典」）
    - 下排：詞彙文字 `t('voiceFlow.vocabularyLearned', { terms })`，居中顯示
    - 如果詞太多（> 3 個），截斷顯示 `t('voiceFlow.vocabularyLearnedTruncated', { terms, count })`
    - 播放音效：`invoke("play_learned_sound")`（macOS: Glass.aiff，Windows: 複用 start sound）
    - 音效實作：`sound_feedback.rs` 新增 `play_learned_sound` command
    - 所有文字走 i18n
    - 視覺風格：與 success 類似但用柔和藍色光暈（`shadow-blue-500/30`）
    - 顯示時長：2.8 秒後自動隱藏（由 voiceFlowStore 的 `LEARNED_NOTIFICATION_TOTAL_DURATION_MS` 控制）
    - HUD 視窗顯示機制：voiceFlowStore 在 emit 事件後呼叫 `appWindow.show()` + `setIgnoreCursorEvents(true)`，設定 2.8 秒 auto-hide timer
    - 不干擾現有 HUD 狀態：如果 HUD 正在顯示其他狀態（recording/transcribing/error），排隊等候
    - 優先級低於所有現有狀態

- [x] Task 16: DashboardView + useHistoryStore — 新增 vocabulary_analysis API 成本
  - Files: `src/views/DashboardView.vue`, `src/stores/useHistoryStore.ts`, `src/types/transcription.ts`
  - Action: 在 API 配額/成本區域新增 vocabulary_analysis 的統計
  - Notes:
    - `src/types/transcription.ts`：`DailyQuotaUsage` 介面新增 `vocabularyAnalysisRequestCount: number`、`vocabularyAnalysisTotalTokens: number`
    - `src/stores/useHistoryStore.ts`：
      - `DAILY_QUOTA_USAGE_SQL` 的 `GROUP BY api_type` 查詢已涵蓋新的 api_type，不需改 SQL
      - 在 `for (const row of rows)` 迴圈中新增 `else if (row.api_type === "vocabulary_analysis")` 分支，映射到新的 state 欄位
      - `DailyQuotaUsage` 初始值新增 `vocabularyAnalysisRequestCount: 0`、`vocabularyAnalysisTotalTokens: 0`
    - `src/views/DashboardView.vue`：
      - 在配額 Tooltip 中新增一行顯示「字典分析」的請求次數和 token 用量
      - 使用 `t('dashboard.vocabularyAnalysis')` i18n key
      - 若 `vocabularyAnalysisRequestCount === 0` 則不顯示此行（避免功能關閉時佔位）

- [x] Task 17: 更新前端測試
  - Files: `tests/unit/use-vocabulary-store.test.ts`, `tests/unit/use-voice-flow-store.test.ts`
  - Action: 為新增功能加入測試
  - Notes:
    - VocabularyStore 測試：
      - `addAiSuggestedTerm()` 正確插入 source='ai'
      - `batchIncrementWeights()` 正確更新 weight
      - `getTopTermListByWeight()` 回傳正確排序和數量
      - `manualTermList` / `aiSuggestedTermList` computed 正確過濾
    - VoiceFlowStore 測試：
      - 權重更新在 completePasteFlow 後被呼叫
      - `isSmartDictionaryEnabled = false` 時不啟動修正偵測
      - mock `start_correction_monitor` 和 `read_focused_text_field`

- [x] Task 18: 更新 CLAUDE.md IPC 契約表
  - File: `CLAUDE.md`
  - Action: 新增 commands 和 events 到契約表
  - Notes:
    - Tauri Commands 新增：
      - `read_focused_text_field` | `plugins/text_field_reader.rs` | useVoiceFlowStore | — | `Result<Option<String>, String>`
      - `start_correction_monitor` | `plugins/keyboard_monitor.rs` | useVoiceFlowStore | `app: AppHandle` | `()`
    - Rust → Frontend Events 新增：
      - `correction-monitor:result` | keyboard_monitor.rs | `CORRECTION_MONITOR_RESULT` | `CorrectionMonitorResultPayload`
    - Frontend-only Events 新增：
      - `vocabulary:learned` | `VOCABULARY_LEARNED` | VoiceFlowStore | HUD

### Acceptance Criteria

- [ ] AC 1: Given 使用者完成轉錄且字典詞出現在輸出中，when 文字貼上後，then 對應字典詞 weight 自動 +1
- [ ] AC 2: Given 字典有 60 個詞，when Whisper 轉錄時，then 只有 weight 前 50 個詞被送入 prompt
- [ ] AC 3: Given 字典有 60 個詞，when AI 增強時，then 只有 weight 前 50 個詞被送入 system prompt
- [ ] AC 4: Given 智慧字典學習已啟用，when 轉錄貼上後使用者未按任何鍵（5 秒內），then 不觸發 AX 讀取和 AI 分析
- [ ] AC 5: Given 智慧字典學習已啟用，when 轉錄貼上後使用者修正文字並按 Enter，then 立即觸發 AX 讀取 → AI 分析
- [ ] AC 6: Given 智慧字典學習已啟用，when 轉錄貼上後使用者修正文字但未按 Enter，then 3 秒 idle 後觸發 AX 讀取 → AI 分析
- [ ] AC 7: Given AI 分析回傳新詞（字典中不存在），when 處理結果時，then 自動加入字典（source='ai', weight=1）且 HUD 以 expanded mode 顯示「新增字典」label + 詞彙列表，並播放 Glass 音效
- [ ] AC 8: Given AI 分析回傳的詞已存在字典中，when 處理結果時，then 不重複加入，但 weight += 1
- [ ] AC 9: Given AI 分析回傳空陣列，when 處理結果時，then 不做任何字典操作，不顯示 HUD
- [ ] AC 10: Given 智慧字典學習已關閉，when 轉錄貼上後，then 不啟動修正偵測流程
- [ ] AC 11: Given DictionaryView 頁面，when 字典有 AI 推薦和手動詞條，then 分兩個區塊顯示，各自按 weight DESC 排序
- [ ] AC 12: Given DictionaryView 頁面，when 詞條有不同 weight，then 用 Badge variant 區分高頻/中頻/冷門
- [ ] AC 13: Given AX 讀取失敗（不是文字欄位、使用者已切換 app），when 修正偵測流程中，then 靜默放棄，不影響使用者
- [ ] AC 14: Given 修正偵測超過 15 秒硬上限，when Phase 2 進行中，then 強制觸發 AX 讀取結束監控
- [ ] AC 15: Given 有 vocabulary_analysis API 呼叫記錄，when 開啟 Dashboard，then 顯示此項目的成本統計
- [ ] AC 16: Given 使用者在 LINE 修正文字後按 Enter（文字欄位被清空），when 修正偵測觸發 AI 分析，then 使用 Enter 前的 snapshot 文字（非清空後的空字串）
- [ ] AC 17: Given 使用者修正文字但 AX 讀到的 fieldText 仍完整包含 pastedText，when 修正偵測比對，then 判定為未修改，不觸發 AI 分析
- [ ] AC 18: Given 字典有英文詞「AI」，when 轉錄輸出包含「KAISER」，then 不計為命中（word boundary 匹配）

## Additional Context

### Dependencies

- **macOS**: `core-foundation` crate 0.10（已存在）— 用於 CFString、CFRange 操作
- **macOS**: Accessibility framework — 透過 `extern "C"` FFI 宣告 AX API（與 hotkey_listener.rs 使用同一套權限）
- **Windows**: `windows` crate 0.61（已存在）— 需確認 `Win32_UI_Accessibility` feature 是否已啟用，若無需新增
- **Groq Chat API** — 複用現有的 API key 和呼叫模式（同 enhancer.ts）
- 無新增外部 crate 依賴

### Testing Strategy

**Rust 端：**
- `keyboard_monitor.rs`：測試新增的 state 欄位初始值、Phase 1/2 計時邏輯（利用 mock Instant）
- `text_field_reader.rs`：測試 no-op fallback（非支援平台）、截取邏輯的邊界情況（游標在開頭/結尾/中間）
- AX API 實際呼叫無法在 CI 測試，需手動測試

**前端：**
- `useVocabularyStore`：新增方法的單元測試（mock SQLite）
- `useVoiceFlowStore`：修正偵測流程的整合測試（mock Tauri commands + events）
- `vocabularyAnalyzer.ts`：AI prompt 回傳解析測試（正常 JSON、空陣列、非 JSON 回傳）

**手動測試：**
- macOS：轉錄 → 修正 → 確認 HUD 顯示學習通知
- 確認已存在的詞不重複加入但 weight 增加
- 確認不是文字欄位（例如在桌面上）時靜默放棄
- 確認 DictionaryView 正確分區和排序
- 確認 Dashboard 顯示 vocabulary_analysis 成本
- 確認關閉開關後不觸發修正偵測

### Notes

- **隱私保障**：AX 讀取的文字只取游標前後 50 字（不是整份文件），且只送給 AI 做分析，不儲存原文到 DB。correction_log 表不在 scope 內。
- **權限複用**：SayIt 已有 Accessibility 權限（CGEventTap 需要），AXUIElement 讀取使用同一權限，使用者不會看到任何新的權限請求。
- **成本控制**：每次修正偵測最多觸發一次 Groq Chat API 呼叫（token 很少，~100 prompt + ~50 completion）。只有在偵測到按鍵活動且 AX 讀取成功時才呼叫。功能預設關閉。
- **Phase 2 硬上限 15 秒的理由**：15 秒內使用者能完成大部分修正。超過 15 秒的操作很可能已經是在做其他事，讀取到的文字會包含不相關內容。30 秒太長容易引入雜訊。
- **Enter vs idle 的取捨 + Snapshot 機制**：Enter 在通訊軟體（LINE、Slack、Teams）中是「送出訊息」的動作，按 Enter 後文字欄位會清空。因此 Phase 2 期間持續做 snapshot（每 500ms 預讀一次）。Enter 觸發時先嘗試 fresh read，若成功且非空則用 fresh read（適用於筆記型 app），若為空則 fallback 用最後一個成功的 snapshot（適用於 LINE 等通訊 app）。筆記型 app 使用者不一定按 Enter，所以 idle 3 秒 + 最終讀取作為 fallback。
- **IME Enter 去抖**：IME 輸入法選字時也會產生 Enter keyDown 事件，為避免誤判，Rust 端加入 500ms debounce timer。Enter keyDown 後等 500ms，期間若有新按鍵則重置 timer（代表使用者只是在選字），只有 500ms 無新按鍵才確認為真正的 Enter。
- **Windows UI Automation 延後實作**：Task 8 中 Windows 為 no-op placeholder。建議在 Phase 1（權重系統）完成並驗證後，再補上 Windows 的 `IUIAutomation` 實作。
- **api_usage 表 CHECK constraint**：v3 migration 中透過 CREATE-SELECT-DROP-RENAME 重建 `api_usage` 表，將 CHECK 從 `('whisper', 'chat')` 擴展為 `('whisper', 'chat', 'vocabulary_analysis')`。

### Adversarial Review 修正摘要

| Finding | 嚴重度 | 修正方式 |
|---------|--------|---------|
| F1: api_usage CHECK constraint 擋 INSERT | Critical | Task 1: v3 migration 重建 api_usage 表 |
| F2: vocabulary_analysis 的 transcription_id 來源 | Critical | Task 11: closure 中明確 capture `record.id` |
| F3: quality monitor 和 correction monitor 競爭 | High | Technical Decisions: 明確兩者 flag 完全獨立 |
| F4: kAXSelectedTextRangeAttribute 是 CFRange | High | Task 8: 明確處理 location/length |
| F5: AXWebArea 回傳整頁 DOM 文字 | High | Task 8: 優先找 WebArea focused child |
| F6: batchIncrementWeights SQL 陣列參數 | High | Task 3: 改用逐一 UPDATE 迴圈 |
| F7: includes() 英文子字串誤判 | Medium | Task 4: 英文用 word boundary，中文用 includes |
| F8: fieldText === pastedText 檢查不合理 | Medium | Task 11: 改為 fieldText.includes(pastedText) |
| F9: Phase 1 等滿 5 秒才進 Phase 2 | Medium | Task 7: 首次按鍵立即進入 Phase 2 |
| F10: addAiSuggestedTerm 缺少事件 | Medium | Task 3: 明確要 emit VOCABULARY_CHANGED |
| F11: ApiType 型別未包含新值 | Medium | Task 2: 更新 ApiType union |
| F12: Dashboard quota 只處理 2 個分支 | Medium | Task 16: 補上具體 state/query/UI |
| F13: UI 文字未走 i18n | Low | Task 6/13/15: 全改用 t() |
| F14: Task 12 應在 Task 11 之前 | Low | Implementation Priority: 修正順序 |
| F15: LINE 按 Enter 清空文字欄位 | Critical | Task 11: Snapshot 機制（Phase 2 持續預讀） |

### Implementation Priority

```
Phase 1 — 權重系統（獨立，不依賴 AX）
  Task 1 → 2 → 3 → 4 → 5 → 6

Phase 2 — 修正偵測 + AI 分析
  Task 12 → 14 → 7 → 8 → 9 → 10 → 11
  (Task 12 提前：Task 11 依賴 settingsStore.isSmartDictionaryEnabled)
  (Task 14 提前：Task 7/11 依賴 event 常量定義)

Phase 3 — UI 通知 + Dashboard + Settings
  Task 13 → 15 → 16

Phase 4 — 測試 + 文件
  Task 17 → 18
```

### Post-Implementation Review 修正摘要

| Finding | 嚴重度 | 處理方式 |
|---------|--------|---------|
| F1: v2→v3 migration 無 transaction 保護 | High | `database.ts`: 整個 migration 包進 BEGIN/COMMIT/ROLLBACK |
| F2: analyzeCorrections 送全文 excerpt 截斷 | Low | 接受現狀：短語音場景超過 100 字為少數 |
| F3: 全文送 API 成本 | Low | 同 F2，接受現狀 |
| F4+F6: correction monitor listener 洩漏 | High | `useVoiceFlowStore.ts`: 新增模組級 unlisten 追蹤 + 3 處清除點 |
| F9: Windows text_field_reader no-op | Medium | 接受現狀：UIA 複雜度高，spec 明確延後 |
| F10: batchIncrementWeights 在 hot path 上阻塞 | Medium | `useVoiceFlowStore.ts`: 改為 fire-and-forget + .catch() |

### Manual Testing 修正摘要

| Finding | 嚴重度 | 處理方式 |
|---------|--------|---------|
| T1: HUD VOCABULARY_LEARNED 通知不顯示（window 已 hide） | High | `useVoiceFlowStore.ts`: emit 後呼叫 `appWindow.show()` + 2.8 秒 auto-hide timer |
| T2: IME 選字 Enter 被誤判為送出 Enter | High | `keyboard_monitor.rs`: Enter keyDown 加 500ms debounce timer |
| T3: Snapshot polling 2 秒太慢，抓到 IME 選字前的舊文字 | Medium | `useVoiceFlowStore.ts`: `SNAPSHOT_POLL_INTERVAL_MS` 從 2000 降至 500 |
| T4: Enter 觸發只用 snapshot，筆記型 app 可直接 fresh read | Medium | `useVoiceFlowStore.ts`: Enter 觸發時先嘗試 fresh read，空值才 fallback snapshot |
| T5: HUD 通知無音效 | Enhancement | `sound_feedback.rs`: 新增 `play_learned_sound`（macOS: Glass.aiff） |
| T6: HUD 通知改為 expanded layout + label/terms 分行 | Enhancement | `NotchHud.vue`: expanded mode，上排 icon + label，下排 terms |
| T7: DictionaryView 缺少說明文字 | Enhancement | `DictionaryView.vue`: 新增 Info icon + description + weightDescription |
| T8: MAX_WHISPER_PROMPT_TERMS 應為 50 | Medium | `transcription.rs` + `useVoiceFlowStore.ts` + i18n: 統一為 50 |
