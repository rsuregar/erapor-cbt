# Cheatsheet Admin: Pintasan & Tombol Keluar Aplikasi CBT

Dokumen ini berisi panduan dan contekan (*cheatsheet*) pintasan rahasia bagi **Admin, Proktor, dan Pengawas Ujian** untuk menutup aplikasi CBT Al Akhyar pada berbagai kondisi (sebelum login maupun setelah login).

---

## 1. Latar Belakang & Mekanisme Penguncian

Pada aplikasi CBT Al Akhyar mode desktop (**Exam Browser Windows** berbasis Tauri):
- Penutupan jendela standar (seperti kombinasi `Alt + F4` dan tombol silang `X` pada jendela) **sengaja diblokir** pada mode rilis (`CloseRequested.prevent_close()`). Hal ini bertujuan mencegah siswa keluar dari ruang ujian tanpa izin.
- Agar pengawas atau admin lab komputer dapat menutup aplikasi tanpa harus meminjam akun siswa untuk login terlebih dahulu, disediakan **kombinasi tombol rahasia (cheatsheet shortcut)** dan **gestur sentuh rahasia** di layar login.

---

## 2. Keluar Aplikasi Tanpa Login (Layar Masuk)

Ketika aplikasi CBT sedang berada di halaman **Masuk Akun Murid**, seluruh petunjuk visual penutupan aplikasi (seperti tombol merah dan teks pintasan di footer) **sengaja disembunyikan dari siswa** agar mode kiosk tidak disalahgunakan.

Pengawas/admin dapat memicu dialog penutupan aplikasi dengan dua metode rahasia:

### A. Kombinasi Tombol Keyboard (Rahasia Pengawas)
Tekan salah satu kombinasi tombol berikut di keyboard:
- `Ctrl` + `Shift` + `Q` *(Quit)*
- `Ctrl` + `Shift` + `X` *(Exit)*
- `Alt` + `Shift` + `Q` / `X`
- *(Untuk macOS: `Cmd` + `Shift` + `Q` / `X`)*

> [!TIP]
> Kombinasi tombol ini dapat ditekan kapan saja di layar masuk, baik saat kursor sedang berada di dalam kolom input maupun di luar kolom input.

### B. Gestur Layar Sentuh / Mouse (5× Ketukan Cepat)
Jika perangkat menggunakan layar sentuh (tablet/laptop 2-in-1) atau tidak memiliki keyboard fisik:
1. **Ketuk / klik Logo Al Akhyar** di bagian atas sebanyak **5 kali berturut-turut** (dalam waktu 3 detik).
2. **ATAU ketuk / klik lencana Versi Aplikasi** (`v0.1.0`) di bagian footer paling bawah sebanyak **5 kali berturut-turut**.

### C. Keamanan Dialog: Wajib Memasukkan PIN Pengawas
Setelah shortcut atau gestur sentuh dipicu, modal **Khusus Pengawas / Proktor** akan muncul meminta **PIN Pengawas**:
- **PIN Pengawas Default**: `alakhyar`
- **PIN Alternatif / Darurat**: `778899`
- **Kustomisasi PIN**: Dapat diatur via variabel lingkungan `.env`: `VITE_PIN_PENGAWAS=pin_rahasia_anda`.
- Masukkan PIN yang valid lalu klik **Tutup Aplikasi** (merah). Seluruh sesi akun yang tersisa akan otomatis dibersihkan (logout) dan proses aplikasi akan dihentikan secara aman ke sistem operasi.
- Jika PIN salah, sistem akan menolak dan aplikasi tetap terkunci di mode kiosk.
- Klik **Batal** jika ingin kembali ke layar login siswa.

---

## 3. Keluar Aplikasi Setelah Login (Layar Beranda)

Pada layar Beranda siswa:
1. **Tombol Keluar Akun (Ikon Pintu di Kanan Atas)**:
   - Didesain untuk siswa/pengawas yang ingin mengganti akun atau mengakhiri sesi murid.
   - Mengklik tombol ini **hanya me-logout sesi akun murid** (`api.keluar()`, `sesi.keluar()`) dan mengarahkan kembali ke Layar Masuk (`/masuk`).
   - **Aplikasi tetap berada dalam mode Kiosk Exam Browser** sehingga siswa tidak dapat mengakses desktop atau browser luar.
