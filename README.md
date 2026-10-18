# erapor-cbt — Aplikasi Ujian Murid

Aplikasi ujian CBT (*Computer-Based Testing*) resmi untuk murid Sekolah Islam Al Akhyar. Panel guru/admin/pengawas berada di e-Rapor (`feat-cbt`); aplikasi ini khusus untuk antarmuka pengerjaan ujian murid dan berinteraksi dengan API murid e-Rapor (`/api/cbt`, spesifikasi kontrak: `erapor/docs/cbt/kontrak-api-murid.md`).

Satu kode sumber, **lima target keluaran** (PRD Multiplatform & Tech Stack):

| Target Keluaran | Platform | Kiosk Lock / Keamanan | Penyimpanan Offline |
| --- | --- | --- | --- |
| **Aplikasi Android** | HP & Tablet Android (Capacitor 7) | Android Lock Task + `FLAG_SECURE` | SQLite Native (`SQLiteOpenHelper`) |
| **Aplikasi iOS** | iPhone & iPad (Capacitor 7) | iOS Assessment Mode (AAC) | SQLite Native |
| **Exam Browser Windows** | PC Lab & Laptop Windows (Tauri v2) | Kiosk Mode + Cegah Alt+F4 / Task Switch | SQLite Native (`rusqlite` WAL) |
| **Exam Browser macOS** | Laptop Mac (Tauri v2) | Kiosk Fullscreen Mode | SQLite Native (`rusqlite` WAL) |
| **Web PWA** | Web Browser / Cadangan darurat | Browser Fullscreen API | IndexedDB (Fallback Otomatis) |

---

## Arsitektur & Teknologi

- **Frontend Core**: React 18, TypeScript, Vite, Tailwind CSS v3.
- **Navigasi & Data Cache**: TanStack Router untuk halaman aplikasi (`/masuk`, `/`, `/ujian/$ujianId`, `/kerjakan/$attemptId`, `/hasil/$attemptId`) dan TanStack Query untuk data server biasa.
- **Sistem Inti Ujian (`packages/exam-core`)**: TypeScript murni tanpa dependensi DOM. Bertanggung jawab atas:
  - Dekripsi paket soal terenkripsi (AES-256-GCM) langsung di perangkat.
  - Outbox antrean jawaban dengan urutan sekuensial (*monotonically increasing sequence*).
  - Jam server tersinkronisasi (*clock skew compensation*).
  - Sinkronisasi periodik (detak 15 detik) dengan idempotency key.
- **Penyimpanan Terpadu (`PenyimpananApp`)**: Otomatis memilih adapter native SQLite di Android (`erapor_cbt.db`) dan Desktop Tauri (`erapor_cbt.db`), dengan fallback transparan ke IndexedDB di Web PWA.
- **Exam Browser Desktop (Tauri v2 + Rust)**: Aplikasi ringan native tanpa overhead Chromium ganda, menggunakan engine WebView bawaan OS dan persistensi native SQLite via `rusqlite`.
- **Desain & Tipografi**: Mengikuti **Al Akhyar Design System** (`#006195`), tipografi *Plus Jakarta Sans* yang dibundel secara lokal (offline-first tanpa CDN Google Fonts).
- **Integritas Ujian**: Pencegahan kecurangan, deteksi lokasi palsu (mock location), dan proteksi tangkapan layar.

---

## Keamanan Kiosk & Pintasan Pengawas

Aplikasi Exam Browser dan Mobile dikunci secara ketat agar siswa tidak dapat membuka tab lain, berpindah aplikasi, atau menutup jendela ujian.

- **Tanpa Tombol Keluar Siswa**: Seluruh tombol visual keluar dan bocoran pintasan disembunyikan dari antarmuka murid.
- **Verifikasi PIN Pengawas**: Menutup aplikasi ke sistem operasi wajib memasukkan PIN Pengawas (default: `alakhyar` atau `778899`, dapat diatur via `.env`: `VITE_PIN_PENGAWAS`).
- **Pintasan Rahasia Pengawas**:
  - Keyboard: `Ctrl + Shift + Q` atau `Ctrl + Shift + X` (di macOS: `Cmd + Shift + Q`).
  - Layar Sentuh / Tablet: Ketuk **Logo Al Akhyar** atau **Lencana Versi** 5× berturut-turut dalam 3 detik.
- **Pemisahan Hak Akses**: Tombol logout di halaman Beranda hanya mengeluarkan sesi akun murid dan tetap mengunci perangkat di dalam mode Kiosk pada Layar Masuk.
- Detail lengkap dapat dibaca di **[`docs/cheatsheet-admin.md`](docs/cheatsheet-admin.md)**.

---

## Struktur Monorepo

```
erapor-cbt/
├── apps/
│   └── ujian/                     # Aplikasi utama React (PWA + Capacitor + Tauri)
│       ├── android/               # Proyek native Android (Java/Gradle, SQLite & LockTask)
│       ├── src-tauri/             # Backend native Desktop Rust (Tauri v2 + rusqlite)
│       └── src/                   # Halaman UI, komponen, dan jembatan native
├── packages/
│   ├── exam-core/                 # Inti logika CBT (enkripsi, outbox, sqlite, sync)
│   └── question-renderer/         # Renderer komponen soal (identik dengan pratinjau guru)
├── docs/                          # Dokumentasi arsitektur, panduan, dan cheatsheet
└── scripts/                       # Skrip automasi sinkronisasi renderer & maintenance
```

