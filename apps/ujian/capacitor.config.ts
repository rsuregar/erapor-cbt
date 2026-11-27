import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "sch.alakhyar.ujian",
    appName: "CBT Al Akhyar",
    webDir: "dist",
    android: {
        // Layar ujian tidak boleh direkam/ditangkap (FLAG_SECURE dipasang di
        // MainActivity saat proyek android ditambahkan).
        allowMixedContent: false,
        // Android 15 (targetSdk 35) memaksa edge-to-edge: geser WebView agar header/footer tidak tertutup sistem bar.
        adjustMarginsForEdgeToEdge: "auto",
    },
};

export default config;
