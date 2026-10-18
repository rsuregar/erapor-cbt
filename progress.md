# Progress Log

## Session: 2026-10-18 (lanjutan)
- Tag `release-macos-0.1.1` di-push → run macOS memicu.
- Membuat task_plan/findings/progress (file ini tidak di-commit).
- Planning risiko Android/iOS didelegasikan ke subagent Opus (agent://PlanAndroidIos); hasil di findings.md.
- Dispatch Android (39103950599), iOS (39103952408); macOS tag run 39103929164.
- Hasil: macOS success + release-macos-0.1.1 terbit (.dmg 9,5 MB). Android success (APK DEBUG, keystore skipped). iOS FAILED di "Install dependencies": npm ERESOLVE (@capacitor/ios tanpa versi → 8.x vs core 7.6.9). Prediksi Opus #1 terbukti; #2 terbukti sebagian.
- Fix: build-ios.yml kunci @capacitor/ios@7.6.9 (commit + push). Dispatch ulang iOS run 39104297320 → success.
- Android: workflow diperketat (tag release-* gagal tanpa keystore; nama/lokasi APK dari jenis build nyata; secret lewat env). Run 39104477817 (tanpa secret) → debug + warning, berkas -debug.apk.
- Keystore dibuat di ~/Documents/erapor-cbt-keystore (alias alakhyar-cbt, SHA256 99:2F:27:...:82:B5), 4 secret dipasang.
- Run 39104586693 → assembleRelease, APK b3 bertanda tangan CN=CBT Al Akhyar (SHA256 cocok).
