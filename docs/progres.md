# Progres app murid

Salinan status story **app murid** dari `erapor/docs/cbt/Backlog MVP.md`.
Backlog itulah sumber kebenarannya: ubah di sana dulu, baru salin ke sini.
Rencana sprint berjalan ada di `erapor/docs/cbt/sprint-5-app-murid-pilot.md`.

Per **14 Okt 2026**. Server dan panel guru (e-Rapor `feat-cbt`, PR #555)
sudah selesai untuk semua endpoint yang dipakai app ini.

Arti status: **Kode jadi** = fitur sudah ada di app, tapi belum diuji di HP
Android/iPhone di staging (Definition of Done). **Sebagian** = sisanya
disebut.

| ID | Story | Status | Sprint |
| --- | --- | --- | --- |
| 2.5 | Sesi login bertahan, satu perangkat | Selesai (perangkat terikat per attempt) | S3 |
| 6.1 | Daftar ujian hari ini / mendatang / riwayat | Kode jadi | S3 |
| 6.2 | Pra-unduh paket terenkripsi + indikator siap | Kode jadi | S3 |
| 6.3 | Mengerjakan semua jenis soal di HP & laptop | Kode jadi | S3 |
| 6.4 | Timer jam server, kumpul otomatis | Kode jadi | S3 |
| 6.5 | Jawaban tidak hilang saat offline | Kode jadi — uji otomatis offline 10 menit (`packages/exam-core/test/offline.test.ts`): 0 hilang/dobel, termasuk app dibuka ulang dan balasan hilang | S3 → S5 |
| 6.6 | Kumpul saat offline ("Menunggu sinkron") | Kode jadi | S3 |
| 6.7 | Lanjut di perangkat lain setelah reset pengawas | Kode jadi | S3 |
| 7.2 | Deteksi keluar dari ujian, terkunci di ambang | Kode jadi | S3 |
| 7.3 | Cek kesiapan perangkat sebelum Mulai | Kode jadi — browser, versi (pembaruan PWA), tampilan (standalone / layar penuh), ukuran layar, penyimpanan, baterai; Ketat/Lockdown di laptop wajib layar penuh selama ujian. Versi app minimum menunggu kontrak (7.7) | S3 → S5 |
| 7.4 | Panduan jalur cadangan PWA | Kode jadi — `/panduan` tanpa login: pasang aplikasi + Akses Terpandu (iOS) / Sematkan Aplikasi (Android) / laptop, ilustrasi per langkah, tombol Pasang sekarang | S3 → S5 |
| 7.5 | Watermark; blok salin/klik kanan/cetak | Kode jadi — watermark nama + NIS; salin/potong/tempel, klik kanan, seret, tekan-lama iOS, Ctrl/Cmd+P/S/U diblokir; cetak menghasilkan halaman kosong berpesan. Tidak dicatat sebagai pelanggaran `salin_tempel` | S3 → S5 |
| 7.6 | Muat ulang di Lockdown → terkunci | Selesai (dibuka pengawas) | S3 |
| 7.7 | App Capacitor Android/iOS, kunci layar, SQLite, geolokasi native (deteksi lokasi palsu) | Kode jadi — proyek Android/iOS + Tauri desktop, startLockTask & FLAG_SECURE, SQLite native (erapor_cbt.db) + IndexedDB fallback, CI/CD build APK/DMG/MSI | S3 → S5 |
| 7.8 | Mode ujian iOS otomatis | Belum (P1); entitlement Apple belum diajukan | S5 |
| 7.9 | Lokasi ujian: izin GPS, kirim posisi, pesan galat | Kode jadi — koordinat, geofencing radius sekolah, dan deteksi palsu (isMock/isFromMockProvider) di UjianNativePlugin | S5 |
| 2.4 | Login QR di kartu ujian | Belum (P1); format QR belum disepakati | S5 |

## Sinkron dengan e-Rapor

- **Kontrak API**: `erapor/docs/cbt/kontrak-api-murid.md` →
  `packages/exam-core/src/kontrak.ts`. Sudah sinkron per 14 Okt, termasuk
  § Lokasi ujian (`UjianRingkas.lokasi`, `Lokasi`, `MulaiRespons.lokasi_wajib`
  / `level_keamanan`, `Detak.lokasi`, 5 kode galat lokasi).
- **Tampilan soal**: `ERAPOR_DIR=../erapor npm run sinkron:renderer`.
- **Pelanggaran tak dihitung**: `offline` dan `keluar_lokasi` (server).
  `keluar_lokasi` hanya dicatat server dari `detak.lokasi`; app tidak
  mengirimnya.
