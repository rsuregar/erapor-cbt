use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "macos")]
use objc2_app_kit::{NSApplicationPresentationOptions, NSWindowCollectionBehavior};

/// Status internal apakah penguncian kios macOS sedang dikehendaki aktif.
/// Hanya aktif pada build rilis macOS (`not(debug_assertions)`).
static KIOS_AKTIF: AtomicBool = AtomicBool::new(false);

#[allow(dead_code)]
pub fn sedang_aktif() -> bool {
    KIOS_AKTIF.load(Ordering::SeqCst)
}

#[cfg(target_os = "macos")]
#[cfg_attr(debug_assertions, allow(dead_code))]
fn opsi_kios_dasar() -> NSApplicationPresentationOptions {
    // Aturan ketergantungan AppKit:
    // - `HideMenuBar` dan semua `Disable*` wajib disertai `HideDock`.
    // - `HideDock` dan `AutoHideDock` saling eksklusif (begitu juga menu bar).
    NSApplicationPresentationOptions::HideDock
        | NSApplicationPresentationOptions::HideMenuBar
        | NSApplicationPresentationOptions::DisableAppleMenu
        | NSApplicationPresentationOptions::DisableProcessSwitching
        | NSApplicationPresentationOptions::DisableForceQuit
        | NSApplicationPresentationOptions::DisableSessionTermination
        | NSApplicationPresentationOptions::DisableHideApplication
}

#[cfg(target_os = "macos")]
#[cfg_attr(debug_assertions, allow(dead_code))]
fn opsi_target(
    aktif: bool,
    sekarang: NSApplicationPresentationOptions,
) -> NSApplicationPresentationOptions {
    let sedang_fullscreen = sekarang.contains(NSApplicationPresentationOptions::FullScreen);
    if aktif {
        let mut target = opsi_kios_dasar();
        if sedang_fullscreen {
            target |= NSApplicationPresentationOptions::FullScreen;
        }
        target
    } else if sedang_fullscreen {
        NSApplicationPresentationOptions::FullScreen
            | NSApplicationPresentationOptions::AutoHideDock
            | NSApplicationPresentationOptions::AutoHideMenuBar
    } else {
        NSApplicationPresentationOptions::Default
    }
}

#[cfg(target_os = "macos")]
#[cfg_attr(debug_assertions, allow(dead_code))]
fn perilaku_koleksi_anti_tiling(
    sekarang: NSWindowCollectionBehavior,
) -> NSWindowCollectionBehavior {
    let mut target = sekarang;
    target.remove(NSWindowCollectionBehavior::FullScreenAllowsTiling);
    target.insert(NSWindowCollectionBehavior::FullScreenDisallowsTiling);
    target
}

#[cfg(target_os = "macos")]
#[cfg_attr(debug_assertions, allow(dead_code))]
fn harus_terapkan_sekarang_saat_startup(sekarang: NSApplicationPresentationOptions) -> bool {
    sekarang.contains(NSApplicationPresentationOptions::FullScreen)
}

#[cfg(all(target_os = "macos", not(debug_assertions)))]
fn terapkan_presentasi_di_main_thread(aktif: bool) {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSApplication;

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let app = NSApplication::sharedApplication(mtm);
    let sekarang = app.presentationOptions();
    let target = opsi_target(aktif, sekarang);
    if sekarang == target {
        return;
    }

    let hasil = objc2::exception::catch(std::panic::AssertUnwindSafe(|| {
        app.setPresentationOptions(target);
    }));
    if let Err(exc) = hasil {
        log::warn!("Gagal menerapkan NSApplicationPresentationOptions: {exc:?}");
    }
}

#[cfg(all(target_os = "macos", not(debug_assertions)))]
fn terapkan_anti_tiling_jendela(window: &tauri::WebviewWindow) {
    use objc2_app_kit::NSWindow;

    let Ok(ptr) = window.ns_window() else {
        return;
    };
    if ptr.is_null() {
        return;
    }

    let ns_win_ptr = ptr as *const NSWindow;
    let sekarang = unsafe { (*ns_win_ptr).collectionBehavior() };
    let target = perilaku_koleksi_anti_tiling(sekarang);
    if sekarang == target {
        return;
    }

    let hasil = unsafe {
        objc2::exception::catch(std::panic::AssertUnwindSafe(|| {
            (*ns_win_ptr).setCollectionBehavior(target);
        }))
    };
    if let Err(exc) = hasil {
        log::warn!("Gagal menerapkan NSWindowCollectionBehavior anti-tiling: {exc:?}");
    }
}

