#[tauri::command]
fn keluar_aplikasi(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![keluar_aplikasi])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Di mode Exam Browser (Release), cegah penutupan jendela sembarangan (Alt+F4)
                #[cfg(not(debug_assertions))]
                api.prevent_close();
                #[cfg(debug_assertions)]
                let _ = api;
            }
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
