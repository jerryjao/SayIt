mod plugins;

use tauri::{
    command,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

#[command]
fn debug_log(level: String, message: String) {
    match level.as_str() {
        "error" => eprintln!("[webview:ERROR] {}", message),
        "warn" => println!("[webview:WARN] {}", message),
        _ => println!("[webview] {}", message),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(plugins::fn_key_listener::init())
        .invoke_handler(tauri::generate_handler![
            debug_log,
            plugins::clipboard_paste::paste_text
        ])
        .setup(|app| {
            let quit_item = MenuItem::with_id(app, "quit", "Quit NoWayLM Voice", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_item])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("NoWayLM Voice")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                if let Ok(monitor) = window.current_monitor() {
                    if let Some(monitor) = monitor {
                        let screen_width = monitor.size().width as f64 / monitor.scale_factor();
                        let window_width = 320.0;
                        let x = (screen_width - window_width) / 2.0;
                        let _ = window.set_position(tauri::PhysicalPosition::new(
                            (x * monitor.scale_factor()) as i32,
                            0,
                        ));
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
