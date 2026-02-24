# NoWayLM Voice — POC 規格書

**文件建立日期：** 2026-02-23
**文件更新日期：** 2026-02-24 13:37:40
**狀態：** Draft — 待 Review

---

## 決策紀錄（2026-02-24）

### UI 方向收斂

- 採用 **Boring Notch 風格** 的視覺語言與動畫節奏
- POC v1 僅做 **非互動式狀態 HUD**（錄音中 / 轉錄中 / 完成 / 錯誤）
- 不追求 macOS 系統層「原生 Dynamic Island」整合；目標是 **高相似度體驗**

### 實作策略

- 以 **Tauri 自製 UI** 為主，參考現有 Open Source（如 Boring Notch / DynamicNotchKit 類）設計思路
- 不將特定 macOS 原生套件（如 SwiftUI library）納入 POC 必要依賴
- 將 HUD 呈現層與錄音/轉錄流程分離，保留未來替換為原生實作的空間

### 跨平台策略（產品方向）

- macOS：Notch-style HUD（貼近瀏海區域）
- Windows：上方置中膠囊 HUD（沿用相同視覺語言與狀態機）
- Windows 熱鍵不綁定 `Fn`，改為可設定快捷鍵（例如 `F5` 或其他組合鍵）

### Phase 2 定義調整

- 若 v1 僅需非互動式 HUD，則 **不需要額外 Phase 2**
- 僅當需求升級為「可互動式 notch panel」（點擊展開、控制項、歷史紀錄等）時，才開啟 Phase 2（含 macOS 原生橋接評估）

---

## 目標

用最小範圍驗證「按住 Fn 鍵錄音 → 語音轉文字 → 自動貼進任何 App」的完整技術流程。

**POC 成功標準：**
1. 按住 Fn → 出現 Boring Notch 風格 HUD 提示 → 開始錄音
2. 放開 Fn → 停止錄音 → 送 Groq Whisper API → 取得文字
3. 文字自動貼進當前焦點的任何 App（Slack、Notion、Word 等）
4. 整體延遲 < 3 秒（放開到文字出現）

---

## 技術架構

```
+--------------------------------------------------+
|  Tauri Desktop App（System Tray 常駐）             |
|                                                    |
|  Rust Plugin Layer:                                |
|  ┌──────────────────────────────────────────────┐  |
|  │  fn_key_listener (CGEventTap)                │  |
|  │  - 監聽 Fn key down / up                     │  |
|  │  - 需要 Accessibility 權限                   │  |
|  └──────────────────┬───────────────────────────┘  |
|                     │ Event                        |
|                     v                              |
|  ┌──────────────────────────────────────────────┐  |
|  │  WebView (Svelte / Vue)                      │  |
|  │  - Notch-style 狀態 HUD UI                  │  |
|  │  - MediaRecorder 錄音                        │  |
|  │  - 呼叫 Groq Whisper API                     │  |
|  └──────────────────┬───────────────────────────┘  |
|                     │ 轉錄結果                     |
|                     v                              |
|  ┌──────────────────────────────────────────────┐  |
|  │  clipboard_paste (Rust)                      │  |
|  │  - 備份剪貼簿                                │  |
|  │  - 寫入轉錄文字                              │  |
|  │  - 模擬 Cmd+V                                │  |
|  │  - 還原剪貼簿                                │  |
|  └──────────────────────────────────────────────┘  |
+--------------------------------------------------+
```

---

## 技術棧

| 項目 | 選型 | 說明 |
|------|------|------|
| 桌面框架 | **Tauri v2** | 輕量跨平台 |
| 前端 | **Svelte** (同 Whispering) 或 **Vue** (同 NoWayLM) | POC 階段擇一 |
| 語言 | **Rust** (後端) + **TypeScript** (前端) | |
| 語音辨識 | **Groq Whisper API** | 低延遲雲端轉錄 |
| 套件管理 | **Bun** 或 **pnpm** | |

---

## 功能模組明細

### 模組 1：Fn 鍵監聽（Rust Plugin）

**目標：** 在 macOS 上捕捉 Fn 鍵的按下/放開事件

**技術做法：**
- 使用 `CGEventTapCreate` 建立系統級事件攔截器
- 監聽 `flagsChanged` 事件中的 `kCGEventFlagMaskSecondaryFn` flag
- Fn down → emit `recording-start` 事件到前端
- Fn up → emit `recording-stop` 事件到前端

**需要的權限：**
- macOS「輔助使用（Accessibility）」權限
- App 啟動時需引導使用者授權

**跨平台策略（POC 範圍外）：**
- Windows 可改用 F5 或可自訂按鍵

---

### 模組 2：麥克風錄音（前端 WebView）

**目標：** 在 Fn 按下時開始錄音，放開時停止

**技術做法：**
- 使用 `navigator.mediaDevices.getUserMedia()` 取得麥克風
- 使用 `MediaRecorder` API 錄製音訊
- 輸出格式：`audio/webm` 或 `audio/wav`
- 錄音時顯示 Notch-style 狀態 HUD

**錄音流程：**
```
Fn down 事件
    → getUserMedia (首次需使用者允許麥克風)
    → new MediaRecorder(stream)
    → recorder.start()
    → UI 顯示「錄音中...」

Fn up 事件
    → recorder.stop()
    → 收集 audio blob
    → UI 顯示「轉錄中...」
    → 送出 API 請求
```

