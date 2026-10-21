//! Media soal (gambar) disimpan sebagai berkas di folder data app agar soal tetap lengkap
//! saat offline. WebView desktop tidak bisa mengandalkan service worker (WKWebView di
//! `tauri://`), jadi web menampilkan berkas ini lewat protokol asset (`convertFileSrc`),
//! dengan cakupan `$APPDATA/media/**` di tauri.conf.json.
//!
//! Nama berkas = SHA-256 URL (+ ekstensi), jadi media yang sama dipakai bersama antar ujian.
//! Indeks URL → path per ujian disimpan web di SQLite (apps/ujian/src/lib/ujian.ts).

use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_http::reqwest;

fn folder_media(app: &AppHandle) -> Result<PathBuf, String> {
    let folder = app.path().app_data_dir().map_err(|e| e.to_string())?.join("media");
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    Ok(folder)
}

/// `<sha256 url>.<ext>`; ekstensi hanya huruf/angka (≤ 5) dari path URL, untuk tipe MIME asset.
fn nama_berkas(url: &reqwest::Url) -> String {
    let hash: String = Sha256::digest(url.as_str().as_bytes()).iter().map(|b| format!("{b:02x}")).collect();
    let ext = url
        .path()
        .rsplit('/')
        .next()
        .and_then(|nama| nama.rsplit_once('.'))
        .map(|(_, e)| e.to_ascii_lowercase())
        .filter(|e| !e.is_empty() && e.len() <= 5 && e.chars().all(|c| c.is_ascii_alphanumeric()));
    match ext {
        Some(e) => format!("{hash}.{e}"),
        None => hash,
    }
}

/// Unduh `url` ke folder media bila belum ada; kembalikan path berkas lokal.
/// Berkas yang sudah ada dipakai tanpa jaringan, jadi aman dipanggil ulang saat offline.
#[tauri::command]
pub async fn unduh_media(app: AppHandle, url: String) -> Result<String, String> {
    let url = reqwest::Url::parse(&url).map_err(|_| "Alamat media tidak valid.".to_string())?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err("Alamat media tidak diizinkan.".into());
    }
    let tujuan = folder_media(&app)?.join(nama_berkas(&url));
    if fs::metadata(&tujuan).map(|m| m.len() > 0).unwrap_or(false) {
        return Ok(tujuan.to_string_lossy().into_owned());
    }

    let res = reqwest::get(url).await.map_err(|_| "Gagal mengunduh media. Periksa internet lalu coba lagi.".to_string())?;
    if !res.status().is_success() {
        return Err(format!("Gagal mengunduh media ({}).", res.status().as_u16()));
    }
    let isi = res.bytes().await.map_err(|_| "Unduhan media terputus. Coba lagi.".to_string())?;

    // Tulis ke berkas sementara lalu ganti nama: berkas setengah jadi tidak pernah dianggap lengkap.
    let sementara = tujuan.with_extension("unduh");
    fs::write(&sementara, &isi).map_err(|e| e.to_string())?;
    fs::rename(&sementara, &tujuan).map_err(|e| e.to_string())?;
    Ok(tujuan.to_string_lossy().into_owned())
}

/// Hapus berkas media; path di luar folder media diabaikan.
#[tauri::command]
pub fn hapus_media(app: AppHandle, path: Vec<String>) -> Result<(), String> {
    let folder = folder_media(&app)?.canonicalize().map_err(|e| e.to_string())?;
    for p in path {
        let Ok(berkas) = PathBuf::from(&p).canonicalize() else { continue };
        if berkas.parent() == Some(folder.as_path()) {
            let _ = fs::remove_file(berkas);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nama(url: &str) -> String {
        nama_berkas(&reqwest::Url::parse(url).unwrap())
    }

    #[test]
    fn nama_berkas_stabil_dan_berekstensi() {
        let a = nama("https://erapor.test/storage/soal/Gambar.PNG");
        assert_eq!(a, nama("https://erapor.test/storage/soal/Gambar.PNG"));
        assert!(a.ends_with(".png"));
        assert_eq!(a.len(), 64 + 4);
        assert_ne!(a, nama("https://erapor.test/storage/soal/lain.png"));
    }

    #[test]
    fn ekstensi_aneh_diabaikan() {
        assert_eq!(nama("https://erapor.test/storage/tanpa-ekstensi").len(), 64);
        assert_eq!(nama("https://erapor.test/storage/a.p%2Fng").len(), 64);
        assert_eq!(nama("https://erapor.test/storage/a.toolong").len(), 64);
    }
}
