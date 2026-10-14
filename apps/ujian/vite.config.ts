import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// PWA = jalur cadangan (laptop, PC lab, HP tanpa app). App Capacitor memuat
// hasil build yang sama dari dist/.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')

    return {
        resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
        plugins: [
            react(),
            VitePWA({
                registerType: 'prompt',
                includeAssets: ['ikon.svg'],
                manifest: {
                    name: 'Ujian Al Akhyar',
                    short_name: 'Ujian',
                    description: 'Aplikasi ujian CBT murid Al Akhyar',
                    lang: 'id',
                    display: 'fullscreen',
                    orientation: 'any',
                    theme_color: '#0f172a',
                    background_color: '#ffffff',
                    icons: [{ src: 'ikon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
                },
                workbox: {
                    // Aset app di-cache agar bisa dibuka tanpa internet. API tidak
                    // di-cache Workbox: data ujian dikelola exam-core (IndexedDB).
                    globPatterns: ['**/*.{js,css,html,svg,woff2}'],
                    navigateFallback: 'index.html',
                    navigateFallbackDenylist: [/^\/api\//],
                },
            }),
        ],
        server: {
            port: 5180,
            // Dev: /api diteruskan ke e-Rapor lokal, jadi tidak perlu CORS.
            // Build (PWA/Capacitor) memakai VITE_API_URL absolut.
            proxy: {
                '/api': { target: env.ERAPOR_DEV_URL || 'https://www.erapor.test', changeOrigin: true, secure: false },
            },
        },
    }
})