#[cfg(all(target_os = "macos", not(debug_assertions)))]
fn terapkan_lengkap_di_main_thread(app: &tauri::AppHandle, aktif: bool) {
    use tauri::Manager;

    terapkan_presentasi_di_main_thread(aktif);
    if aktif {
        if let Some(jendela) = app.get_webview_window("main") {
            terapkan_anti_tiling_jendela(&jendela);
        }
    }
}

/// Mengaktifkan penguncian kios saat aplikasi baru dimulai di macOS.
/// Bila jendela belum selesai masuk native `FullScreen`, tunda `HideMenuBar`/`HideDock` ke
/// event transisi fullscreen dan sinkronisasi tertunda agar animasi Space `tao` tidak terganggu.
#[cfg_attr(debug_assertions, allow(dead_code))]
pub fn aktifkan_saat_startup(app: &tauri::AppHandle) {
    #[cfg(all(target_os = "macos", not(debug_assertions)))]
    {
        use objc2::MainThreadMarker;
        use objc2_app_kit::NSApplication;
        use tauri::Manager;

        KIOS_AKTIF.store(true, Ordering::SeqCst);
        let handle_main = app.clone();
        let _ = app.run_on_main_thread(move || {
            if !sedang_aktif() {
                return;
            }
            if let Some(jendela) = handle_main.get_webview_window("main") {
                terapkan_anti_tiling_jendela(&jendela);
            }
            if let Some(mtm) = MainThreadMarker::new() {
                let app_kit = NSApplication::sharedApplication(mtm);
                if harus_terapkan_sekarang_saat_startup(app_kit.presentationOptions()) {
                    terapkan_presentasi_di_main_thread(true);
                }
            }
        });

        let handle_bg = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(400));
            sinkronkan_jika_aktif(&handle_bg);
            std::thread::sleep(std::time::Duration::from_millis(800));
            sinkronkan_jika_aktif(&handle_bg);
        });
    }
    #[cfg(not(all(target_os = "macos", not(debug_assertions))))]
    {
        let _ = app;
    }
}

/// Mengaktifkan atau menonaktifkan penguncian kios macOS tingkat OS secara sinkron (aman
/// dipanggil baik dari main thread maupun Tokio worker thread tanpa deadlock).
/// Pada build debug (`tauri dev`) dan platform non-macOS, fungsi ini no-op.
pub fn atur_kios_sinkron(app: &tauri::AppHandle, aktif: bool) {
    #[cfg(all(target_os = "macos", not(debug_assertions)))]
    {
        use objc2::MainThreadMarker;

        KIOS_AKTIF.store(aktif, Ordering::SeqCst);
        if MainThreadMarker::new().is_some() {
            terapkan_lengkap_di_main_thread(app, aktif);
            return;
        }

        let (tx, rx) = std::sync::mpsc::sync_channel::<()>(1);
        let handle = app.clone();
        if app
            .run_on_main_thread(move || {
                terapkan_lengkap_di_main_thread(&handle, aktif);
                let _ = tx.send(());
            })
            .is_ok()
        {
            let _ = rx.recv_timeout(std::time::Duration::from_millis(500));
        }
    }
    #[cfg(not(all(target_os = "macos", not(debug_assertions))))]
    {
        let _ = (app, aktif);
    }
}

