use std::fs;
use std::path::{Path, PathBuf};

const BERKAS_PENANDA_VERSI: &str = "versi-webview.txt";

/// Menghapus direktori cache/Service Worker WebView ketika versi aplikasi berubah.
/// Mengembalikan `true` bila pembersihan dijalankan (versi baru atau belum tercatat).
pub fn bersihkan_jika_versi_berubah(
    dir_penanda: &Path,
    dir_target: &[PathBuf],
    versi_sekarang: &str,
) -> bool {
    let berkas_penanda = dir_penanda.join(BERKAS_PENANDA_VERSI);
    if let Ok(versi_lama) = fs::read_to_string(&berkas_penanda) {
        if versi_lama.trim() == versi_sekarang {
            return false;
        }
    }

    for path in dir_target {
        if path.exists() {
            let _ = fs::remove_dir_all(path);
        }
    }

    let _ = fs::create_dir_all(dir_penanda);
    let _ = fs::write(&berkas_penanda, versi_sekarang);
    true
}

/// Dipanggil di awal startup sebelum WebView dibuat agar berkas cache & Service Worker
/// tidak terkunci oleh proses WebView, sambil menjaga Local Storage, IndexedDB, dan SQLite.
pub fn bersihkan_cache_saat_naik_versi(identifier: &str, versi_sekarang: &str) {
    #[cfg(target_os = "windows")]
    {
        let Some(local) = std::env::var_os("LOCALAPPDATA") else {
            return;
        };
        let local_path = PathBuf::from(&local);
        let dir_penanda = local_path.join(identifier);

        let mut basis = vec![local_path];
        if let Some(roaming) = std::env::var_os("APPDATA") {
            let roaming_path = PathBuf::from(roaming);
            if !basis.contains(&roaming_path) {
                basis.push(roaming_path);
            }
        }

        let mut targets = Vec::new();
        for b in basis {
            let profil = b.join(identifier).join("EBWebView").join("Default");
            targets.push(profil.join("Service Worker"));
            targets.push(profil.join("Cache"));
            targets.push(profil.join("Code Cache"));
        }

        bersihkan_jika_versi_berubah(&dir_penanda, &targets, versi_sekarang);
    }

    #[cfg(target_os = "macos")]
    {
        let Some(home) = std::env::var_os("HOME") else {
            return;
        };
        let home_path = PathBuf::from(home);
        let dir_penanda = home_path.join("Library/Caches").join(identifier);
        let targets = vec![
            home_path.join("Library/Caches").join(identifier).join("WebKit"),
            home_path
                .join("Library/WebKit")
                .join(identifier)
                .join("WebsiteData/ServiceWorkers"),
            home_path
                .join("Library/WebKit")
                .join(identifier)
                .join("WebsiteData/CacheStorage"),
        ];

        bersihkan_jika_versi_berubah(&dir_penanda, &targets, versi_sekarang);
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (identifier, versi_sekarang);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempDirGuard(PathBuf);

    impl TempDirGuard {
        fn new(prefix: &str) -> Self {
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0);
            let dir = std::env::temp_dir().join(format!(
                "erapor-cbt-{prefix}-{}-{nanos}",
                std::process::id()
            ));
            fs::create_dir_all(&dir).expect("gagal membuat temp dir uji");
            Self(dir)
        }
    }

    impl Drop for TempDirGuard {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn versi_baru_menghapus_cache_dan_sw_tanpa_menyentuh_data_ujian() {
        let tmp = TempDirGuard::new("baru");
        let dir_penanda = tmp.0.join("penanda");
        let profil = tmp.0.join("EBWebView").join("Default");

        let sw = profil.join("Service Worker");
        let cache = profil.join("Cache");
        let code_cache = profil.join("Code Cache");
        let local_storage = profil.join("Local Storage");
        let indexed_db = profil.join("IndexedDB");
        let sqlite = tmp.0.join("erapor_cbt.db");

        fs::create_dir_all(&sw).unwrap();
        fs::create_dir_all(&cache).unwrap();
        fs::create_dir_all(&code_cache).unwrap();
        fs::create_dir_all(&local_storage).unwrap();
        fs::create_dir_all(&indexed_db).unwrap();
        fs::write(sw.join("sw.js"), "old-sw").unwrap();
        fs::write(cache.join("data"), "old-cache").unwrap();
        fs::write(code_cache.join("js.bin"), "old-code").unwrap();
        fs::write(local_storage.join("state"), "token").unwrap();
        fs::write(indexed_db.join("db"), "jawaban").unwrap();
        fs::write(&sqlite, "sqlite-data").unwrap();

        let dibersihkan =
            bersihkan_jika_versi_berubah(&dir_penanda, &[sw.clone(), cache.clone(), code_cache.clone()], "0.10.4");

        assert!(dibersihkan);
        assert!(!sw.exists());
        assert!(!cache.exists());
        assert!(!code_cache.exists());
        assert!(local_storage.join("state").exists());
        assert!(indexed_db.join("db").exists());
        assert!(sqlite.exists());
        assert_eq!(
            fs::read_to_string(dir_penanda.join(BERKAS_PENANDA_VERSI)).unwrap(),
            "0.10.4"
        );
    }

    #[test]
    fn versi_sama_tidak_membersihkan_ulang() {
        let tmp = TempDirGuard::new("sama");
        let dir_penanda = tmp.0.join("penanda");
        let cache = tmp.0.join("Cache");

        fs::create_dir_all(&dir_penanda).unwrap();
        fs::create_dir_all(&cache).unwrap();
        fs::write(dir_penanda.join(BERKAS_PENANDA_VERSI), "0.10.4\n").unwrap();
        let berkas_cache = cache.join("baru.bin");
        fs::write(&berkas_cache, "tetap-ada").unwrap();

        let dibersihkan = bersihkan_jika_versi_berubah(&dir_penanda, &[cache.clone()], "0.10.4");

        assert!(!dibersihkan);
        assert!(berkas_cache.exists());
    }

    #[test]
    fn versi_naik_membersihkan_cache_lagi_dan_perbarui_penanda() {
        let tmp = TempDirGuard::new("naik");
        let dir_penanda = tmp.0.join("penanda");
        let cache = tmp.0.join("Cache");

        fs::create_dir_all(&dir_penanda).unwrap();
        fs::create_dir_all(&cache).unwrap();
        fs::write(dir_penanda.join(BERKAS_PENANDA_VERSI), "0.10.4").unwrap();
        fs::write(cache.join("lama.bin"), "cache-0104").unwrap();

        let dibersihkan = bersihkan_jika_versi_berubah(&dir_penanda, &[cache.clone()], "0.10.5");

        assert!(dibersihkan);
        assert!(!cache.exists());
        assert_eq!(
            fs::read_to_string(dir_penanda.join(BERKAS_PENANDA_VERSI)).unwrap(),
            "0.10.5"
        );
    }
}
