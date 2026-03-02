---
project_name: 'sayit'
user_name: 'Jackle'
date: '2026-03-03'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 84
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Technologies

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Desktop Framework | Tauri | v2.10.x | 雙視窗、System Tray、macOS Private API |
| Frontend | Vue 3 | ^3.5 | Composition API only（禁止 Options API） |
| Language (Frontend) | TypeScript | ^5.7 | strict mode 啟用 |
| Language (Backend) | Rust | 2021 edition | — |
| CSS | Tailwind CSS | ^4 | v4 使用 `@import "tailwindcss"` 語法 |
| UI 元件 | shadcn-vue | new-york style | 強制使用，詳見 ux-ui-design-spec.md |
| State Management | Pinia | ^3.0.4 | — |
| Router | vue-router | 5.0.3 | webHashHistory |
| Build | Vite | ^6 | 多入口（HUD + Dashboard） |
| Package Manager | pnpm | — | 必須使用 pnpm，不可用 npm/yarn |
| Node | 24 | .nvmrc 鎖定 | — |
| Test (Unit) | Vitest | ^4.0.18 | jsdom 環境 |
| Test (E2E) | Playwright | ^1.58.2 | — |

### Frontend Dependencies

| 套件 | 版本 | 用途 |
|------|------|------|
| `reka-ui` | ^2.8.2 | shadcn-vue 底層無頭 UI 庫 |
| `lucide-vue-next` | ^0.576.0 | 唯一允許的圖標庫 |
| `@vueuse/core` | ^14.2.1 | Vue Composition 工具函式 |
| `@tanstack/vue-table` | ^8.21.3 | 表格邏輯（DataTable 元件） |
| `@unovis/ts` + `@unovis/vue` | ^1.6.4 | 圖表庫（shadcn-vue chart 底層） |
| `class-variance-authority` | ^0.7.1 | CSS 變體管理（shadcn-vue 依賴） |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.5.0 | cn() 工具函式底層 |
| `@faker-js/faker` | ^10.3.0 | 開發用假資料（devDependency） |

### ⚠️ 已安裝但不應使用

| 套件 | 原因 |
|------|------|
| `@tabler/icons-vue` | UI 設計規範強制只用 `lucide-vue-next`，此套件為 dashboard-01 block 附帶安裝，新程式碼禁止使用 |

### Tauri Plugins（Rust + JS 雙端）

| Plugin | Rust Version | JS Version | 用途 |
|--------|-------------|-----------|------|
| `tauri-plugin-shell` | 2 | ^2 | Shell 操作 |
| `tauri-plugin-http` | 2 | ^2.5.7 | HTTP 請求（繞過 CORS） |
| `tauri-plugin-sql` | 2.3.1 | ^2.3.2 | SQLite 資料庫 |
| `tauri-plugin-autostart` | 2.5.1 | ^2.5.1 | 開機啟動 |
| `tauri-plugin-updater` | ~2.10.0 | ^2.10.0 | 應用更新 |
| `tauri-plugin-store` | ~2.4 | ^2.4.2 | 鍵值存儲（API Key） |

### Rust Platform Dependencies

| 套件 | 平台 | 用途 |
|------|------|------|
| `core-graphics` 0.24 + `core-foundation` 0.10 + `objc` 0.2 | macOS | 視窗控制、CGEventTap |
| `windows` 0.61 | Windows | Win32 API、鍵盤 Hook |
| `arboard` 3 | 跨平台 | 剪貼簿存取 |

### External APIs

- Groq Whisper API — `https://api.groq.com/openai/v1/audio/transcriptions`（模型：`whisper-large-v3`）
- Groq LLM API — AI 文字整理（5 秒 timeout）
- CSP 白名單：`connect-src 'self' https://api.groq.com`

## Critical Implementation Rules

### Language-Specific Rules

#### TypeScript

