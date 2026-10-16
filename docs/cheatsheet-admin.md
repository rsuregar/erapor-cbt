# Cheatsheet Admin: Pintasan & Tombol Keluar Aplikasi CBT

Dokumen ini berisi panduan dan contekan (*cheatsheet*) pintasan rahasia bagi **Admin, Proktor, dan Pengawas Ujian** untuk menutup aplikasi CBT Al Akhyar pada berbagai kondisi (sebelum login maupun setelah login).

---

## 1. Latar Belakang & Mekanisme Penguncian

Pada aplikasi CBT Al Akhyar mode desktop (**Exam Browser Windows** berbasis Tauri):
- Penutupan jendela standar (seperti kombinasi `Alt + F4` dan tombol silang `X` pada jendela) **sengaja diblokir** pada mode rilis (`CloseRequested.prevent_close()`). Hal ini bertujuan mencegah siswa keluar dari ruang ujian tanpa izin.
- Agar pengawas atau admin lab komputer dapat menutup aplikasi tanpa harus meminjam akun siswa untuk login terlebih dahulu, disediakan **kombinasi tombol rahasia (cheatsheet shortcut)** dan **gestur sentuh rahasia** di layar login.

---

## 2. Keluar Aplikasi Tanpa Login (Layar Masuk)

Ketika aplikasi CBT sedang berada di halaman **Masuk Akun Murid**, admin/pengawas dapat memicu dialog penutupan aplikasi dengan dua cara:

### A. Kombinasi Tombol Keyboard (Shortcut)
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

### C. Tombol Visual di Layar Masuk
Pada sudut kanan atas layar masuk (di samping indikator status koneksi), kini tersedia **Tombol Daya / Power**:
- Cukup klik tombol berikon daya merah/putih tersebut untuk membuka modal konfirmasi penutupan aplikasi kapan saja tanpa perlu menghafal pintasan keyboard.

### Dialog Konfirmasi
Setelah shortcut, gestur, atau tombol visual dipicu, modal **Mode Admin / Pengawas** akan muncul:
- Klik **Tutup Aplikasi** (merah) untuk langsung menutup dan menghentikan proses aplikasi. Seluruh sesi akun yang tersisa akan otomatis dibersihkan (logout).
- Klik **Batal** jika ingin kembali ke layar login siswa.

---

## 3. Keluar Aplikasi Setelah Login (Layar Beranda)

Jika user (siswa atau guru) sudah masuk ke aplikasi:
1. Klik tombol **Keluar** (ikon pintu/logout) di sudut kanan atas layar Beranda, **ATAU** tekan kombinasi keyboard **`Ctrl + Shift + Q`** / **`Ctrl + Shift + X`**.
2. Pada jendela konfirmasi, klik **"Tutup dan Keluar"**.
3. Saat diklik:
   - Sesi e-Rapor dan kredensial perangkat langsung dibersihkan secara aman (`api.keluar()`, `sesi.keluar()`). Akun **ter-logout penuh**.
   - Cache paket ujian dihapus dari IndexedDB perangkat.
   - Pada **Exam Browser (Windows)** dan **Aplikasi Android**, aplikasi akan langsung tertutup otomatis.
   - Pada **Web PWA**, sesi dikeluarkan dan halaman dialihkan kembali ke `/masuk`.

---

## 4. Penanganan Otomatis: "Paksa Kumpul" oleh Pengawas

Ketika pengawas menekan tombol **Paksa Kumpul** pada dashboard e-Rapor untuk seorang siswa yang sedang mengerjakan soal:
1. Detak sinkronisasi otomatis (`POST /sinkron`) pada aplikasi murid akan menerima status `selesai` (atau kode galat `SUDAH_SELESAI` / HTTP 409).
2. Kunci layar kiosk otomatis dilepaskan (`lepasKunciLayar()`).
3. Aplikasi murid **tidak akan macet (stuck)** di lembar soal; layar akan menampilkan konfirmasi *"Ujian Selesai & Jawaban Terkumpul"*.
4. Dalam waktu **1,8 detik**, aplikasi secara otomatis mengalihkan (*redirect*) murid kembali ke **Dashboard / Beranda Ujian**.

---

## 5. Ringkasan Pintasan Cepat

| Kondisi | Target Pengguna | Aksi / Pintasan | Hasil |
|---|---|---|---|
| **Layar Masuk (Belum Login)** | Admin / Pengawas | Klik tombol **Power** di pojok kanan atas | Membuka modal admin untuk **Tutup Aplikasi** |
| **Layar Masuk (Belum Login)** | Admin / Pengawas | `Ctrl + Shift + Q` atau `Ctrl + Shift + X` | Membuka modal admin untuk **Tutup Aplikasi** |
| **Layar Masuk (Belum Login)** | Admin / Pengawas | Ketuk **Logo** atau **Versi** 5× cepat | Membuka modal admin untuk **Tutup Aplikasi** |
| **Layar Beranda (Sudah Login)** | Siswa / Pengawas | Tombol Logout / `Ctrl + Shift + Q` | **Logout akun otomatis** + tutup aplikasi |
| **Layar Ujian (Sedang Mengerjakan)** | Pengawas e-Rapor | Tekan **Paksa Kumpul** di dashboard pengawas | Ujian selesai + **otomatis redirect ke dashboard murid** |

---

## 6. Mengatur Mode Maintenance & Akses Web CBT di Cloudflare

Admin dapat menonaktifkan akses web browser (agar siswa wajib memakai Exam Browser Desktop atau Android) atau menyalakan mode pemeliharaan via Cloudflare:

### A. Perintah Cepat via Terminal:
```bash
# 1. Nonaktifkan akses web (hanya izinkan aplikasi resmi):
npm run deploy:cf:disabled

# 2. Nyalakan mode pemeliharaan server:
npm run deploy:cf:maintenance

# 3. Kembalikan ke web normal:
npm run deploy:cf:normal
```

### B. Via GitHub Actions (Tanpa Terminal):
1. Buka repositori GitHub → Tab **Actions** → Pilih workflow **Deploy PWA**.
2. Klik **Run workflow**.
3. Pada dropdown **PWA Deployment Mode**, pilih `web_disabled`, `maintenance`, atau `normal`.
4. Tekan tombol hijau **Run workflow**. Cloudflare akan ter-update otomatis.

