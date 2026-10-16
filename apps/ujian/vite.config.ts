import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// PWA = jalur cadangan (laptop, PC lab, HP tanpa app). App Capacitor memuat
// hasil build yang sama dari dist/.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const proxy = {
        "/api": {
            target: env.ERAPOR_DEV_URL || "https://www.erapor.test",
            changeOrigin: true,
            secure: false,
        },
    };
    const versi = JSON.parse(
        readFileSync(new URL("./package.json", import.meta.url), "utf8"),
    ).version as string;

    return {
        // Dilaporkan ke server saat /mulai (perangkat.versi_app).
        define: { __VERSI_APP__: JSON.stringify(versi) },
        resolve: {
            alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
        },
        plugins: [
            react(),
            VitePWA({
                registerType: "prompt",
                includeAssets: ["brand/*.png"],
                manifest: {
                    name: "CBT Al Akhyar",
                    short_name: "CBT Al Akhyar",
                    description: "Aplikasi ujian CBT murid Al Akhyar",
                    lang: "id",
                    display: "fullscreen",
                    orientation: "any",
                    theme_color: "#006195",
                    background_color: "#F5F8FA",
                    icons: [
                        {
                            src: "brand/ikon-192.png",
                            sizes: "192x192",
                            type: "image/png",
                        },
                        {
                            src: "brand/ikon-512.png",
                            sizes: "512x512",
                            type: "image/png",
                            purpose: "any",
                        },
                    ],
                },
                workbox: {
                    // Aset app di-cache agar bisa dibuka tanpa internet. API tidak
                    // di-cache Workbox: data ujian dikelola exam-core (IndexedDB).
                    globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
                    navigateFallback: "index.html",
                    navigateFallbackDenylist: [/^\/api\//],
                    // Media soal sudah diunduh ke cache ini saat pra-unduh (lib/ujian.ts unduhMedia).
                    runtimeCaching: [
                        {
                            urlPattern: ({ url }) =>
                                url.pathname.startsWith("/storage/"),
                            handler: "CacheFirst",
                            options: {
                                cacheName: "cbt-media",
                                cacheableResponse: { statuses: [0, 200] },
                            },
                        },
                    ],
                },
            }),
        ],
        server: {
            port: 5180,
            // Dev: /api diteruskan ke e-Rapor lokal, jadi tidak perlu CORS.
            // Build (PWA/Capacitor) memakai VITE_API_URL absolut.
            proxy,
        },
        // `npm run pratinjau`: build + service worker — satu-satunya cara menguji offline
        // (dev server tidak memasang service worker; memuat ulang saat offline = halaman offline browser).
        preview: { port: 5181, proxy },
    };
});
