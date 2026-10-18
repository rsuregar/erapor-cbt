# Panduan Build Mobile (APK & iOS) dan CI/CD

Dokumen ini memuat panduan lengkap alur **CI/CD (GitHub Actions)** dan instruksi **Build Manual di Lokal** untuk:
1. **PWA (Progressive Web App)**
2. **Android APK**
3. **iOS App (iPhone/iPad)**

---

## 1. Alur CI/CD (GitHub Actions)

Proyek ini telah dilengkapi alur otomatis terpisah di folder `.github/workflows/`:

| Workflow | File | Pemicu (Trigger) | Fungsi |
| :--- | :--- | :--- | :--- |
| **CI (Check & Test)** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Push & PR ke `main`, atau manual | Memeriksa validasi tipe TypeScript (`npm run typecheck`), menjalankan unit test (`npm test`), dan memvalidasi build (`npm run build`). |
| **Build Android APK** | [`.github/workflows/build-android.yml`](../.github/workflows/build-android.yml) | • Tag `release-mobile-*` atau `release-android-*`<br>• Manual (`workflow_dispatch`) | Menghasilkan installer **Android APK** (Release/Debug) siap pasang; pada tag, APK diterbitkan ke GitHub Release. |
| **Build iOS App** | [`.github/workflows/build-ios.yml`](../.github/workflows/build-ios.yml) | • Tag `release-mobile-*` atau `release-ios-*`<br>• Manual (`workflow_dispatch`) | Menghasilkan arsip **iOS App (.xcarchive.zip)** untuk iPhone/iPad; pada tag, diterbitkan ke GitHub Release. |
| **Build Windows Desktop** | [`.github/workflows/build-desktop-windows.yml`](../.github/workflows/build-desktop-windows.yml) | • Tag `release-desktop-*` atau `release-win-*`<br>• Manual (`workflow_dispatch`) | Menghasilkan installer **Windows (.exe NSIS & .msi)** mode Exam Browser Kiosk; pada tag, diterbitkan ke GitHub Release. |
| **Build macOS Desktop** | [`.github/workflows/build-desktop-macos.yml`](../.github/workflows/build-desktop-macos.yml) | • Tag `release-desktop-*` atau `release-macos-*`<br>• Manual (`workflow_dispatch`) | Menghasilkan installer **macOS (.dmg)** mode Exam Browser Kiosk; pada tag, diterbitkan ke GitHub Release. |
| **Deploy PWA** | [`.github/workflows/deploy-pwa.yml`](../.github/workflows/deploy-pwa.yml) | Manual (`workflow_dispatch`) | Deploy cadangan ke web server VPS via SSH/SCP jika tidak menggunakan Cloudflare. |

---

## 2. GitHub Environments & Variables yang Digunakan

Repositori ini menggunakan fitur resmi **GitHub Environments** (`Settings → Environments`), yaitu:
1. **`staging`**
2. **`production`**

### A. Environment Variables (Didaftarkan di dalam masing-masing Environment)
Cukup daftarkan 1 nama variabel di tiap Environment:
* **`VITE_API_URL`**:
  - Pada Environment `staging`: `https://erapor.staging.alakhyar.sch.id/api`
  - Pada Environment `production`: `https://erapor.alakhyar.sch.id/api`

*(GitHub Actions akan secara otomatis menginjeksikan `vars.VITE_API_URL` sesuai target environment yang Anda pilih saat menjalankan workflow atau berdasarkan git tag).*

### B. Deployment Secrets (Opsional, untuk SSH Deploy PWA)
Jika menggunakan alur deploy PWA mandiri via SSH/SCP ke server VPS:
* `HOST`: Alamat IP / domain server VPS
* `USERNAME`: User SSH server VPS
* `SSH_KEY` / `SSH_PRIVATE_KEY`: Kunci privat SSH server VPS

### C. Android Signing Secrets (Opsional, untuk Release Signed APK)
Jika ingin CI/CD otomatis menandatangani APK Release di Android:
* `ANDROID_KEYSTORE_BASE64`: File `.keystore` yang di-encode base64 (`base64 -i release.keystore | pbcopy`)
* `ANDROID_KEYSTORE_PASSWORD`: Password keystore
* `ANDROID_KEY_ALIAS`: Alias key (misal: `alakhyar-cbt`)
* `ANDROID_KEY_PASSWORD`: Password key

