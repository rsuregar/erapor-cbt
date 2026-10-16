# erapor-cbt — aplikasi ujian murid

App ujian CBT untuk murid Al Akhyar. Panel guru/admin/pengawas ada di
e-Rapor (`feat-cbt`); app ini hanya memanggil API murid e-Rapor
(`/api/cbt`, kontrak: `erapor/docs/cbt/kontrak-api-murid.md`).

Satu kode, tiga keluaran (PRD "Arsitektur & Tech Stack"):

| Keluaran | Untuk | Penyimpanan offline |
| --- | --- | --- |
| App Android (Capacitor) | HP/tablet murid — jalur utama | SQLite native |
| App iOS (Capacitor) | iPhone/iPad | SQLite native |
| PWA | Laptop, PC lab, cadangan bila app gagal dipasang | IndexedDB |

## Stack

- **React 18 + TypeScript**, Vite 7, Tailwind 3.
- **TanStack Router** untuk halaman (masuk, daftar ujian, persiapan,
  mengerjakan, hasil), dan **TanStack Query** untuk data server biasa
  (daftar ujian, hasil, login).
- Data **saat mengerjakan** (jawaban, outbox, timer, sinkron) tidak memakai
  Query. Datanya dikelola `packages/exam-core` dan ditulis ke penyimpanan
  lokal dulu.
- **vite-plugin-pwa** (Workbox) supaya aset app tersedia tanpa internet.
- **Capacitor 7** untuk Android/iOS. Kunci layar ujian (Android Lock Task +
  FLAG_SECURE, iOS Automatic Assessment Configuration) lewat plugin native
  menyusul.

## Desain

Mengikuti **Al Akhyar Design System** (design system bawaan organisasi):
https://claude.ai/artifact/1NGNPjebehvf5PQAcYC41Q

- Token warna, tipografi, radius, bayangan, dan motion disalin ke
  `apps/ujian/tailwind.config.js`. Ubah di design system dulu, baru di sini.
- Font Plus Jakarta Sans **dibundel** lewat `@fontsource-variable`, bukan dari
  Google Fonts CDN, supaya tetap tampil saat offline.
- Komponen di `apps/ujian/src/komponen/` mengikuti komponen design system:
  `Tombol` (Button), `Masukan` (Input), `Lencana` (Badge), `Kartu` (Card),
  `KepalaFitur` (AppHeader), ditambah `KotakToken`.
- Logo dari repo e-Rapor (`logogram`) dan design system (`lockup`), di
  `apps/ujian/public/brand/`.
- Mode demo untuk meninjau desain tanpa server: saat `npm run dev`, masuk
  dengan username `demo` (sandi bebas). Tidak ikut build produksi.

## Struktur

```
apps/ujian/                  app React (PWA + Capacitor)
packages/exam-core/          TypeScript murni tanpa DOM: klien API, dekripsi
                             paket AES-256-GCM, outbox jawaban (seq),
                             jam server, penyinkron 15 detik
packages/question-renderer/  tampilan soal, salinan dari e-Rapor
```

`question-renderer` bersumber dari
`erapor/resources/js/Cbt/question-renderer`, supaya pratinjau guru sama
persis dengan layar murid. Jangan diubah di sini. Ubah di e-Rapor, lalu:

```bash
ERAPOR_DIR=../erapor npm run sinkron:renderer
```

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5180 — /api diteruskan ke https://www.erapor.test
npm test           # uji exam-core
npm run typecheck
npm run build      # apps/ujian/dist (PWA)
```

Uji offline butuh service worker, yang tidak dipasang oleh `npm run dev`:
`npm run pratinjau` (port 5181) atau `npm run pratinjau:demo` (dengan data
demo) di `apps/ujian`.

### Android & iOS (Lokal)

Butuh JDK 21 (`brew install openjdk@21`) dan Android SDK
(`~/Library/Android/sdk`, dicatat di `android/local.properties`). Proyek
`apps/ujian/android` ada di repo; plugin native lokal di
`android/app/src/main/java/sch/alakhyar/ujian/` (FLAG_SECURE, sematkan layar,
lokasi dengan deteksi lokasi palsu).

```bash
cd apps/ujian
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm run android:apk        # build produksi (isi VITE_API_URL) → android/app/build/outputs/apk/debug/app-debug.apk
npm run android:apk:demo   # dengan data demo (masuk: demo / sandi bebas), tanpa server
```

Pasang ke emulator / BlueStacks: nyalakan **Setelan → Lanjutan → Android Debug Bridge**,
lalu (port sesuai yang ditampilkan BlueStacks):

```bash
~/Library/Android/sdk/platform-tools/adb connect 127.0.0.1:5555
~/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Untuk platform iOS (Xcode):
```bash
cd apps/ujian
npx cap add ios     # jika belum diinisialisasi
npx cap sync ios
npx cap open ios
```

Panduan lengkap build manual Android & iOS serta konfigurasi signing release dapat dibaca di:
👉 **[Panduan Build Mobile dan CI/CD](docs/panduan-build-dan-cicd.md)**.

## CI/CD (GitHub Actions)

Repositori ini telah disiapkan dengan 3 alur otomatis GitHub Actions:
- **CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))**: Menjalankan lint, typecheck, unit test, dan build uji coba pada setiap PR dan push ke branch `main`.
- **Deploy PWA ([`.github/workflows/deploy-pwa.yml`](.github/workflows/deploy-pwa.yml))**: Deploy otomatis berkas PWA ke web server staging/produksi via SSH.
- **Build Mobile APK & iOS ([`.github/workflows/build-mobile.yml`](.github/workflows/build-mobile.yml))**: Kompilasi installer Android APK dan iOS Archive (.xcarchive) otomatis saat rilis tag (misal `v1.0.0` atau `release-prod*`) atau dijalankan manual dari tab **Actions** di GitHub.

Detail variabel secret dan cara trigger workflow dapat dibaca di **[`docs/panduan-build-dan-cicd.md`](docs/panduan-build-dan-cicd.md)**.

## Yang harus disiapkan di e-Rapor

- CORS (`config/cors.php`) harus mengizinkan origin app: `capacitor://localhost`
  (iOS), `https://localhost` (Android), domain PWA, dan
  `http://localhost:5180` untuk pengembangan.

## Status

Status per story ada di [`docs/progres.md`](docs/progres.md) (salinan dari
Backlog MVP e-Rapor).

