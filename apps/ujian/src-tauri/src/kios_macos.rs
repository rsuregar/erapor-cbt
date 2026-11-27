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

/// Mengaktifkan atau menonaktifkan penguncian kios macOS tingkat OS.
/// Pada build debug (`tauri dev`) dan platform non-macOS, fungsi ini no-op agar pengembang tidak terkunci.
pub fn atur_kios(app: &tauri::AppHandle, aktif: bool) {
    #[cfg(all(target_os = "macos", not(debug_assertions)))]
    {
        use tauri::Manager;

        KIOS_AKTIF.store(aktif, Ordering::SeqCst);
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            terapkan_presentasi_di_main_thread(aktif);
            if aktif {
                if let Some(jendela) = handle.get_webview_window("main") {
                    terapkan_anti_tiling_jendela(&jendela);
                }
            }
        });
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
        use tauri::Manager;

        if !sedang_aktif() {
            return;
        }
        let handle = app.clone();
        let _ = app.run_on_main_thread(move || {
            if !sedang_aktif() {
                return;
            }
            terapkan_presentasi_di_main_thread(true);
            if let Some(jendela) = handle.get_webview_window("main") {
                terapkan_anti_tiling_jendela(&jendela);
            }
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
}