- **strict mode 啟用** — `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` 全部開啟
- **target ES2021** — 可使用 `Promise.allSettled()`, `??`, `?.`，不可使用 ES2022+ 特性
- **`import type` 分離** — 純型別匯入必須使用 `import type { Xxx }` 語法
- **模組系統** — ESNext modules（`"type": "module"`），匯入路徑不帶 `.ts` 副檔名
- **路徑別名** — `@/*` → `./src/*`（tsconfig.json + vite.config.ts 同步設定）
- **環境變數前綴** — 前端環境變數必須以 `VITE_` 或 `TAURI_` 開頭
- **錯誤訊息格式** — `err instanceof Error ? err.message : String(err)` 作為標準錯誤取值模式
- **錯誤訊息本地化** — 使用 `src/lib/errorUtils.ts` 集中管理使用者可見的錯誤訊息（繁體中文）

#### Rust

- **Tauri Command 簽名** — 必須加泛型 `<R: Runtime>` 約束，返回 `Result<T, CustomError>`
- **錯誤型別** — 使用 `thiserror` crate 定義 enum，且必須手動 `impl serde::Serialize`
- **平台隔離** — `#[cfg(target_os = "macos")]` / `#[cfg(target_os = "windows")]` 隔離，不可在同一函式中混合
- **unsafe 標記** — macOS `objc::msg_send!` 呼叫必須在 `unsafe {}` 區塊內
- **原子操作** — 跨執行緒共享狀態使用 `AtomicBool` + `Ordering::SeqCst`
- **Plugin 模式** — 每個功能模組是獨立的 `TauriPlugin<R>`，在 `plugins/mod.rs` 中 `pub mod` 匯出
- **Crate 命名** — `name = "sayit_lib"`，`crate-type = ["staticlib", "cdylib", "rlib"]`
- **Release profile** — `panic = "abort"`, `lto = true`, `opt-level = "s"`（檔案大小最佳化）

### Framework-Specific Rules

#### Vue 3 (Composition API)

- **僅使用 `<script setup lang="ts">`** — 禁止 Options API（data/methods/computed 物件語法）
- **Composable 模式** — 可複用邏輯封裝為 `useXxx()` 函式，放在 `src/composables/`
- **狀態暴露** — Composable 內部用 `ref()` 管理，對外返回 `readonly()` 防止直接修改
- **計算屬性** — 衍生狀態一律用 `computed()` 而非手動 watch + 賦值
- **元件命名** — SFC 檔案名 PascalCase，模板中使用 `<PascalCase />` 自閉合標籤
- **條件 class** — 使用 `:class="{ 'class-name': condition }"` 綁定語法

#### Pinia Store

- **Store ID** — kebab-case，如 `defineStore('settings', ...)`
- **Store 檔案** — `useXxxStore.ts` 放在 `src/stores/`
- **Store 是唯一的資料存取層** — views 不可直接呼叫 `lib/`，必須透過 store actions

#### Vue Router

- **History 模式** — `createWebHashHistory()`（Tauri WebView 不支援 HTML5 History）
- **路由定義** — `src/router.ts`，四個頁面路由：`/dashboard`、`/history`、`/dictionary`、`/settings`
- **預設路由** — `/` redirect 到 `/dashboard`

#### Tauri v2 通訊

- **前端 → Rust** — `invoke('command_name', { args })`
- **Rust → 前端** — `emit()` / `emitTo(windowLabel, event, payload)`
- **前端監聽** — `listen('event-name', callback)`，元件卸載時 `unlisten()`
- **Event 命名** — `{domain}:{action}` kebab-case（如 `voice-flow:state-changed`）
- **HTTP 請求** — 使用 `@tauri-apps/plugin-http` 的 `fetch`（非瀏覽器原生 fetch），繞過 CORS
- **視窗操作** — `getCurrentWindow()` 取得當前視窗實例
- **多入口架構** — HUD（`index.html` → `main.ts` → `App.vue`）和 Dashboard（`main-window.html` → `main-window.ts` → `MainApp.vue`）為獨立入口

#### Tailwind CSS v4

- **入口語法** — `@import "tailwindcss"`（非 v3 的 @tailwind 指令）
- **Vite 整合** — 透過 `@tailwindcss/vite` plugin，非 PostCSS 配置
- **色彩空間** — oklch（CSS 變數定義在 `src/style.css`）
- **自訂變體** — `@custom-variant dark (&:is(.dark *))`