*(Catatan: Jika secrets keystore di atas belum diisi, CI akan otomatis menghasilkan APK Debug yang tetap bisa langsung di-install dan diuji oleh siswa/guru).*

---

## 3. Menjalankan Build Manual & Versioning via GitHub Actions

Anda tidak harus selalu push commit untuk membangun aplikasi atau deploy PWA. Bisa dijalankan manual lewat browser atau via tag Git:

### A. Parameter Workflow Dispatch (Manual Run):
1. Buka tab **Actions** di repositori GitHub.
2. Pilih workflow sesuai platform (**Build Android APK**, **Build Desktop Windows**, **Build Desktop macOS**, atau **Build iOS App**).
3. Klik tombol **Run workflow**.
4. Parameter yang tersedia:
   * **Target Environment**: `production` atau `staging`.
   * **Build Type** *(khusus Android)*: `release` atau `debug`.
   * **Version Name / SemVer**: (opsional, contoh: `1.0.0`) — jika dikosongkan, CI otomatis mengambil dari tag git atau `package.json`.
   * **Build Number / Version Code**: (opsional, contoh: `42`) — jika dikosongkan, CI otomatis memakai nomor urut build GitHub (`github.run_number`).
5. Klik **Run workflow**. Hasil build dapat diunduh di bagian **Artifacts**.

#### Konvensi nama hasil build
Semua berkas (artifact dan aset GitHub Release) memakai satu pola:

```
cbt-al-akhyar-<platform>[-<env>]-v<versi>-b<build>[-<arch>][-<varian>].<ext>
```

* `platform`: `windows` · `macos` · `android` · `ios`
* `env`: hanya ditulis bila **bukan** production (`-staging`); build production tanpa label. Build staging memakai API staging, jadi harus terlihat beda.
* `build`: nomor build (Android `versionCode`, iOS `CFBundleVersion`)
* `arch`: hanya untuk desktop yang berbeda per arsitektur (`x64`, `arm64`)
* `varian`: jenis paket bila ada lebih dari satu (`setup` NSIS, `release`/`debug` APK, `unsigned` arsip iOS)

| Platform | Contoh berkas (production) | Nama artifact (zip) |
| :--- | :--- | :--- |
| Windows | `cbt-al-akhyar-windows-v1.2.0-b7-x64-setup.exe`, `cbt-al-akhyar-windows-v1.2.0-b7-x64.msi` | `cbt-al-akhyar-windows-v1.2.0-b7` |
| macOS | `cbt-al-akhyar-macos-v1.2.0-b7-arm64.dmg` | `cbt-al-akhyar-macos-v1.2.0-b7` |
| Android | `cbt-al-akhyar-android-v1.2.0-b7-release.apk` | `cbt-al-akhyar-android-v1.2.0-b7` |
| iOS | `cbt-al-akhyar-ios-v1.2.0-b7-unsigned.xcarchive.zip` | `cbt-al-akhyar-ios-v1.2.0-b7` |

Build staging, contoh: `cbt-al-akhyar-android-staging-v1.2.0-b7-debug.apk`.

### B. Rilis via Git Tag (dibaca fitur cek pembaruan app):
Tag `release-*` membangun lalu **menerbitkan** hasil build ke GitHub Release. Nomor versi diambil dari tag:

| Tag | Membangun | Release |
| :--- | :--- | :--- |
| `release-desktop-X.Y.Z` | Windows + macOS | 1 release berisi `.exe`, `.msi`, `.dmg` |
| `release-win-X.Y.Z` | Windows saja | `.exe`, `.msi` |
| `release-macos-X.Y.Z` | macOS saja | `.dmg` |
| `release-mobile-X.Y.Z` | Android + iOS | 1 release berisi `.apk`, `.xcarchive.zip` |
| `release-android-X.Y.Z` | Android saja | `.apk` |
| `release-ios-X.Y.Z` | iOS saja | `.xcarchive.zip` |

