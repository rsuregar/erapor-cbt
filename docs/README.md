# Dokumentasi erapor-cbt

Direktori ini berisi dokumentasi teknis, operasional, dan panduan rilis untuk aplikasi murid CBT Al Akhyar:

1. **[Panduan Build & CI/CD](panduan-build-dan-cicd.md)**
   - Alur otomatis GitHub Actions:
     - CI (Lint, Typecheck, Test, Build PWA)
     - Deploy otomatis PWA ke web server (Staging & Production)
     - Build otomatis installer Android APK & iOS Archive (.xcarchive)
   - Konfigurasi GitHub Secrets & Environment Variables
   - Cara menjalankan build manual dari GitHub Actions Web UI
   - Panduan langkah demi langkah build manual di komputer lokal (Android & iOS).

2. **[Progres & Status Implementasi](progres.md)**
   - Status pengerjaan backlog MVP dan story fitur ujian murid.

3. **[Cheatsheet Admin & Pintasan Keluar](cheatsheet-admin.md)**
   - Kombinasi tombol dan gestur rahasia admin untuk keluar aplikasi tanpa login.
   - Prosedur penutupan aplikasi dan pembersihan sesi untuk pengawas ujian.

4. **[Panduan Mode Maintenance & Disabled Web di Cloudflare](panduan-maintenance-dan-cloudflare.md)**
   - 3 Opsi lengkap pengelolaan mode pemeliharaan dan penonaktifan web:
     - Opsi 1: Build & Deploy via Wrangler / GitHub Actions (Paling bersih membersihkan cache PWA).
     - Opsi 2: Instan via Cloudflare Dashboard (WAF Custom Rule dalam 3 detik tanpa build).
     - Opsi 3: Middleware Cloudflare Worker dengan Environment Variable toggle.
   - Prosedur Operasional Standar (SOP) dan checklist admin sebelum & sesudah ujian.

