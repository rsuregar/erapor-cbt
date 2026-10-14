import { standalone } from '@/lib/perangkat'
import { useEffect, useState } from 'react'

/**
 * Tombol "Pasang sekarang" (Chrome/Edge Android & laptop). Event
 * beforeinstallprompt hanya muncul sekali saat halaman dimuat, jadi ditangkap
 * sejak modul ini diimpor di main.tsx. Safari (iOS) tidak punya event ini —
 * murid mengikuti panduan Bagikan → Tambahkan ke Layar Utama.
 */

type PromptPasang = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let tertunda: PromptPasang | null = null
const pendengar = new Set<() => void>()
const kabari = () => pendengar.forEach((f) => f())

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        tertunda = e as PromptPasang
        kabari()
    })
    window.addEventListener('appinstalled', () => {
        tertunda = null
        kabari()
    })
}

export function usePasang() {
    const [, segarkan] = useState(0)
    useEffect(() => {
        const f = () => segarkan((n) => n + 1)
        pendengar.add(f)

        return () => void pendengar.delete(f)
    }, [])

    return {
        terpasang: standalone(),
        bisaPasang: !!tertunda,
        async pasang(): Promise<boolean> {
            if (!tertunda) return false
            await tertunda.prompt()
            const { outcome } = await tertunda.userChoice
            tertunda = null
            kabari()

            return outcome === 'accepted'
        },
    }
}