#### UI 設計規範（強制）

- **規範文件** — `_bmad-output/planning-artifacts/ux-ui-design-spec.md`，所有 UI 實作必須遵循
- **設計稿先行** — 任何 UI 實作前必須先在 `design.pen` 完成設計稿並取得使用者確認
- **shadcn-vue 強制** — 所有 UI 元件使用 shadcn-vue（new-york style, neutral base），禁止手寫替代品
- **語意色彩** — 禁止 Tailwind 原生色彩（`zinc-*`, `teal-*`），必須用語意變數（`bg-primary`, `text-foreground`）
- **品牌色** — Teal 主題（`pnpm dlx shadcn-vue@latest init --theme teal`）
- **圖標** — 僅 `lucide-vue-next`，禁止 Emoji 和 `@tabler/icons-vue`
- **例外** — `NotchHud.vue` 和 `App.vue` 允許手寫 CSS（Notch 動畫引擎）

#### SQLite（tauri-plugin-sql）

- **初始化** — `src/lib/database.ts` 定義 schema，`main-window.ts` 中初始化
- **表命名** — 複數 snake_case（`transcriptions`, `vocabulary`）
- **欄位命名** — snake_case（`raw_text`, `was_enhanced`）
- **主鍵** — `TEXT PRIMARY KEY`（UUID）
- **時間戳** — `created_at TEXT DEFAULT (datetime('now'))`
- **操作限制** — SQLite 操作只從 Pinia store actions 發起，元件不可直接執行 SQL

### Testing Rules

#### 測試框架

- **單元/元件測試** — Vitest ^4.0.18（jsdom 環境，`test.globals: true`）
- **E2E 測試** — Playwright ^1.58.2（baseURL `http://localhost:1420`）
- **覆蓋率** — V8 provider（`@vitest/coverage-v8`）
- **Vue 測試工具** — `@vue/test-utils` ^2.4.6

#### 測試檔案組織

- **單元測試** — `tests/unit/**/*.test.ts`
- **元件測試** — `tests/component/**/*.test.ts`
- **E2E 測試** — `tests/e2e/`
- **覆蓋率排除** — `src/main.ts`、`src/main-window.ts`、`src/**/*.d.ts`

#### 測試執行指令