2. **Menutup Aplikasi ke Sistem Operasi (Khusus Pengawas)**:
   - Tekan kombinasi keyboard **`Ctrl + Shift + Q`** atau **`Ctrl + Shift + X`**.
   - Masukkan **PIN Pengawas** (`alakhyar` atau `778899`).
   - Klik **Tutup Aplikasi** untuk menghentikan aplikasi secara menyeluruh dan membuka kunci desktop/perangkat.

---

## 4. Penanganan Otomatis: "Paksa Kumpul" & "Hentikan Sesi" oleh Pengawas

Ketika pengawas menekan **Paksa Kumpul** (satu murid) atau **Hentikan Sesi** (semua murid di sesi) pada dashboard e-Rapor:
1. Detak sinkronisasi otomatis (`POST /sinkron`, tiap 15 detik) pada aplikasi murid menerima HTTP 409 `SUDAH_SELESAI` dengan `alasan_selesai` (`dikumpulkan_pengawas` / `sesi_dihentikan`).
2. Kunci layar kiosk otomatis dilepaskan (`lepasKunciLayar()`).
3. Aplikasi murid **tidak akan macet (stuck)** di lembar soal; layar menampilkan pesan sesuai alasannya:
   - Hentikan Sesi: *"Sesi Ujian Dihentikan Pengawas — Sesi ujian telah dihentikan oleh pengawas/guru. Seluruh lembar pengerjaan Anda telah otomatis dikumpulkan dan tersimpan aman di server."*
   - Paksa Kumpul: *"Ujian Dikumpulkan Pengawas"*.
4. Setelah **10 detik** (atau saat murid mengetuk tombol), aplikasi kembali ke **Beranda Ujian**. Kumpul oleh murid / waktu habis tetap dialihkan setelah 1,8 detik.
5. Murid yang baru akan menekan **Mulai** pada sesi yang sudah dihentikan melihat pesan *"Sesi ujian ini telah dihentikan oleh pengawas."* beserta tombol **Kembali ke Beranda Ujian**.

---

## 5. Ringkasan Pengamanan & Hak Akses

| Kondisi | Target Pengguna | Aksi / Pintasan | Pengamanan | Hasil |
|---|---|---|---|---|
| **Layar Masuk** | Pengawas / Proktor | `Ctrl + Shift + Q` atau 5× ketuk Logo/Versi | **Wajib PIN Pengawas** (`alakhyar` / `778899`) | Menutup aplikasi ke OS |
| **Layar Beranda** | Siswa / Pengawas | Klik tombol Logout (kanan atas) | Konfirmasi Keluar Akun | **Hanya logout akun**, aplikasi tetap terkunci di Layar Masuk |
| **Layar Beranda** | Pengawas / Proktor | `Ctrl + Shift + Q` atau `Ctrl + Shift + X` | **Wajib PIN Pengawas** (`alakhyar` / `778899`) | Logout akun + menutup aplikasi ke OS |
| **Layar Ujian** | Pengawas e-Rapor | Tekan **Paksa Kumpul** di dashboard pengawas | Otorisasi server e-Rapor | Ujian selesai + **otomatis redirect ke dashboard murid** |

---

## 6. Mengatur Mode Maintenance & Akses Web CBT di Cloudflare

Admin dapat menonaktifkan akses web browser (agar siswa wajib memakai Exam Browser Desktop atau Android) atau menyalakan mode pemeliharaan via Cloudflare:

### A. Perintah Cepat via Terminal:
```bash
# 1. Nonaktifkan akses web (hanya izinkan aplikasi resmi; iPhone/iPad ikut terblokir):
npm run deploy:cf:disabled

# 1b. Nonaktifkan web untuk laptop & Android, iPhone/iPad tetap via PWA terpasang:
npm run deploy:cf:ios-only

# 2. Nyalakan mode pemeliharaan server:
npm run deploy:cf:maintenance

# 3. Kembalikan ke web normal:
npm run deploy:cf:normal
```

### B. Via GitHub Actions (Tanpa Terminal):
1. Buka repositori GitHub → Tab **Actions** → Pilih workflow **Deploy PWA**.
2. Klik **Run workflow**.
3. Pada dropdown **PWA Deployment Mode**, pilih `web_disabled`, `web_ios_only` (bila ada peserta iPhone/iPad), `maintenance`, atau `normal`.
4. Tekan tombol hijau **Run workflow**. Cloudflare akan ter-update otomatis.

