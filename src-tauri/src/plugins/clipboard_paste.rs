use arboard::Clipboard;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, thiserror::Error)]
pub enum ClipboardError {
    #[error("Clipboard access failed: {0}")]
    ClipboardAccess(String),
    #[error("Keyboard simulation failed: {0}")]
    KeyboardSimulation(String),
}

impl serde::Serialize for ClipboardError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Simulate Cmd+V using CGEvent (more reliable on macOS than enigo)
#[cfg(target_os = "macos")]
fn simulate_paste() -> Result<(), String> {
    use core_graphics::event::{CGEvent, CGEventFlags, CGKeyCode};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

    // keycode 9 = 'v'
    const V_KEYCODE: CGKeyCode = 9;

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| "Failed to create CGEventSource")?;

    let key_down = CGEvent::new_keyboard_event(source.clone(), V_KEYCODE, true)
        .map_err(|_| "Failed to create key down event")?;
    key_down.set_flags(CGEventFlags::CGEventFlagCommand);

    let key_up = CGEvent::new_keyboard_event(source, V_KEYCODE, false)
        .map_err(|_| "Failed to create key up event")?;
    key_up.set_flags(CGEventFlags::CGEventFlagCommand);

    key_down.post(core_graphics::event::CGEventTapLocation::HID);
    key_up.post(core_graphics::event::CGEventTapLocation::HID);

    Ok(())
}

#[tauri::command]
pub fn paste_text<R: Runtime>(app: AppHandle<R>, text: String) -> Result<(), ClipboardError> {
    println!("[clipboard-paste] Pasting {} chars: \"{}\"", text.len(), text);

    // 1) Hide Tauri window so target app regains focus
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        println!("[clipboard-paste] Window hidden");
    }

    // 2) Wait for OS to switch focus back
    thread::sleep(Duration::from_millis(200));

    // 3) Write text to clipboard
    let mut clipboard =
        Clipboard::new().map_err(|e| ClipboardError::ClipboardAccess(e.to_string()))?;

    clipboard
        .set_text(&text)
        .map_err(|e| ClipboardError::ClipboardAccess(e.to_string()))?;

    // 4) Verify clipboard was set
    match clipboard.get_text() {
        Ok(content) => println!("[clipboard-paste] Clipboard verified: \"{}\"", content),
        Err(e) => println!("[clipboard-paste] Clipboard verify failed: {}", e),
    }

    // 5) Wait for clipboard to settle
    thread::sleep(Duration::from_millis(50));

    // 6) Simulate Cmd+V via CGEvent
    #[cfg(target_os = "macos")]
    {
        match simulate_paste() {
            Ok(()) => println!("[clipboard-paste] Cmd+V sent via CGEvent"),
            Err(e) => {
                println!("[clipboard-paste] CGEvent paste failed: {}, skipping auto-paste", e);
            }
        }
    }

    // 7) Do NOT restore clipboard — keep transcribed text available for manual paste
    println!("[clipboard-paste] Done (clipboard NOT restored)");
    Ok(())
}
