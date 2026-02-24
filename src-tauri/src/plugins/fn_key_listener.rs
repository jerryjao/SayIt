use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Emitter, Runtime,
};

#[cfg(target_os = "macos")]
use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
#[cfg(target_os = "macos")]
use core_graphics::event::{
    CGEventFlags, CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement,
    CGEventType,
};

static FN_IS_PRESSED: AtomicBool = AtomicBool::new(false);

/// Fn/Globe key keycode on macOS
#[cfg(target_os = "macos")]
const FN_KEYCODE: u16 = 63;

#[cfg(target_os = "macos")]
fn check_accessibility_permission() -> bool {
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
    }
    let trusted = unsafe { AXIsProcessTrusted() };
    println!("[fn-key-listener] AXIsProcessTrusted = {}", trusted);
    trusted
}

#[cfg(target_os = "macos")]
fn prompt_accessibility_permission() {
    use core_foundation::base::TCFType;
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::string::CFString;
    use std::ffi::c_void;

    extern "C" {
        fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;
    }

    let key = CFString::new("AXTrustedCheckOptionPrompt");
    let value = CFBoolean::true_value();
    let options = CFDictionary::from_CFType_pairs(&[(key, value)]);

    unsafe {
        AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef() as *const c_void);
    }
}

#[cfg(target_os = "macos")]
fn start_event_tap<R: Runtime>(app_handle: AppHandle<R>) {
    std::thread::spawn(move || {
        println!("[fn-key-listener] Creating CGEventTap on thread...");

        // Listen to FlagsChanged + KeyDown + KeyUp to catch Fn on all Mac types
        let tap_result = CGEventTap::new(
            CGEventTapLocation::Session,
            CGEventTapPlacement::HeadInsertEventTap,
            CGEventTapOptions::ListenOnly,
            vec![
                CGEventType::FlagsChanged,
                CGEventType::KeyDown,
                CGEventType::KeyUp,
            ],
            move |_proxy, event_type, event| {
                let keycode = event.get_integer_value_field(
                    core_graphics::event::EventField::KEYBOARD_EVENT_KEYCODE,
                );

                match event_type {
                    CGEventType::FlagsChanged => {
                        let flags = event.get_flags();

                        // Method 1: Check SecondaryFn flag
                        let fn_flag_active =
                            flags.contains(CGEventFlags::CGEventFlagSecondaryFn);

                        // Method 2: Check keycode 63 (Fn/Globe key)
                        let is_fn_keycode = keycode as u16 == FN_KEYCODE;

                        let _fn_pressed = fn_flag_active || is_fn_keycode;
                        let was_pressed = FN_IS_PRESSED.load(Ordering::SeqCst);

                        println!(
                            "[fn-key-listener] FlagsChanged: keycode={}, flags={:#x}, fn_flag={}, is_fn_keycode={}, was_pressed={}",
                            keycode,
                            flags.bits(),
                            fn_flag_active,
                            is_fn_keycode,
                            was_pressed
                        );

                        // For FlagsChanged with keycode 63:
                        // if fn_flag is set or keycode is 63, it means Fn is being toggled
                        if is_fn_keycode {
                            // For keycode 63 FlagsChanged, we toggle based on current state
                            if !was_pressed {
                                FN_IS_PRESSED.store(true, Ordering::SeqCst);
                                println!("[fn-key-listener] >>> Fn key DOWN");
                                let _ = app_handle.emit("fn-key-down", ());
                            } else {
                                FN_IS_PRESSED.store(false, Ordering::SeqCst);
                                println!("[fn-key-listener] >>> Fn key UP");
                                let _ = app_handle.emit("fn-key-up", ());
                            }
                        } else if fn_flag_active && !was_pressed {
                            FN_IS_PRESSED.store(true, Ordering::SeqCst);
                            println!("[fn-key-listener] >>> Fn key DOWN (via flag)");
                            let _ = app_handle.emit("fn-key-down", ());
                        } else if !fn_flag_active && was_pressed && !is_fn_keycode {
                            // Only reset via flag if we didn't already handle via keycode
                            FN_IS_PRESSED.store(false, Ordering::SeqCst);
                            println!("[fn-key-listener] >>> Fn key UP (via flag)");
                            let _ = app_handle.emit("fn-key-up", ());
                        }
                    }
                    CGEventType::KeyDown => {
                        if keycode as u16 == FN_KEYCODE {
                            let was_pressed = FN_IS_PRESSED.load(Ordering::SeqCst);
                            println!("[fn-key-listener] Fn KeyDown: keycode={}", keycode);
                            if !was_pressed {
                                FN_IS_PRESSED.store(true, Ordering::SeqCst);
                                println!("[fn-key-listener] >>> Fn key DOWN (via KeyDown)");
                                let _ = app_handle.emit("fn-key-down", ());
                            }
                        }
                    }
                    CGEventType::KeyUp => {
                        if keycode as u16 == FN_KEYCODE {
                            let was_pressed = FN_IS_PRESSED.load(Ordering::SeqCst);
                            println!("[fn-key-listener] Fn KeyUp: keycode={}", keycode);
                            if was_pressed {
                                FN_IS_PRESSED.store(false, Ordering::SeqCst);
                                println!("[fn-key-listener] >>> Fn key UP (via KeyUp)");
                                let _ = app_handle.emit("fn-key-up", ());
                            }
                        }
                    }
                    _ => {}
                }

                None
            },
        );

        match tap_result {
            Ok(tap) => {
                println!("[fn-key-listener] CGEventTap created successfully");
                unsafe {
                    let loop_source = tap
                        .mach_port
                        .create_runloop_source(0)
                        .expect("Failed to create runloop source");
                    let run_loop = CFRunLoop::get_current();
                    run_loop.add_source(&loop_source, kCFRunLoopCommonModes);
                    tap.enable();
                    println!("[fn-key-listener] RunLoop started, listening for Fn key events...");
                    CFRunLoop::run_current();
                }
            }
            Err(()) => {
                eprintln!("[fn-key-listener] ERROR: Failed to create CGEventTap!");
                eprintln!(
                    "[fn-key-listener] Go to System Settings > Privacy & Security > Accessibility"
                );
                eprintln!("[fn-key-listener] and add this application.");
            }
        }
    });
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("fn-key-listener")
        .setup(move |app, _api| {
            #[cfg(target_os = "macos")]
            {
                let trusted = check_accessibility_permission();
                if !trusted {
                    println!("[fn-key-listener] Prompting for Accessibility permission...");
                    prompt_accessibility_permission();
                    std::thread::sleep(std::time::Duration::from_secs(1));
                    let trusted_after = check_accessibility_permission();
                    if !trusted_after {
                        println!("[fn-key-listener] WARNING: Still no Accessibility permission.");
                    }
                }
                let app_handle = app.clone();
                start_event_tap(app_handle);
            }

            #[cfg(not(target_os = "macos"))]
            {
                println!("[fn-key-listener] Fn key listener is only supported on macOS.");
            }

            Ok(())
        })
        .build()
}
