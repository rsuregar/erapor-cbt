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

Android/iOS (butuh Android Studio / Xcode):

```bash
cd apps/ujian
npx cap add android
npx cap add ios
npm run cap:sync
npx cap open android
```

Saat dev, Vite meneruskan `/api` ke e-Rapor lokal (`ERAPOR_DEV_URL`, bawaan
`https://www.erapor.test`), jadi tidak perlu `.env` dan tidak terhalang CORS.
Build PWA/Capacitor wajib mengisi `VITE_API_URL` absolut
(lihat `apps/ujian/.env.example`).

## Yang harus disiapkan di e-Rapor

- CORS (`config/cors.php`) harus mengizinkan origin app: `capacitor://localhost`
  (iOS), `https://localhost` (Android), domain PWA, dan
  `http://localhost:5180` untuk pengembangan.

## Status

- [x] Kerangka monorepo, exam-core (API, dekripsi, outbox, jam, sinkron), uji.
- [x] Masuk, daftar ujian (hari ini / mendatang / riwayat), hasil.
- [ ] Persiapan: pra-unduh paket + media, token, mulai.
- [ ] Layar mengerjakan bergaya Bluebook, ragu-ragu, navigasi soal, timer.
- [ ] Deteksi & antrean pelanggaran, layar terkunci, pesan pengawas.
- [ ] Adapter SQLite (Capacitor), plugin kunci layar Android/iOS.
- [ ] Panduan pasang PWA + kunci OS per perangkat (PRD M-14).
