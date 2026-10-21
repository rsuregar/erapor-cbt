//! Pembaruan aplikasi desktop di dalam app (unduh + verifikasi tanda tangan + pasang + mulai ulang).
//!
//! Rilis dicari di sisi web (apps/ujian/src/lib/pembaruan.ts) dari GitHub Releases; web lalu
//! mengirim URL manifes updater (`*-updater.json`) rilis itu ke perintah `pasang_pembaruan`.
//! Plugin updater hanya aktif bila build CI menyuntikkan `plugins.updater.pubkey` lewat
//! `--config` (lihat docs/panduan-build-dan-cicd.md). Tanpa itu web kembali ke unduh manual.

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, Url};
use tauri_plugin_updater::UpdaterExt;

/// Manifes hanya boleh diambil dari GitHub Releases (unduhan tetap diverifikasi pubkey).
const AWALAN_MANIFES: &str = "https://github.com/";

#[derive(Clone, Serialize)]
#[serde(tag = "jenis", rename_all = "camelCase")]
pub enum ProgresPembaruan {
    Mulai { total: Option<u64> },
    Progres { diterima: usize },
    Memasang,
}

/// True bila build ini membawa pubkey updater (plugin terdaftar).
pub fn aktif(config: &tauri::Config) -> bool {
    config.plugins.0.contains_key("updater")
}

#[tauri::command]
pub fn pembaruan_tersedia(app: AppHandle) -> bool {
    aktif(app.config())
}

#[tauri::command]
pub async fn pasang_pembaruan(
    app: AppHandle,
    manifes: String,
    progres: Channel<ProgresPembaruan>,
) -> Result<(), String> {
    if !aktif(app.config()) {
        return Err("Pembaruan di dalam aplikasi tidak tersedia pada build ini.".into());
    }
    if !manifes.starts_with(AWALAN_MANIFES) {
        return Err("Alamat manifes pembaruan tidak diizinkan.".into());
    }
    let url = Url::parse(&manifes).map_err(|e| e.to_string())?;

    // Produksi: hanya versi yang lebih baru. Staging: versi dasar bisa sama (beda nomor build),
    // dan web sudah memilih build yang lebih baru, jadi terima saja.
    let staging = app.config().identifier.ends_with(".staging");
    let update = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .version_comparator(move |sekarang, rilis| staging || rilis.version > sekarang)
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Aplikasi sudah versi terbaru.")?;

    let mut mulai = false;
    update
        .download_and_install(
            |potongan, total| {
                if !mulai {
                    mulai = true;
                    let _ = progres.send(ProgresPembaruan::Mulai { total });
                }
                let _ = progres.send(ProgresPembaruan::Progres { diterima: potongan });
            },
            || {
                let _ = progres.send(ProgresPembaruan::Memasang);
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    // Windows: pemasang NSIS sudah mengambil alih dan menutup app. macOS/Linux: mulai ulang.
    app.restart();
}