| 指令 | 用途 |
|------|------|
| `pnpm test` | Vitest 單次執行 |
| `pnpm test:watch` | Vitest 監看模式 |
| `pnpm test:coverage` | V8 覆蓋率報告 |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm test:e2e:ui` | Playwright UI 模式 |

#### 測試規則

- **不主動新增測試** — 除非 Story 明確要求或使用者指示，AI agents 不應自行建立測試
- **型別檢查作為品質門檻** — `vue-tsc --noEmit` 是 build 前自動執行的品質檢查
- **手動驗證重點** — E2E 流程：熱鍵觸發 → 錄音 → 轉錄 → (AI 整理) → 貼上，以及 HUD 狀態轉換
- **假資料** — 使用 `@faker-js/faker` 生成測試/開發用資料
- **Playwright 設定** — 完全並行、60s 測試 timeout、trace on-first-retry、screenshot only-on-failure

### Code Quality & Style Rules

#### 命名慣例

| 類型 | 慣例 | 範例 |
|------|------|------|
| Vue 元件檔案 | PascalCase | `NotchHud.vue`, `DashboardView.vue` |
| Composable 檔案 | camelCase + use 前綴 | `useTauriEvents.ts` |
| Service/Lib 檔案 | camelCase | `recorder.ts`, `transcriber.ts`, `errorUtils.ts` |
| Pinia Store 檔案 | camelCase + use 前綴 | `useSettingsStore.ts`, `useVoiceFlowStore.ts` |
| Rust 模組檔案 | snake_case | `clipboard_paste.rs`, `hotkey_listener.rs` |
| 資料夾 | kebab-case | `src-tauri/`, `components/` |
| TS 變數/函式 | camelCase | `startRecording()`, `enhancedText` |
| TS 型別/介面 | PascalCase + 後綴 | `TranscriptionRecord`, `HotkeyConfig` |
| TS 布林變數 | is/has/can/should 前綴 | `isRecording`, `wasEnhanced`, `hasApiKey` |
| TS 常數 | UPPER_SNAKE_CASE | `DEFAULT_PROMPT`, `API_TIMEOUT_MS` |
| Rust 函式/變數 | snake_case | `paste_text()`, `listen_hotkey()` |
| Rust 型別/Struct | PascalCase | `ClipboardError`, `HotkeyConfig` |
| SQLite table | 複數 snake_case | `transcriptions`, `vocabulary` |
| SQLite column | snake_case | `raw_text`, `was_enhanced` |
| Tauri Events | {domain}:{action} kebab-case | `voice-flow:state-changed` |
| Pinia Store ID | kebab-case | `defineStore('settings', ...)` |

#### 檔案組織規則

- **元件** → `src/components/`，**頁面** → `src/views/`
- **shadcn-vue 元件** → `src/components/ui/`（CLI 生成，不手動修改）
- **純邏輯（無 Vue 依賴）** → `src/lib/`
- **Vue 相關邏輯** → `src/composables/` 或 `src/stores/`
- **型別定義** → `src/types/`（`index.ts`, `settings.ts`, `events.ts`, `transcription.ts`, `vocabulary.ts`）
- **Rust plugin** → `src-tauri/src/plugins/`，一個檔案一個模組
- **依賴方向單向** — `views → components + stores + composables`，`stores → lib`，`lib → 外部 API`
- **禁止** `views/` 直接呼叫 `lib/`，必須透過 store

#### 日誌格式

- **TypeScript** — `console.log("[ModuleName] message")`
- **Rust** — `println!("[module-name] message")` / `eprintln!("[module-name] ERROR: message")`
- **所有日誌必須帶模組名前綴**

#### Linter/Formatter

- 目前無 ESLint / Prettier — 依賴 TypeScript strict mode + 手動一致性
- AI agents 應遵循現有程式碼風格，不主動新增 linting 工具

### Development Workflow Rules

#### 開發指令

| 指令 | 用途 |
|------|------|
| `pnpm tauri dev` | 開發模式（Vite dev server + Rust 編譯） |
| `pnpm build` | 型別檢查（vue-tsc）+ Vite 打包 + Cargo 編譯 + Tauri bundler |
| `pnpm preview` | 預覽編譯結果 |

#### 開發伺服器

- **前端** — `localhost:1420`（port strict mode）
- **HMR** — port 1421，當 `TAURI_DEV_HOST` 設定時使用 `ws://host:1421`
- **Vite watch 排除** — `**/src-tauri/**`，Rust 變更不觸發 HMR

#### 多入口架構

| 入口 | HTML | TS 入口 | Vue App | 用途 |
|------|------|--------|---------|------|
| HUD | `index.html` | `main.ts` | `App.vue` | Notch 浮動通知視窗 |
| Dashboard | `main-window.html` | `main-window.ts` | `MainApp.vue` | 主儀表板（含路由、DB 初始化） |

#### Git 慣例

- **Commit message** — Conventional Commits 格式（`feat:`, `fix:`, `refactor:` 等）
- **不主動 commit** — AI agents 完成修改後報告 git 狀態，等使用者指示
- **單一主題** — 每個 commit 聚焦一個主題，大量變更（20+ 檔案）分批 commit

#### 產出格式

- **macOS** — `.dmg`（含 `.app`），簽署用 `TAURI_SIGNING_PRIVATE_KEY` 環境變數
- **Windows** — `.msi` 或 NSIS `.exe`
- **自動更新** — `tauri-plugin-updater` + 自訂 endpoint

#### 環境變數

- **`VITE_GROQ_API_KEY`** — 開發時 Groq API Key（前端可存取）
- **`TAURI_SIGNING_PRIVATE_KEY`** — 建構簽署金鑰（僅 CI/CD）
- **`.env` 不進 git** — `.gitignore` 排除

### Critical Don't-Miss Rules

#### Anti-Patterns（絕對禁止）

