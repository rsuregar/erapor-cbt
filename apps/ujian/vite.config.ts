import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// PWA = jalur cadangan (laptop, PC lab, HP tanpa app). App Capacitor memuat
// hasil build yang sama dari dist/.
export default defineConfig({
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
            },
        }),
    ],
    server: { port: 5180 },
})
