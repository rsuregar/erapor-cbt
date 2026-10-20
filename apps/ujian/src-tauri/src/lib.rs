use rusqlite::{params, Connection};
use std::fs;
use std::sync::Mutex;
use tauri::Manager;

mod pembaruan;

struct DbState(Mutex<Connection>);

#[tauri::command]
fn keluar_aplikasi(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
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
    let context = tauri::generate_context!();
    let mut builder = tauri::Builder::default();
    // Updater hanya didaftarkan bila build membawa pubkey (plugins.updater dari --config CI).
    if pembaruan::aktif(context.config()) {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
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

            Ok(())
        })
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            keluar_aplikasi,
            pembaruan::pembaruan_tersedia,
            pembaruan::pasang_pembaruan,
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
        .run(context)
        .expect("error while building tauri application");
}