Buat tag dari `main` (bersih & sama dengan `origin/main`) dengan pembantu rilis. Pembantu ini menampilkan catatan rilis, membuat **tag beranotasi** berisi catatan itu, lalu push:

```bash
npm run rilis -- android 1.2.0 --pratinjau   # lihat catatan rilis saja, tanpa membuat tag
npm run rilis -- desktop 1.2.0               # buat & push release-desktop-1.2.0
npm run rilis -- mobile 1.2.0
```
Akhiran setelah versi (mis. `1.3.0-rc.1`, `-staging`) diterbitkan sebagai **pra-rilis** dan diabaikan app. Tag lama (`v*`, `android-*`, `windows-*`, `macos-*`, `ios-*`, `desktop-*`) tidak lagi memicu build; gunakan Manual Run bila hanya perlu artifact tanpa rilis.

#### Catatan rilis (wajib, otomatis)
Setiap GitHub Release memuat catatan yang dibuat [`scripts/catatan-rilis.mjs`](../scripts/catatan-rilis.mjs) dari templat [`.github/catatan-rilis.md`](../.github/catatan-rilis.md). Catatan ini dibuat juga untuk tag yang dibuat manual dengan `git tag`; bila gagal dibuat, rilis tidak diterbitkan.
* **Pembanding**: tag rilis sebelumnya dengan versi lebih rendah untuk platform yang beririsan (mis. `release-desktop-1.2.0` dibandingkan dengan `release-desktop-*`, `release-win-*`, atau `release-macos-*` terakhir). Pra-rilis tidak dipakai sebagai pembanding rilis stabil.
* **Pengelompokan** dari pesan commit [Conventional Commits](https://www.conventionalcommits.org/) (`jenis(cakupan): judul`):

  | Jenis commit | Bagian |
  | :--- | :--- |
  | `feat` | Apa yang baru |
  | `fix` | Perbaikan |
  | `perf`, `refactor`, `style`, `sec` | Perubahan |
  | lainnya (`ci`, `docs`, `chore`, `build`, `test`, tanpa format) | Lainnya |
  | `jenis!:` atau `BREAKING CHANGE:` di badan commit | juga di **Perubahan penting** |
* Bagian kosong disembunyikan. Di akhir catatan ada tautan **perbandingan lengkap** ke repo kode, yang hanya bisa dibuka anggota tim karena repo kode private.
* Mengubah format: edit `.github/catatan-rilis.md`. Placeholder yang tersedia tercantum di komentar templat.
* Build workflow memakai `fetch-depth: 0` agar riwayat dan tag lengkap tersedia untuk perbandingan.

#### Prasyarat sekali jalan: repo rilis publik
Repo kode ini **private**, sedangkan app yang dipasang di perangkat murid tidak boleh membawa token. Karena itu rilis diterbitkan ke repo **publik terpisah** (hanya berisi installer, tanpa kode):
1. Buat repo publik, mis. `rsuregar/erapor-cbt-releases`, **dengan minimal satu commit** (centang *Add a README*); GitHub menolak membuat release di repo kosong.
2. Buat *fine-grained personal access token* dengan akses **Contents: Read and write** ke repo rilis itu saja, simpan sebagai secret **`RELEASE_TOKEN`** di repo kode (`Settings → Secrets and variables → Actions`).
3. Bila nama repo rilis bukan `rsuregar/erapor-cbt-releases`, isi repository variable **`RELEASE_REPO`** (`owner/repo`). Nilai yang sama otomatis ditanam ke app sebagai `VITE_UPDATE_REPO`.

#### Cek pembaruan di app
Saat dibuka (Windows, macOS, Android, iOS; bukan PWA), halaman **Masuk** dan **Beranda** memeriksa `https://api.github.com/repos/<repo rilis>/releases` dan menampilkan spanduk bila ada versi lebih baru:
* Versi dibandingkan dari nomor pada tag (bukan tanggal). Hanya rilis yang memuat berkas platform perangkat itu yang dihitung (mis. build macOS gagal → Mac tidak ditawari versi itu).
* Hasil di-cache 6 jam per perangkat: API GitHub tanpa token dibatasi 60 permintaan/jam per IP, dan lab sekolah berbagi satu IP.
* Tombol **Unduh pembaruan** membuka tautan installer di browser sistem; pemasangan dilakukan manual. Di Exam Browser desktop, mode kios dilepas sementara agar browser terlihat dan dipulihkan saat jendela app difokuskan lagi. Spanduk tidak muncul di layar ujian.
* iOS: berkas rilis adalah arsip tanpa tanda tangan, bukan IPA yang bisa dipasang langsung; distribusi iOS ke murid tetap lewat jalur Apple (TestFlight/App Store).
* Jaringan/GitHub gagal → spanduk tidak tampil (tanpa galat).

### C. Mode Deploy PWA (Progressive Web App):
Saat menjalankan workflow **Deploy PWA**, Anda dapat memilih mode operasi:
1. **`normal`**: Membangun & mendeploy aplikasi web CBT lengkap seperti biasa.
2. **`web_disabled`**: Menonaktifkan **semua** akses ujian via web browser. Menampilkan laman resmi Al Akhyar yang mengarahkan peserta ke aplikasi resmi (Windows, macOS, Android) serta otomatis membersihkan cache PWA di browser peserta. **iPhone/iPad ikut terblokir** (iOS hanya punya jalur PWA), jadi jangan dipakai bila ada peserta iPhone/iPad — gunakan `web_ios_only`.
3. **`web_ios_only`**: Web hanya untuk **iPhone/iPad yang membuka PWA terpasang** (ikon Layar Utama). Laptop dan Android dialihkan ke `/web-nonaktif.html` (wajib aplikasi resmi) dan cache PWA-nya dibersihkan. Di iPhone/iPad yang membuka lewat tab Safari biasa, app tetap bisa login & membuka Panduan, tetapi tombol **Mulai ujian terkunci** di semua level keamanan sampai ujian dibuka dari ikon. Pengecekan memakai `navigator.standalone` (khusus WebKit iOS), sehingga laptop yang meniru user agent iPhone tetap tidak bisa memulai ujian. Kunci layar tetap lewat Akses Terpandu.
4. **`maintenance`**: Mode pemeliharaan sistem dengan pesan informatif dan status perbaikan.
5. **`custom_message`**: Pesan khusus tambahan (opsional) yang ingin ditampilkan kepada peserta saat mode `web_disabled`, `web_ios_only`, atau `maintenance` aktif.

### D. Sinkronisasi Versi Lokal (`scripts/set-version.mjs`):
Sebelum build manual di komputer lokal, Anda dapat menyinkronkan versi seluruh platform (package.json, Tauri, Android build.gradle, Cargo.toml) dengan:
```bash
node scripts/set-version.mjs 1.0.0 42
```

---

## 4. Panduan Build Manual di Komputer Lokal

### A. Persiapan Lingkungan (Khusus Mac / Linux)
* **Node.js**: Versi 22 (`nvm use 22`)
* **Java**: OpenJDK 21 (`/opt/homebrew/opt/openjdk@21`)
* **Android SDK**: `~/Library/Android/sdk`
* **Xcode**: Versi 15/16 (untuk build iOS)

---

### B. Build Android APK Lokal

1. Buka folder app:
   ```bash
   cd apps/ujian
   ```
2. Pastikan environment `JAVA_HOME` aktif:
   ```bash
   export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
   ```
3. **Build APK Debug** (langsung bisa diuji di HP/Emulator):
   ```bash
   VITE_API_URL="https://erapor.alakhyar.sch.id/api" npm run android:apk
   ```
   *Output file:*
   `apps/ujian/android/app/build/outputs/apk/debug/app-debug.apk`

4. **Build APK Release** (Signed untuk Produksi):
   * Generate keystore (jika belum punya):
     ```bash
     cd android/app
     keytool -genkey -v -keystore release.keystore -alias alakhyar-cbt -keyalg RSA -keysize 2048 -validity 10000
     cd ../..
     ```
   * Jalankan build & sync:
     ```bash
     VITE_API_URL="https://erapor.alakhyar.sch.id/api" npm run build
     npx cap sync android
     cd android
     ./gradlew assembleRelease
     ```
   * *Output file:*
     `apps/ujian/android/app/build/outputs/apk/release/app-release-unsigned.apk` (atau signed jika sudah disetel di `build.gradle`).

---

### C. Build iOS App (Xcode) Lokal

1. Masuk ke direktori app:
   ```bash
   cd apps/ujian
   ```
2. Install dependensi Capacitor iOS (jika belum):
   ```bash
   npm install @capacitor/ios
   ```
3. Tambahkan platform iOS (hanya dilakukan sekali saat inisialisasi):
   ```bash
   npx cap add ios
   ```
4. Build web dan sinkronkan ke iOS:
   ```bash
   VITE_API_URL="https://erapor.alakhyar.sch.id/api" npm run build
   npx cap sync ios
   ```
5. Buka proyek di Xcode:
   ```bash
   npx cap open ios
   ```
6. Di Xcode:
   * Pilih target **App**, buka tab **Signing & Capabilities**, pilih **Development Team**.
   * Pilih Simulator atau iPhone fisik yang terhubung via kabel data.
   * Tekan tombol **Run (`Cmd + R`)** untuk menjalankan app.
   * Untuk membuat file IPA distribusi, pilih menu **Product → Archive**.

---

## 5. Alternatif Hosting PWA Modern: Cloudflare Pages, Vercel & Netlify

Selain deploy via SSH/SCP ke server sendiri, front-end PWA `erapor-cbt` adalah **Pure Static SPA** (Vite + React) yang sangat ideal di-host di platform Edge CDN seperti **Cloudflare Pages**, **Vercel**, atau **Netlify**.

### Perbandingan: Cloudflare Pages vs Vercel vs Netlify

| Kriteria | Cloudflare Pages (Disarankan) | Vercel | Netlify |
| :--- | :--- | :--- | :--- |
| **Bandwidth** | **Gratis Unlimited** 🌟 | Gratis 100 GB / bulan | Gratis 100 GB / bulan |
| **Edge CDN Indonesia** | **Edge Jakarta** (Ultra-low latency) | Global CDN (Singapura) | Global CDN |
| **Kemudahan Setup** | Sangat mudah (Connect GitHub) | Sangat mudah (Connect GitHub) | Sangat mudah (Connect GitHub) |
| **SPA Routing** | Berkas [`wrangler.json`](../wrangler.json) | Berkas [`vercel.json`](../vercel.json) | Berkas [`netlify.toml`](../netlify.toml) |

---

### A. Cara Deploy ke Cloudflare (Workers Static Assets / Pages)

Proyek ini telah dikonfigurasi dengan berkas [`wrangler.json`](../wrangler.json) yang otomatis melayani static assets `./apps/ujian/dist` dengan SPA routing.

#### 1. Perintah Cepat via Terminal (CLI):
```bash
# A. Deploy Versi Normal (PWA Penuh):
npm run deploy:cf:normal

# B. Deploy Mode Akses Web Dinonaktifkan (Wajib Pakai Aplikasi Mobile/Desktop):
npm run deploy:cf:disabled

# C. Deploy Mode Maintenance (Pemeliharaan Server / Sinkronisasi Nilai):
npm run deploy:cf:maintenance
```

*(Semua mode pemeliharaan dan penonaktifan web secara otomatis menyertakan pembersih Service Worker & Cache PWA agar browser siswa langsung ter-reset).*

#### 2. Deploy Otomatis via GitHub Actions:
Workflow [`.github/workflows/deploy-pwa.yml`](../.github/workflows/deploy-pwa.yml) mendukung Cloudflare secara otomatis:
1. Tambahkan secret di GitHub (`Settings → Secrets and variables → Actions`):
   - `CLOUDFLARE_API_TOKEN`: API Token Cloudflare Anda (dengan izin Edit Cloudflare Workers/Pages).
   - `CLOUDFLARE_ACCOUNT_ID`: Account ID Cloudflare Anda.
2. Jalankan workflow **Deploy PWA** via menu `Actions` → `Run workflow`.
3. Pilih opsi **PWA Deployment Mode**:
   - `normal`
   - `web_disabled`
   - `web_ios_only`
   - `maintenance`
4. GitHub Actions akan mengompilasi dan mengunggah langsung ke Cloudflare dalam hitungan detik.


---

### B. Cara Deploy ke Vercel

1. Masuk ke dashboard [Vercel](https://vercel.com/) → **Add New Project** → Import repositori `erapor-cbt`.
2. Atur konfigurasi project:
   * **Framework Preset**: `Vite`
   * **Root Directory**: `./` (Root monorepo)
   * **Build Command**: `npm run build`
   * **Output Directory**: `apps/ujian/dist`
3. Tambahkan **Environment Variable**:
   * `VITE_API_URL`: URL API backend produksi
4. Klik **Deploy**.

*(Catatan: File `vercel.json` di root sudah mengonfigurasi SPA rewrite dan header no-cache untuk `sw.js` & `manifest.webmanifest`).*

---

### C. Cara Deploy ke Netlify

1. Masuk ke dashboard [Netlify](https://app.netlify.com/) → **Add new site** → **Import an existing project** → Pilih GitHub dan repositori `erapor-cbt`.
2. Netlify akan otomatis membaca konfigurasi dari berkas [`netlify.toml`](../netlify.toml):
   * **Base directory**: `.`
   * **Build command**: `npm run build`
   * **Publish directory**: `apps/ujian/dist`
3. Tambahkan **Environment Variable**:
   * Buka **Site configuration → Environment variables** → Tambahkan `VITE_API_URL` mengarah ke URL API backend produksi Anda.
4. Klik **Deploy site**.

*(Catatan: Berkas `netlify.toml` dan `apps/ujian/public/_redirects` sudah memastikan routing SPA berjalan mulus tanpa error 404 saat refresh).*

---

### PENTING: Penyesuaian CORS di Backend Laravel (`erapor`)

Jika Anda menggunakan Cloudflare Pages, Vercel, atau Netlify, buka backend e-Rapor di berkas `config/cors.php`, dan pastikan domain frontend diizinkan pada `allowed_origins`:

```php
'allowed_origins' => [
    'https://cbt.alakhyar.sch.id',       // Custom domain sekolah
    'https://*.pages.dev',               // Preview & Production Cloudflare Pages
    'https://*.vercel.app',              // Preview & Production Vercel
    'https://*.netlify.app',             // Preview & Production Netlify
    'capacitor://localhost',             // iOS App
    'https://localhost',                 // Android App
    'http://localhost:5180',             // Development lokal
    'tauri://localhost',                 // Tauri Desktop Exam Browser
    'http://tauri.localhost',            // Tauri Windows WebView2
],
```

---

## 8. Build Desktop Exam Browser (Windows / macOS via Tauri v2)

Aplikasi CBT Al Akhyar kini mendukung versi **Desktop Exam Browser** menggunakan **Tauri v2** yang sangat ringan (~5-10 MB) dan dirancang untuk mengunci layar PC/laptop lab sekolah (Kiosk Mode).

### Fitur Penguncian Exam Browser:
* **Kiosk Layar Penuh (`fullscreen: true`, `decorations: false`):** Menghilangkan bilah menu OS, tombol Minimize, Maximize, dan Close.
* **Always on Top:** Jendela ujian selalu berada di lapisan paling depan.
* **Pencegahan Keluar Sembarangan:** Menutup jendela via pintasan sistem (seperti `Alt + F4`) otomatis dicegah pada mode release.
* **Keluar Aman Proktor:** Tombol *"Tutup Aplikasi"* hanya tersedia di modal konfirmasi keluar dengan izin proktor.

### Cara Menjalankan di Lokal (Development):
```bash
# Jalankan mode desktop development
npm run desktop:dev
```

### Cara Membangun Installer Windows (.msi & .exe):
Jalankan perintah berikut di mesin Windows (atau via GitHub Actions):
```bash
# Build paket instalasi desktop
npm run desktop:build
```
Hasil installer akan berada di: `apps/ujian/src-tauri/target/release/bundle/nsis/` (installer .exe) dan `bundle/msi/` (installer .msi).


