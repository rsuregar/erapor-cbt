# Findings

Sumber: rencana dari subagent Opus (agent://PlanAndroidIos) + pemeriksaan saya.

## Android
- `apps/ujian/android/` di-commit (gradlew, build.gradle, variables.gradle); `-PversionCode/-PversionName` cocok dengan build.gradle:10-11.
- Secret keystore (`ANDROID_KEYSTORE_BASE64`, `_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`): TIDAK ADA di repo maupun environment production/staging (diperiksa `gh secret list`). Hanya `RELEASE_TOKEN`.
  → build jatuh ke `assembleDebug`.
- Nama APK memakai `inputs.build_type || 'release'`, jadi pada run tag berkas debug tetap bernama `-release.apk` (menyesatkan) dan ditandatangani debug keystore acak per runner → pembaruan lewat app tidak bisa menimpa versi lama.
- Dugaan [INFERENCE]: `env:` level step dipakai di `if:` step yang sama; secara dokumen env step tidak tersedia pada `if` step itu sendiri. Perlu dicek di log (step "Prepare Keystore" skipped?).

## iOS
- `apps/ujian/ios/` tidak ada di repo; CI menjalankan `cap add ios`.
- build-ios.yml:48 `npm install @capacitor/ios --save-exact` tanpa versi → latest 8.5.3 (peer core ^8.5), proyek di 7.6.9. Risiko gagal ERESOLVE (pemblokir utama).
- Arsip tanpa tanda tangan; bukan IPA yang bisa dipasang.
- Tag tanpa akhiran aman; akhiran → MARKETING_VERSION tidak valid + pra-rilis.
- `release-mobile-*`: dua workflow berbagi rilis; publish-release.mjs sudah tahan balapan.