---

## Panduan Menjalankan & Membangun

### 1. Prasyarat Sistem
- **Node.js**: >= 22 (direkomendasikan Node.js 24 LTS)
- **Rust & Cargo**: >= 1.77 (hanya jika mengembangkan desktop Tauri)
- **Java / JDK**: OpenJDK 21 (`brew install openjdk@21` untuk build Android)
- **Android SDK**: `~/Library/Android/sdk` (dicatat di `apps/ujian/android/local.properties`)

### 2. Instalasi & Mode Pengembangan Lokal
```bash
# Instal dependensi monorepo
npm install

# Jalankan server pengembangan Web PWA (port 5180)
npm run dev

# Jalankan Exam Browser Desktop (Tauri v2)
npm run desktop:dev

# Jalankan pengujian unit & verifikasi tipe
npm test
npm run typecheck
```

> [!TIP]
> **Mode Demo Pengembang**: Saat menjalankan `npm run dev`, Anda dapat masuk dengan username `demo` (sandi bebas) untuk menguji antarmuka tanpa harus menyalakan server backend e-Rapor.

### 3. Kompilasi Produksi

#### A. Web PWA
```bash
npm run build                      # Hasil build di apps/ujian/dist
```

#### B. Exam Browser Desktop (Windows & macOS)
```bash
npm run desktop:build              # Menghasilkan .exe/.msi (Windows) atau .dmg (macOS)
```

#### C. Aplikasi Android (APK)
```bash
cd apps/ujian
npm run android:apk                # APK produksi: android/app/build/outputs/apk/debug/app-debug.apk
npm run android:apk:demo           # APK demo offline (tanpa butuh koneksi server)
```

---

## Perintah Perawatan & Cloudflare

```bash
# Salin renderer soal (sumber: repo ini) ke repositori e-Rapor
ERAPOR_DIR=../erapor npm run sinkron:renderer

# Sinkronkan branch main ke fork organisasi Al Akhyar
npm run sync:org

# Deploy PWA ke Cloudflare (Normal)
npm run deploy:cf:normal

# Deploy staging (Worker Preview, API staging) ke https://staging.cbt.alakhyar.sch.id
npm run deploy:cf:staging

# Pasang Halaman Maintenance di Cloudflare
npm run deploy:cf:maintenance

# Nonaktifkan akses web browser (Wajib pakai Exam Browser / Android; iPhone/iPad ikut terblokir)
npm run deploy:cf:disabled

# Nonaktifkan web untuk laptop & Android, iPhone/iPad tetap via PWA terpasang
npm run deploy:cf:ios-only
```

---

## Alur Otomatis CI/CD (GitHub Actions)

Repositori ini dilengkapi dengan 6 alur kerja otomatis di `.github/workflows/`:

1. **CI ([`ci.yml`](.github/workflows/ci.yml))**: Menjalankan lint, typecheck, dan unit test otomatis di setiap PR dan push ke `main`.
2. **Deploy PWA ([`deploy-pwa.yml`](.github/workflows/deploy-pwa.yml))**: Membangun dan men-deploy PWA ke server hosting Cloudflare / Web Server dengan pilihan mode (*normal*, *maintenance*, *web_disabled*, *web_ios_only*).
3. **Build Android ([`build-android.yml`](.github/workflows/build-android.yml))**: Mengompilasi APK Android secara otomatis saat tag rilis dibuat.
4. **Build iOS ([`build-ios.yml`](.github/workflows/build-ios.yml))**: Menyiapkan dan memvalidasi build arsip Xcode iOS (.xcarchive).
5. **Build Desktop Windows ([`build-desktop-windows.yml`](.github/workflows/build-desktop-windows.yml))**: Mengompilasi installer `.msi` dan `.exe` untuk PC Lab Windows.
6. **Build Desktop macOS ([`build-desktop-macos.yml`](.github/workflows/build-desktop-macos.yml))**: Mengompilasi installer `.dmg` untuk perangkat Apple macOS.

---

## Indeks Dokumentasi

Pelajari dokumentasi teknis lebih detail pada direktori [`docs/`](docs/):

- 📘 **[Arsitektur Multiplatform & Sistem Penyimpanan Offline](docs/arsitektur-dan-offline-desktop.md)** — Evaluasi database offline dan arsitektur SQLite Tauri Desktop & Android.
- 🔑 **[Cheatsheet Admin & Pintasan Keluar](docs/cheatsheet-admin.md)** — Panduan proktor untuk PIN pengawas, kombinasi keyboard rahasia, dan penanganan paksa kumpul.
- ☁️ **[Panduan Mode Maintenance & Cloudflare](docs/panduan-maintenance-dan-cloudflare.md)** — Pengaturan mode perbaikan dan proteksi akses web via Cloudflare.
- 🚀 **[Panduan Build & CI/CD](docs/panduan-build-dan-cicd.md)** — Pengaturan GitHub Secrets, signing APK/iOS, dan build manual.
- 📋 **[Progres & Status Backlog MVP](docs/progres.md)** — Pelacakan status pengerjaan seluruh story fitur ujian.

---

## Lisensi & Kepemilikan

Hak Cipta © 2026 **Sekolah Islam Al Akhyar**. Dirilis di bawah [Lisensi MIT](LICENSE).  
Dikembangkan untuk platform Ujian Digital Resmi e-Rapor Al Akhyar.
