use rusqlite::{params, Connection};
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

mod media;
mod pembaruan;

struct DbState(Mutex<Connection>);
struct WakeLockState(Mutex<Option<std::process::Child>>);

#[cfg(target_os = "windows")]
const ES_CONTINUOUS: u32 = 0x8000_0000;
#[cfg(target_os = "windows")]
const ES_SYSTEM_REQUIRED: u32 = 0x0000_0001;
#[cfg(target_os = "windows")]
const ES_DISPLAY_REQUIRED: u32 = 0x0000_0002;

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn SetThreadExecutionState(es_flags: u32) -> u32;
}

#[cfg(target_os = "windows")]
#[link(name = "user32")]
unsafe extern "system" {
    fn OpenClipboard(h_wnd_new_owner: *mut std::ffi::c_void) -> i32;
    fn EmptyClipboard() -> i32;
    fn CloseClipboard() -> i32;
}

#[tauri::command]
fn bersihkan_clipboard() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            if OpenClipboard(std::ptr::null_mut()) != 0 {
                EmptyClipboard();
                CloseClipboard();
            }
        }
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(mut child) = std::process::Command::new("/usr/bin/pbcopy")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
        {
            drop(child.stdin.take());
            let _ = child.wait();
        }
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(())
    }
}

fn lepas_wake_lock(state: &WakeLockState) {
    #[cfg(target_os = "windows")]
    {
        let _ = state;
        unsafe {
            SetThreadExecutionState(ES_CONTINUOUS);
        }
    }
    #[cfg(target_os = "macos")]
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let _ = state;
}

/// Hanya `keluar_aplikasi` (setelah PIN pengawas) yang boleh menutup aplikasi di mode
/// Exam Browser. Jalur lain (Cmd+Q di macOS, menu Quit, logout OS) ditolak di ExitRequested.
static KELUAR_DIIZINKAN: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn keluar_aplikasi(app_handle: tauri::AppHandle) {
    if let Some(wl) = app_handle.try_state::<WakeLockState>() {
        lepas_wake_lock(&wl);
    }
    KELUAR_DIIZINKAN.store(true, Ordering::SeqCst);
    app_handle.exit(0);
}

#[tauri::command]
fn atur_tetap_menyala(state: tauri::State<'_, WakeLockState>, aktif: bool) -> Result<(), String> {
    if !aktif {
        lepas_wake_lock(&state);
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        let _ = state;
        unsafe {
            SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED);
        }
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        if let Some(child) = guard.as_mut() {
            if matches!(child.try_wait(), Ok(None)) {
                return Ok(());
            }
            *guard = None;
        }
        let child = std::process::Command::new("/usr/bin/caffeinate")
            .args(["-d", "-i", "-w", &std::process::id().to_string()])
            .spawn()
            .map_err(|e| e.to_string())?;
        *guard = Some(child);
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = state;
        Ok(())
    }
}

#[tauri::command]
fn jumlah_monitor(window: tauri::WebviewWindow) -> usize {
    window.available_monitors().map(|m| m.len()).unwrap_or(1)
}

#[tauri::command]
fn buka_pengaturan_wifi(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if app.opener().open_url("ms-availablenetworks:", None::<&str>).is_ok() {
            return Ok(());
        }
        return app
            .opener()
            .open_url("ms-settings:network-wifi", None::<&str>)
            .map_err(|e| e.to_string());
    }
    #[cfg(target_os = "macos")]
    {
        if app
            .opener()
            .open_url("x-apple.systempreferences:com.apple.wifi-settings-extension", None::<&str>)
            .is_ok()
        {
            return Ok(());
        }
        return app
            .opener()
            .open_url("x-apple.systempreferences:com.apple.preference.network", None::<&str>)
            .map_err(|e| e.to_string());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = app;
        Err("Pengaturan Wi-Fi otomatis belum didukung di sistem operasi ini.".to_string())
    }
}

/// Menu default Tauri di macOS berisi "Quit" (Cmd+Q) yang menutup aplikasi tanpa PIN.
/// Ganti dengan menu tanpa Quit/Close serta tanpa Cut/Copy/Paste, tetap sertakan Undo/Redo/Select All.
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
            app.manage(WakeLockState(Mutex::new(None)));

            #[cfg(all(target_os = "macos", not(debug_assertions)))]
            pasang_menu_macos(app.handle())?;

            Ok(())
        })
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            keluar_aplikasi,
            bersihkan_clipboard,
            atur_tetap_menyala,
            jumlah_monitor,
            buka_pengaturan_wifi,
            media::unduh_media,
            media::hapus_media,
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
        .build(context)
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
