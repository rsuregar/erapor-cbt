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
| **Build Android APK** | [`.github/workflows/build-android.yml`](../.github/workflows/build-android.yml) | • Tag `android-*` atau `v*`<br>• Manual (`workflow_dispatch`) | Menghasilkan installer **Android APK** (Release/Debug) siap pasang. |
| **Build iOS App** | [`.github/workflows/build-ios.yml`](../.github/workflows/build-ios.yml) | • Tag `ios-*` atau `v*`<br>• Manual (`workflow_dispatch`) | Menghasilkan arsip **iOS App (.xcarchive.zip)** untuk iPhone/iPad. |
| **Build Windows Desktop** | [`.github/workflows/build-desktop-windows.yml`](../.github/workflows/build-desktop-windows.yml) | • Tag `windows-*`, `desktop-*`, `v*`<br>• Manual (`workflow_dispatch`) | Menghasilkan installer **Windows (.exe NSIS & .msi)** mode Exam Browser Kiosk. |
| **Build macOS Desktop** | [`.github/workflows/build-desktop-macos.yml`](../.github/workflows/build-desktop-macos.yml) | • Tag `macos-*`, `desktop-*`, `v*`<br>• Manual (`workflow_dispatch`) | Menghasilkan installer **macOS (.dmg)** mode Exam Browser Kiosk. |
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

## 3. Menjalankan Build Manual via GitHub Actions

Anda tidak harus selalu push commit untuk membangun APK atau deploy PWA. Bisa dijalankan manual lewat browser:

1. Buka tab **Actions** di repositori GitHub.
2. Pilih workflow **"Build Mobile Apps (APK & iOS)"** atau **"Deploy PWA"** di bilah kiri.
3. Klik tombol **Run workflow**.
4. Pilih parameter:
   * **Target Platform**: `all`, `android`, atau `ios`.
   * **Target Environment**: `staging` atau `production`.
   * **Build Type**: `release` atau `debug`.
5. Klik **Run workflow**. Setelah selesai (sekitar 3–5 menit), buka hasil run dan unduh file APK/iOS di bagian **Artifacts**.

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

### A. Cara Deploy ke Cloudflare (Workers / Pages)

1. Masuk ke dashboard [Cloudflare](https://dash.cloudflare.com/) → **Compute (Workers & Pages)** → **Create application** → **Connect to Git**.
2. Pilih repositori `erapor-cbt` dan branch `main`.
3. Masukkan konfigurasi build:
   * **Framework preset**: `None` atau `Vite`
   * **Build command**: `npm run build`
   * **Build output directory**: `apps/ujian/dist`
   * **Root directory**: *(Biarkan kosong / root repositori)*
4. Tambahkan **Environment Variables**:
   * `VITE_API_URL`: URL API Laravel backend (misal `https://erapor.alakhyar.sch.id/api`)
5. Klik **Save and Deploy**.

*(Catatan: Konfigurasi SPA routing sudah otomatis ditangani oleh `wrangler.json` dengan `"not_found_handling": "single-page-application"`).*

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


