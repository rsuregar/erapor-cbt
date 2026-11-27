use rusqlite::{params, Connection};
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

mod cache_webview;
mod kios_macos;
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
async fn bersihkan_clipboard() -> Result<(), String> {
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

fn lepas_wake_lock(app: &tauri::AppHandle, state: &WakeLockState) {
    #[cfg(target_os = "windows")]
    {
        let _ = state;
        let _ = app.run_on_main_thread(|| unsafe {
            SetThreadExecutionState(ES_CONTINUOUS);
        });
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        if let Ok(mut guard) = state.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let _ = (app, state);
}

fn penanda_versi_webview(versi: &str, build: Option<&str>) -> String {
    match build.map(str::trim).filter(|b| !b.is_empty() && *b != "0") {
        Some(b) => format!("{versi}-b{b}"),
        None => versi.to_string(),
    }
}

/// Hanya `keluar_aplikasi` (setelah PIN pengawas) atau `restart()` updater yang boleh menutup
/// aplikasi di mode Exam Browser. Jalur lain (Cmd+Q di macOS, menu Quit, logout OS) ditolak di ExitRequested.
static KELUAR_DIIZINKAN: AtomicBool = AtomicBool::new(false);

#[cfg_attr(debug_assertions, allow(dead_code))]
fn boleh_keluar(diizinkan: bool, code: Option<i32>) -> bool {
    diizinkan || code == Some(tauri::RESTART_EXIT_CODE)
}

#[cfg_attr(debug_assertions, allow(dead_code))]
fn harus_cegah_tutup_jendela(diizinkan: bool) -> bool {
    !diizinkan
}

pub(crate) fn siapkan_keluar_aplikasi(app_handle: &tauri::AppHandle) {
    if let Some(wl) = app_handle.try_state::<WakeLockState>() {
        lepas_wake_lock(app_handle, &wl);
    }
    kios_macos::atur_kios_sinkron(app_handle, false);
    KELUAR_DIIZINKAN.store(true, Ordering::SeqCst);
}

pub(crate) fn siapkan_pemasangan_pembaruan(app_handle: &tauri::AppHandle) {
    if let Some(jendela) = app_handle.get_webview_window("main") {
        let _ = jendela.set_always_on_top(false);
        let _ = jendela.set_fullscreen(false);
    }
    siapkan_keluar_aplikasi(app_handle);
}

pub(crate) fn pulihkan_setelah_pembaruan_gagal(app_handle: &tauri::AppHandle) {
    KELUAR_DIIZINKAN.store(false, Ordering::SeqCst);
    if let Some(jendela) = app_handle.get_webview_window("main") {
        let _ = jendela.set_fullscreen(true);
        let _ = jendela.set_always_on_top(true);
    }
    kios_macos::atur_kios_sinkron(app_handle, true);
}

#[tauri::command]
fn keluar_aplikasi(app_handle: tauri::AppHandle) {
    siapkan_keluar_aplikasi(&app_handle);
    app_handle.exit(0);
}

#[tauri::command]
fn arsitektur_aplikasi() -> &'static str {
    std::env::consts::ARCH
}

#[tauri::command]
async fn atur_kios_macos(app: tauri::AppHandle, aktif: bool) -> Result<(), String> {
    kios_macos::atur_kios_sinkron(&app, aktif);
    Ok(())
}

#[tauri::command]
fn atur_proteksi_konten_jendela(window: tauri::WebviewWindow, aktif: bool) -> Result<(), String> {
    #[cfg(not(debug_assertions))]
    {
        window.set_content_protected(aktif).map_err(|e| e.to_string())?;
    }
    #[cfg(debug_assertions)]
    {
        let _ = (window, aktif);
    }
    Ok(())
}

#[tauri::command]
fn atur_tetap_menyala(
    app: tauri::AppHandle,
    state: tauri::State<'_, WakeLockState>,
    aktif: bool,
) -> Result<(), String> {
    if !aktif {
        lepas_wake_lock(&app, &state);
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        let _ = state;
        app.run_on_main_thread(|| unsafe {
            SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED);
        })
        .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app;
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
        let _ = (app, state);
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
        // Utamakan Settings penuh agar jendela Wi-Fi konsisten mencuri fokus di Windows 10/11
        // (flyout `ms-availablenetworks:` di Windows 11 sering menutup/gagal fokus secara diam-diam).
        if app.opener().open_url("ms-settings:network-wifi", None::<&str>).is_ok() {
            return Ok(());
        }
        return app
            .opener()
            .open_url("ms-availablenetworks:", None::<&str>)
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
    let penanda_versi = penanda_versi_webview(
        &context.package_info().version.to_string(),
        option_env!("VITE_APP_BUILD"),
    );
    cache_webview::bersihkan_cache_saat_naik_versi(
        &context.config().identifier,
        &penanda_versi,
    );
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
                "PRAGMA busy_timeout = 5000;
                 PRAGMA journal_mode = WAL;
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
            {
                pasang_menu_macos(app.handle())?;
                kios_macos::aktifkan_saat_startup(app.handle());
            }

            Ok(())
        })
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            keluar_aplikasi,
            atur_kios_macos,
            atur_proteksi_konten_jendela,
            arsitektur_aplikasi,
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
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                // Di mode Exam Browser (Release), cegah penutupan jendela sembarangan (Alt+F4),
                // namun izinkan saat keluar sah atau pemasangan pembaruan Windows (Restart Manager / msiexec).
                #[cfg(not(debug_assertions))]
                if harus_cegah_tutup_jendela(KELUAR_DIIZINKAN.load(Ordering::SeqCst)) {
                    api.prevent_close();
                }
                #[cfg(debug_assertions)]
                let _ = api;
            }
            tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Focused(true) => {
                kios_macos::sinkronkan_jika_aktif(window.app_handle());
            }
            _ => {}
        })
        .build(context)
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::ExitRequested { code, api, .. } = event {
                // Di mode Exam Browser (Release), tolak keluar selain lewat `keluar_aplikasi` atau `restart()` updater
                #[cfg(not(debug_assertions))]
                if !boleh_keluar(KELUAR_DIIZINKAN.load(Ordering::SeqCst), code) {
                    api.prevent_exit();
                }
                #[cfg(debug_assertions)]
                let _ = (code, api);
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boleh_keluar_hanya_saat_diizinkan_atau_restart() {
        assert!(!boleh_keluar(false, None));
        assert!(!boleh_keluar(false, Some(0)));
        assert!(boleh_keluar(true, None));
        assert!(boleh_keluar(false, Some(tauri::RESTART_EXIT_CODE)));
    }

    #[test]
    fn penanda_versi_webview_ikut_sertakan_build_staging_jika_valid() {
        assert_eq!(penanda_versi_webview("0.10.5", Some("42")), "0.10.5-b42");
        assert_eq!(penanda_versi_webview("0.10.5", Some(" 7 ")), "0.10.5-b7");
        assert_eq!(penanda_versi_webview("0.10.5", None), "0.10.5");
        assert_eq!(penanda_versi_webview("0.10.5", Some("")), "0.10.5");
        assert_eq!(penanda_versi_webview("0.10.5", Some("0")), "0.10.5");
    }

    #[test]
    fn harus_cegah_tutup_jendela_hanya_saat_keluar_belum_diizinkan() {
        assert!(harus_cegah_tutup_jendela(false));
        assert!(!harus_cegah_tutup_jendela(true));
    }
}
