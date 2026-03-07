use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};

const MONITOR_DURATION_MS: u64 = 5000;
const CANCEL_CHECK_INTERVAL_MS: u64 = 100;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct QualityMonitorResultPayload {
    was_modified: bool,
}

pub struct KeyboardMonitorState {
    pub is_monitoring: Arc<AtomicBool>,
    pub was_modified: Arc<AtomicBool>,
    pub cancel_token: Arc<AtomicBool>,
}

impl KeyboardMonitorState {
    pub fn new() -> Self {
        let is_monitoring = Arc::new(AtomicBool::new(false));
        let was_modified = Arc::new(AtomicBool::new(false));

        // 啟動持久的平台鍵盤監聽器（建立一次，永不銷毀）
        // 靠 is_monitoring flag 控制是否處理事件
        // 避免每次轉錄重新建立/銷毀 CGEventTap — 這是幽靈 Enter 的根因
        #[cfg(target_os = "macos")]
        {
            let m = is_monitoring.clone();
            let w = was_modified.clone();
            std::thread::Builder::new()
                .name("keyboard-monitor".to_string())
                .spawn(move || run_persistent_event_tap(m, w))
                .ok();
        }

        #[cfg(target_os = "windows")]
        {
            let m = is_monitoring.clone();
            let w = was_modified.clone();
            std::thread::Builder::new()
                .name("keyboard-monitor".to_string())
                .spawn(move || run_persistent_hook(m, w))
                .ok();
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        println!("[keyboard-monitor] Platform not supported, keyboard monitoring disabled");

        Self {
            is_monitoring,
            was_modified,
            cancel_token: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn shutdown(&self) {
        if self.is_monitoring.load(Ordering::SeqCst) {
            self.cancel_token.store(true, Ordering::SeqCst);
        }
    }
}

/// 分段等待，定期檢查 cancel_token。回傳 true 表示被取消。
fn wait_with_cancellation(
    cancel_token: &Arc<AtomicBool>,
    duration_ms: u64,
    check_interval_ms: u64,
) -> bool {
    let iterations = duration_ms / check_interval_ms;
    for _ in 0..iterations {
        if cancel_token.load(Ordering::SeqCst) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(check_interval_ms));
    }
    false
}

fn emit_result<R: Runtime>(app_handle: &AppHandle<R>, was_modified: bool) {
    let payload = QualityMonitorResultPayload { was_modified };
    let _ = app_handle.emit("quality-monitor:result", payload);
    #[cfg(debug_assertions)]
    println!(
        "[keyboard-monitor] Emitted result: wasModified={}",
        was_modified
    );
}

// ========== macOS: Persistent CGEventTap ==========

#[cfg(target_os = "macos")]
mod macos_keycodes {
    pub const BACKSPACE: u16 = 51;
    pub const DELETE: u16 = 117;
}

#[cfg(target_os = "macos")]
fn run_persistent_event_tap(is_monitoring: Arc<AtomicBool>, was_modified: Arc<AtomicBool>) {
    use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
    use core_graphics::event::{
        CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType,
    };

    let tap_result = CGEventTap::new(
        CGEventTapLocation::Session,
        CGEventTapPlacement::HeadInsertEventTap,
        CGEventTapOptions::ListenOnly,
        vec![CGEventType::KeyDown],
        move |_proxy, _event_type, event| {
            if is_monitoring.load(Ordering::SeqCst) {
                let keycode = event.get_integer_value_field(
                    core_graphics::event::EventField::KEYBOARD_EVENT_KEYCODE,
                ) as u16;

                if keycode == macos_keycodes::BACKSPACE || keycode == macos_keycodes::DELETE {
                    was_modified.store(true, Ordering::SeqCst);
                    #[cfg(debug_assertions)]
                    println!(
                        "[keyboard-monitor] Detected modify key: keycode={}",
                        keycode
                    );
                }
            }
            None
        },
    );

    match tap_result {
        Ok(tap) => {
            println!("[keyboard-monitor] Persistent CGEventTap created");
            unsafe {
                let loop_source = tap
                    .mach_port
                    .create_runloop_source(0)
                    .expect("Failed to create runloop source");
                let run_loop = CFRunLoop::get_current();
                run_loop.add_source(&loop_source, kCFRunLoopCommonModes);
                tap.enable();
                CFRunLoop::run_current();
                println!("[keyboard-monitor] Persistent CGEventTap stopped");
            }
        }
        Err(()) => {
            eprintln!(
                "[keyboard-monitor] Failed to create CGEventTap (no Accessibility permission?)"
            );
        }
    }
}

// ========== Windows: Persistent Keyboard Hook ==========

#[cfg(target_os = "windows")]
fn run_persistent_hook(is_monitoring: Arc<AtomicBool>, was_modified: Arc<AtomicBool>) {
    use std::sync::OnceLock;

    const VK_BACK: u32 = 0x08;
    const VK_DELETE: u32 = 0x2E;
    const WM_KEYDOWN: u32 = 0x0100;
    const WM_SYSKEYDOWN: u32 = 0x0104;

    struct HookState {
        is_monitoring: Arc<AtomicBool>,
        was_modified: Arc<AtomicBool>,
    }

    static HOOK_STATE: OnceLock<HookState> = OnceLock::new();
    let _ = HOOK_STATE.set(HookState {
        is_monitoring,
        was_modified,
    });

    unsafe extern "system" fn hook_proc(
        n_code: i32,
        w_param: windows::Win32::Foundation::WPARAM,
        l_param: windows::Win32::Foundation::LPARAM,
    ) -> windows::Win32::Foundation::LRESULT {
        use windows::Win32::UI::WindowsAndMessaging::*;

        if n_code >= 0 {
            if let Some(state) = HOOK_STATE.get() {
                if state.is_monitoring.load(Ordering::SeqCst) {
                    let kbd = *(l_param.0 as *const KBDLLHOOKSTRUCT);
                    let w = w_param.0 as u32;

                    if w == WM_KEYDOWN || w == WM_SYSKEYDOWN {
                        if kbd.vkCode == VK_BACK || kbd.vkCode == VK_DELETE {
                            state.was_modified.store(true, Ordering::SeqCst);
                            #[cfg(debug_assertions)]
                            println!(
                                "[keyboard-monitor] Detected modify key: vkCode=0x{:02X}",
                                kbd.vkCode
                            );
                        }
                    }
                }
            }
        }

        CallNextHookEx(None, n_code, w_param, l_param)
    }

    unsafe {
        use windows::Win32::Foundation::*;
        use windows::Win32::UI::WindowsAndMessaging::*;

        match SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook_proc), None, 0) {
            Ok(hook) => {
                println!("[keyboard-monitor] Persistent Windows hook installed");
                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
                let _ = UnhookWindowsHookEx(hook);
                println!("[keyboard-monitor] Persistent Windows hook removed");
            }
            Err(e) => {
                eprintln!("[keyboard-monitor] Failed to install persistent hook: {}", e);
            }
        }
    }
}

