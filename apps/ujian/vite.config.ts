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
    const pkgVersion = JSON.parse(
        readFileSync(new URL("./package.json", import.meta.url), "utf8"),
    ).version as string;
    const versi = process.env.VITE_APP_VERSION || env.VITE_APP_VERSION || pkgVersion;
    // production | staging — staging = whitelabel (nama, warna, ikon) + penanda di app.
    const lingkungan = (process.env.VITE_LINGKUNGAN || env.VITE_LINGKUNGAN || "production") === "staging" ? "staging" : "production";
    const staging = lingkungan === "staging";
    const brand = staging ? "brand/staging" : "brand";
    const identitas = staging
        ? { nama: "CBT Al Akhyar (Staging)", pendek: "CBT Staging", warna: "#E0532F" }
        : { nama: "CBT Al Akhyar", pendek: "CBT Al Akhyar", warna: "#006195" };

    return {
        // Dilaporkan ke server saat /mulai (perangkat.versi_app).
        define: {
            __VERSI_APP__: JSON.stringify(versi),
            __LINGKUNGAN__: JSON.stringify(lingkungan),
            // Nomor build CI (run number) — pembaruan staging membandingkan versi lalu build.
            __BUILD_APP__: JSON.stringify(Number(process.env.VITE_APP_BUILD || env.VITE_APP_BUILD || 0)),
        },
        resolve: {
            alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
        },
        plugins: [
            react(),
            {
                // index.html ikut whitelabel: judul, warna tema, favicon, apple-touch-icon.
                name: "html-lingkungan",
                transformIndexHtml: (html: string) =>
                    html
                        .replaceAll("%JUDUL_APP%", identitas.nama)
                        .replaceAll("%WARNA_TEMA%", identitas.warna)
                        .replaceAll("%BRAND%", brand),
            },
            VitePWA({
                registerType: "prompt",
                includeAssets: [`${brand}/*.png`, `${brand}/*.svg`, "brand/*.png"],
                manifest: {
                    name: identitas.nama,
                    short_name: identitas.pendek,
                    description: staging
                        ? "Aplikasi ujian CBT Al Akhyar — versi STAGING (server uji)"
                        : "Aplikasi ujian CBT murid Al Akhyar",
                    lang: "id",
                    display: "fullscreen",
                    orientation: "any",
                    theme_color: identitas.warna,
                    background_color: "#F5F8FA",
                    icons: [
                        { src: `${brand}/ikon-192.png`, sizes: "192x192", type: "image/png" },
                        { src: `${brand}/ikon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
                        // Android/Chrome memotong ikon ke bentuk sendiri: varian penuh dengan zona aman.
                        { src: `${brand}/ikon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
                    ],
                },
                workbox: {
                    // Aset app di-cache agar bisa dibuka tanpa internet. API tidak
                    // di-cache Workbox: data ujian dikelola exam-core (IndexedDB).
                    globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
                    navigateFallback: "index.html",
                    // web-nonaktif.html: halaman blokir mode web_ios_only, dibuat setelah build.
                    navigateFallbackDenylist: [/^\/api\//, /^\/web-nonaktif/],
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