- **❌ 瀏覽器原生 `fetch`** — 必須用 `@tauri-apps/plugin-http` 的 `fetch`，否則被 CSP 擋住或遇 CORS
- **❌ Options API** — 禁止 `data()`, `methods:`, `computed:` 物件語法
- **❌ views 直接呼叫 lib** — 頁面元件不可直接 import `lib/` 下的模組，必須透過 Pinia store
- **❌ SQLite 存 API Key** — API Key 只存在 `tauri-plugin-store`（`$APP_DATA/settings.json`），絕不進 SQLite
- **❌ 跨平台程式碼混合** — macOS 和 Windows 邏輯不可在同一函式中，必須用 `#[cfg]` 隔離
- **❌ 元件中直接執行 SQL** — SQLite 操作只從 Pinia store actions 發起
- **❌ 使用 `@tabler/icons-vue`** — 雖已安裝（dashboard-01 block 附帶），但 UI 規範強制只用 `lucide-vue-next`
- **❌ 手寫 Button/Input/Card/Dialog** — 必須安裝並使用 shadcn-vue 元件
- **❌ 使用 Tailwind 原生色彩** — `zinc-*`, `teal-*`, `red-*` 等全部禁止，用 `bg-primary`, `text-foreground` 等語意變數
- **❌ 未經設計稿確認就寫 UI** — 所有 UI 實作前必須先在 `design.pen` 完成設計稿並取得使用者確認
- **❌ 手動修改 `src/components/ui/`** — shadcn CLI 生成的元件不手動修改，透過 `cn()` 在使用端覆蓋

#### 資料映射陷阱

- **SQLite → TypeScript 欄位映射** — SQLite `snake_case` → TS `camelCase`，在 store action 中手動轉換
- **Tauri Event payload** — 一律 camelCase JSON，不是 Rust 的 snake_case
- **Rust Command 回傳** — `serde` 預設序列化為 snake_case JSON，前端需對應處理

#### 錯誤處理鏈路

- **Service 層（lib/）** — 拋出有意義的 `Error`，帶上下文訊息
- **Store 層** — `try/catch` 攔截 → 狀態更新 → 降級策略
- **Whisper API 失敗** → HUD 顯示錯誤，使用者可重試
- **LLM API 超時（5 秒）** → 跳過 AI 整理，直接貼上原始文字
- **Rust Command 失敗** → `Result<T, E>` 自動轉前端 Promise rejection
- **錯誤訊息本地化** — `src/lib/errorUtils.ts` 集中管理繁體中文錯誤訊息

#### 安全規則

- **CSP 硬限制** — `default-src 'self'; connect-src 'self' https://api.groq.com; style-src 'self' 'unsafe-inline'; script-src 'self'`
- **API Key 不出本地** — 只在 tauri-plugin-store 中，不上傳、不寫入日誌、不透過 Events 傳播
- **macOS 權限** — Accessibility 權限是全域熱鍵監聽的前提（CGEventTap）
- **macOS Entitlements** — 需 `Entitlements.plist`，`macOSPrivateApi: true`

#### 效能注意事項

- **HUD 動畫不阻塞主流程** — 狀態轉換透過 Tauri Events 驅動，非輪詢
- **E2E 延遲目標** — 含 AI < 3 秒、不含 AI < 1.5 秒
- **字數門檻** — 轉錄文字 < 10 字元跳過 AI 整理，直接貼上
- **idle 記憶體** — 目標 < 100MB
- **Release binary** — `lto = true`, `opt-level = "s"`, `strip = true`（最小化檔案大小）

#### Tauri 視窗配置

| 視窗 | 標籤 | 尺寸 | 特性 |
|------|------|------|------|
| HUD | `main` | 400×100 | transparent, alwaysOnTop, no decorations, skipTaskbar |
| Dashboard | `main-window` | 960×680（min 720×480） | decorations, resizable, 預設隱藏 |

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Reference `_bmad-output/planning-artifacts/architecture.md` for detailed architectural decisions
- Reference `_bmad-output/planning-artifacts/ux-ui-design-spec.md` for UI design rules, color system, component patterns, and page layouts

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review periodically for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-03-03