// ========== Tauri Command ==========

#[tauri::command]
pub fn start_quality_monitor<R: Runtime>(app: AppHandle<R>) {
    let state = app.state::<KeyboardMonitorState>();

    // 若已有監控進行中，先取消
    if state.is_monitoring.load(Ordering::SeqCst) {
        #[cfg(debug_assertions)]
        println!("[keyboard-monitor] Cancelling previous monitor session");
        state.cancel_token.store(true, Ordering::SeqCst);
        std::thread::sleep(Duration::from_millis(150));
    }

    // 重置狀態
    state.was_modified.store(false, Ordering::SeqCst);
    state.is_monitoring.store(true, Ordering::SeqCst);
    state.cancel_token.store(false, Ordering::SeqCst);

    #[cfg(debug_assertions)]
    println!("[keyboard-monitor] Starting quality monitor");

    // 計時器：5 秒後結束監控並回傳結果
    // 持久 CGEventTap/Hook 已在背景運行，這裡只控制 flag 和計時
    let is_monitoring = state.is_monitoring.clone();
    let was_modified = state.was_modified.clone();
    let cancel_token = state.cancel_token.clone();

    std::thread::spawn(move || {
        let cancelled = wait_with_cancellation(
            &cancel_token,
            MONITOR_DURATION_MS,
            CANCEL_CHECK_INTERVAL_MS,
        );
        if cancelled {
            #[cfg(debug_assertions)]
            println!("[keyboard-monitor] Monitoring cancelled");
        }
        is_monitoring.store(false, Ordering::SeqCst);
        emit_result(&app, was_modified.load(Ordering::SeqCst));
    });
}

// ========== Tests ==========

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keyboard_monitor_state_initial_values() {
        let state = KeyboardMonitorState::new();
        assert!(!state.is_monitoring.load(Ordering::SeqCst));
        assert!(!state.was_modified.load(Ordering::SeqCst));
        assert!(!state.cancel_token.load(Ordering::SeqCst));
    }

    #[test]
    fn test_state_reset_logic() {
        let state = KeyboardMonitorState::new();
        state.is_monitoring.store(true, Ordering::SeqCst);
        state.was_modified.store(true, Ordering::SeqCst);
        state.cancel_token.store(true, Ordering::SeqCst);

        // 模擬重置
        state.was_modified.store(false, Ordering::SeqCst);
        state.is_monitoring.store(true, Ordering::SeqCst);
        state.cancel_token.store(false, Ordering::SeqCst);

        assert!(state.is_monitoring.load(Ordering::SeqCst));
        assert!(!state.was_modified.load(Ordering::SeqCst));
        assert!(!state.cancel_token.load(Ordering::SeqCst));
    }

    #[test]
    fn test_cancel_token_stops_monitoring() {
        let state = KeyboardMonitorState::new();
        state.is_monitoring.store(true, Ordering::SeqCst);

        // 設定取消
        state.cancel_token.store(true, Ordering::SeqCst);

        assert!(state.cancel_token.load(Ordering::SeqCst));
    }

    #[test]
    fn test_wait_with_cancellation_normal_expiry() {
        let cancel_token = Arc::new(AtomicBool::new(false));
        let cancelled = wait_with_cancellation(&cancel_token, 200, 100);
        assert!(!cancelled);
    }

    #[test]
    fn test_wait_with_cancellation_cancelled() {
        let cancel_token = Arc::new(AtomicBool::new(false));
        let cancel_clone = cancel_token.clone();

        // 另一個執行緒在 50ms 後取消
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50));
            cancel_clone.store(true, Ordering::SeqCst);
        });

        let cancelled = wait_with_cancellation(&cancel_token, 5000, 100);
        assert!(cancelled);
    }
}