---

### 模組 3：Groq Whisper API 串接

**目標：** 將錄音音訊送到 Groq API 取得轉錄文字

**API Endpoint：**
```
POST https://api.groq.com/openai/v1/audio/transcriptions
Headers:
  Authorization: Bearer <GROQ_API_KEY>
Content-Type: multipart/form-data
Body:
  file: <audio_blob>
  model: "whisper-large-v3"
  language: "zh"          # 繁體中文
  response_format: "text"
```

**POC 階段 API Key 管理：**
- 直接寫在環境變數 `.env` 中
- 未來正式版改走 NoWayLM 後端中繼

---

### 模組 4：剪貼簿注入（Rust Plugin）

**目標：** 將轉錄文字貼進當前焦點的任何 App

**技術做法：**
```
1. 讀取並備份目前剪貼簿內容 (NSPasteboard / arboard crate)
2. 將轉錄文字寫入剪貼簿
3. 模擬按下 Cmd+V (CGEventCreateKeyboardEvent)
4. 等待 100ms
5. 還原原本的剪貼簿內容
```

**使用的 Rust Crates：**
- `arboard` — 跨平台剪貼簿操作
- `enigo` 或 `core-graphics` — 模擬鍵盤按鍵

---

### 模組 5：Notch-style 狀態 HUD（Boring Notch 風格）

**目標：** 提供視覺回饋讓使用者知道目前狀態

**UI 狀態機：**
```
[待機] ──Fn down──► [錄音中 🔴] ──Fn up──► [轉錄中 ⏳] ──完成──► [成功 ✓] ──► [待機]
                                                          |
                                                       [錯誤 ⚠]
```

**視覺設計（POC v1）：**
- 膠囊型 HUD（Boring Notch 風格，非互動）
- 預設尺寸約 `240~320x56~72px`（依狀態可微幅伸縮）
- 顯示位置：
  - 有瀏海 Mac：螢幕上方置中，貼近瀏海下緣
  - 無瀏海 Mac / 外接螢幕 / Windows：螢幕上方置中
- 錄音中：紅點脈衝 / 波形動畫 + 「錄音中...」
- 轉錄中：loading spinner + 「轉錄中...」
- 成功：短暫顯示「已貼上」後自動收起（約 `0.8~1.2s`）
- 錯誤：顯示錯誤提示後自動收起或回待機

**v1 範圍限制：**
- 不支援滑鼠互動（點擊、拖曳、展開）
- 不支援歷史紀錄或操作面板
- 以狀態提示為主，不承載複雜 UI 控制項

---

## 專案結構（在 NoWayLM monorepo 中）

```
NoWayLM/
  packages/
    voice-desktop/              # ← POC 專案
      src/                      # 前端 (Svelte/Vue)
        App.svelte              # 主 UI
        lib/
          recorder.ts           # 錄音邏輯
          transcriber.ts        # Groq API 串接
      src-tauri/                # Rust 後端
        src/
          main.rs               # Tauri 入口
          plugins/
            fn_key_listener.rs  # Fn 鍵監聽 plugin
            clipboard_paste.rs  # 剪貼簿注入 plugin
        Cargo.toml
        tauri.conf.json
      .env                      # GROQ_API_KEY（不進版控）
      package.json
      vite.config.ts
```

---

## 不包含（POC 範圍外）

| 項目 | 原因 |
|------|------|
| NoWayLM 後端串接 | POC 直連 Groq API |
| NoWayLM 帳號登入 | POC 不需要認證 |
| Windows 支援 | POC v1 仍先驗證 macOS；UI 設計已定義 Windows fallback（上方置中膠囊 HUD） |
| 靜音偵測自動停止 | POC 用 Fn 放開即停止 |
| 使用者設定頁面 | POC 硬編碼設定 |
| 自動更新 | POC 不需要 |
| 安裝包打包(.dmg) | POC 用 `bun dev` / `cargo tauri dev` 執行 |

---

## 預估開發時間

| 模組 | 工時 |
|------|------|
| Tauri v2 專案初始化 | 0.5 天 |
| Fn 鍵監聽 Rust Plugin | 1 天 |
| 麥克風錄音 | 0.5 天 |
| Groq Whisper API 串接 | 0.5 天 |
| 剪貼簿注入 | 0.5 天 |
| Notch-style 狀態 HUD | 0.5 天 |
| 整合測試 + Debug | 0.5 天 |
| **合計** | **~4 天** |

---

## 驗收檢查清單

- [ ] 按住 Fn 鍵時出現 Boring Notch 風格 HUD（顯示「錄音中」）
- [ ] 放開 Fn 鍵時停止錄音並顯示 HUD「轉錄中」
- [ ] 轉錄完成後 HUD 顯示成功狀態並自動收起
- [ ] 在 Notes.app 中使用 → 文字正確貼入
- [ ] 在 Slack 中使用 → 文字正確貼入
- [ ] 在瀏覽器輸入框中使用 → 文字正確貼入
- [ ] 中文語音辨識結果正確可讀
- [ ] 整體延遲 < 3 秒
- [ ] 首次啟動正確引導 Accessibility 權限