/// Menegakkan kembali presentation options & anti-tiling jika mode kios sedang aktif
/// (mis. setelah transisi `toggleFullScreen:` asinkron selesai atau jendela kembali fokus).
pub fn sinkronkan_jika_aktif(app: &tauri::AppHandle) {
    #[cfg(all(target_os = "macos", not(debug_assertions)))]
    {
        if !sedang_aktif() {
            return;
        }
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            if !sedang_aktif() {
                return;
            }
            terapkan_lengkap_di_main_thread(&handle, true);
        });
    }
    #[cfg(not(all(target_os = "macos", not(debug_assertions))))]
    {
        let _ = app;
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn opsi_kios_tanpa_fullscreen_tidak_memaksa_flag_fullscreen_maupun_autohide() {
        let target = opsi_target(true, NSApplicationPresentationOptions::Default);
        assert!(target.contains(NSApplicationPresentationOptions::HideDock));
        assert!(target.contains(NSApplicationPresentationOptions::HideMenuBar));
        assert!(target.contains(NSApplicationPresentationOptions::DisableAppleMenu));
        assert!(target.contains(NSApplicationPresentationOptions::DisableProcessSwitching));
        assert!(target.contains(NSApplicationPresentationOptions::DisableForceQuit));
        assert!(target.contains(NSApplicationPresentationOptions::DisableSessionTermination));
        assert!(target.contains(NSApplicationPresentationOptions::DisableHideApplication));
        assert!(!target.contains(NSApplicationPresentationOptions::FullScreen));
        assert!(!target.contains(NSApplicationPresentationOptions::AutoHideDock));
        assert!(!target.contains(NSApplicationPresentationOptions::AutoHideMenuBar));
    }

    #[test]
    fn opsi_kios_saat_fullscreen_menjaga_fullscreen_dan_mengganti_autohide() {
        let awal = NSApplicationPresentationOptions::FullScreen
            | NSApplicationPresentationOptions::AutoHideDock
            | NSApplicationPresentationOptions::AutoHideMenuBar;
        let target = opsi_target(true, awal);

        assert!(target.contains(NSApplicationPresentationOptions::FullScreen));
        assert!(target.contains(NSApplicationPresentationOptions::HideDock));
        assert!(target.contains(NSApplicationPresentationOptions::HideMenuBar));
        assert!(target.contains(NSApplicationPresentationOptions::DisableProcessSwitching));
        assert!(target.contains(NSApplicationPresentationOptions::DisableForceQuit));
        assert!(!target.contains(NSApplicationPresentationOptions::AutoHideDock));
        assert!(!target.contains(NSApplicationPresentationOptions::AutoHideMenuBar));
    }

    #[test]
    fn lepas_kios_saat_fullscreen_memulihkan_fullscreen_dan_autohide() {
        let awal = NSApplicationPresentationOptions::FullScreen | opsi_kios_dasar();
        let target = opsi_target(false, awal);

        assert_eq!(
            target,
            NSApplicationPresentationOptions::FullScreen
                | NSApplicationPresentationOptions::AutoHideDock
                | NSApplicationPresentationOptions::AutoHideMenuBar
        );
    }

    #[test]
    fn lepas_kios_tanpa_fullscreen_memulihkan_default() {
        let target = opsi_target(false, opsi_kios_dasar());
        assert_eq!(target, NSApplicationPresentationOptions::Default);
    }

    #[test]
    fn perilaku_anti_tiling_menghapus_allows_tiling_dan_menjaga_fullscreen_primary() {
        let awal = NSWindowCollectionBehavior::FullScreenPrimary
            | NSWindowCollectionBehavior::FullScreenAllowsTiling;
        let target = perilaku_koleksi_anti_tiling(awal);

        assert!(target.contains(NSWindowCollectionBehavior::FullScreenPrimary));
        assert!(target.contains(NSWindowCollectionBehavior::FullScreenDisallowsTiling));
        assert!(!target.contains(NSWindowCollectionBehavior::FullScreenAllowsTiling));
    }

    #[test]
    fn startup_tidak_terapkan_hide_menu_bar_sebelum_fullscreen_aktif() {
        assert!(!harus_terapkan_sekarang_saat_startup(
            NSApplicationPresentationOptions::Default
        ));
        assert!(harus_terapkan_sekarang_saat_startup(
            NSApplicationPresentationOptions::FullScreen
                | NSApplicationPresentationOptions::AutoHideDock
                | NSApplicationPresentationOptions::AutoHideMenuBar
        ));
    }
}
