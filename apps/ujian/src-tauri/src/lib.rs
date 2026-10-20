use rusqlite::{params, Connection};
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::Manager;

mod media;

struct DbState(Mutex<Connection>);

/// Hanya `keluar_aplikasi` (setelah PIN pengawas) yang boleh menutup aplikasi di mode
/// Exam Browser. Jalur lain (Cmd+Q di macOS, menu Quit, logout OS) ditolak di ExitRequested.
static KELUAR_DIIZINKAN: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn keluar_aplikasi(app_handle: tauri::AppHandle) {
    KELUAR_DIIZINKAN.store(true, Ordering::SeqCst);
    app_handle.exit(0);
}

/// Menu default Tauri di macOS berisi "Quit" (Cmd+Q) yang menutup aplikasi tanpa PIN.
/// Ganti dengan menu tanpa Quit/Close, tapi tetap sertakan Edit agar Cmd+C/V/Z di input jalan.
#[cfg(all(target_os = "macos", not(debug_assertions)))]
fn pasang_menu_macos(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, PredefinedMenuItem, Submenu};

    let menu_app = Submenu::with_items(
        app,
        "Ujian",
        true,
        &[&PredefinedMenuItem::about(app, None, None)?],
    )?;
    let menu_edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    app.set_menu(Menu::with_items(app, &[&menu_app, &menu_edit])?)?;
    Ok(())
}

#[tauri::command]
fn sqlite_ambil(state: tauri::State<'_, DbState>, kunci: String) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT nilai FROM erapor_cbt_kv WHERE kunci = ?1 LIMIT 1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![kunci]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let val: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(Some(val))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn sqlite_simpan(state: tauri::State<'_, DbState>, kunci: String, nilai: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let sekarang = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    conn.execute(
        "INSERT OR REPLACE INTO erapor_cbt_kv (kunci, nilai, diperbarui_pada) VALUES (?1, ?2, ?3)",
        params![kunci, nilai, sekarang],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn sqlite_hapus(state: tauri::State<'_, DbState>, kunci: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM erapor_cbt_kv WHERE kunci = ?1", params![kunci])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn sqlite_daftar_kunci(state: tauri::State<'_, DbState>, awalan: Option<String>) -> Result<Vec<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let prefix = awalan.unwrap_or_default();
    let escaped = prefix.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
    let pattern = format!("{}%", escaped);
    let mut stmt = conn
        .prepare("SELECT kunci FROM erapor_cbt_kv WHERE kunci LIKE ?1 ESCAPE '\\' ORDER BY kunci ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![pattern], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    for r in rows {
        if let Ok(k) = r {
            list.push(k);
        }
    }
    Ok(list)
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

            let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
            let db_path = app_dir.join("erapor_cbt.db");
            let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

            conn.execute_batch(
                "PRAGMA journal_mode = WAL;
                 PRAGMA synchronous = NORMAL;
                 CREATE TABLE IF NOT EXISTS erapor_cbt_kv (
                     kunci TEXT PRIMARY KEY NOT NULL,
                     nilai TEXT NOT NULL,
                     diperbarui_pada INTEGER NOT NULL
                 );
                 CREATE INDEX IF NOT EXISTS idx_erapor_cbt_kv_kunci ON erapor_cbt_kv(kunci);",
            )
            .map_err(|e| e.to_string())?;

            app.manage(DbState(Mutex::new(conn)));

            #[cfg(all(target_os = "macos", not(debug_assertions)))]
            pasang_menu_macos(app.handle())?;

            Ok(())
        })
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            keluar_aplikasi,
            media::unduh_media,
            media::hapus_media,
            sqlite_ambil,
            sqlite_simpan,
            sqlite_hapus,
            sqlite_daftar_kunci
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Di mode Exam Browser (Release), cegah penutupan jendela sembarangan (Alt+F4)
                #[cfg(not(debug_assertions))]
                api.prevent_close();
                #[cfg(debug_assertions)]
                let _ = api;
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                // Di mode Exam Browser (Release), tolak keluar selain lewat `keluar_aplikasi` (Cmd+Q di macOS)
                #[cfg(not(debug_assertions))]
                if !KELUAR_DIIZINKAN.load(Ordering::SeqCst) {
                    api.prevent_exit();
                }
                #[cfg(debug_assertions)]
                let _ = api;
            }
        });
}
