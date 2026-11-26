import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import 'katex/dist/katex.min.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Tangkap beforeinstallprompt sedini mungkin (hanya muncul sekali per muat).
import './lib/pasang'
// Kunci zoom manual (cubit / ketuk dua kali) di PWA & HP.
import './lib/kunciZoom'
import { router } from './router'
import { alihkanKeHalamanNonaktif, webDitolak } from './lib/aksesWeb'
import { bersihkanServiceWorkerNative } from './lib/pembaruanPwa'
import { queryClient } from './lib/queryClient'

if (webDitolak()) {
    // Mode web_ios_only: laptop & Android wajib aplikasi resmi.
    void alihkanKeHalamanNonaktif()
} else {
    void bersihkanServiceWorkerNative().then((perluMuatUlang) => {
        if (!perluMuatUlang) return
        try {
            if (sessionStorage.getItem('cbt:sw-native-bersih') === '1') return
            sessionStorage.setItem('cbt:sw-native-bersih', '1')
        } catch {
            // Abaikan bila sessionStorage dibatasi
        }
        location.reload()
    })

    createRoot(document.getElementById('app')!).render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </StrictMode>,
    )
}
