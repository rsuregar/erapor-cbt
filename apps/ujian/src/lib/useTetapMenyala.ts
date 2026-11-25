import { aturTetapMenyalaNative } from '@/lib/native'
import { useEffect } from 'react'

type WakeLockSentinelLike = {
    release: () => Promise<void>
    addEventListener?: (type: 'release', listener: () => void) => void
}
type NavigatorWakeLock = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }

/**
 * Menjaga layar dan proses tetap menyala selama ujian (mengerjakan / menunggu_sinkron)
 * agar layar tidak tidur sendiri dan memicu pelanggaran latar belakang palsu.
 */
export function useTetapMenyala(aktif: boolean): void {
    useEffect(() => {
        if (!aktif) return
        let batal = false
        let sentinel: WakeLockSentinelLike | null = null

        void aturTetapMenyalaNative(true)

        const mintaWakeLock = async () => {
            if (batal || document.visibilityState !== 'visible') return
            const wl = (navigator as NavigatorWakeLock).wakeLock
            if (!wl?.request || sentinel) return
            try {
                const s = await wl.request('screen')
                if (batal) {
                    void s.release().catch(() => undefined)
                    return
                }
                s.addEventListener?.('release', () => {
                    if (sentinel === s) sentinel = null
                })
                sentinel = s
            } catch {
                // Sebagian webview/browser menolak wakeLock tanpa interaksi pengguna; native flag tetap aktif.
            }
        }

        const saatTerlihat = () => {
            if (document.visibilityState === 'visible') {
                sentinel = null
                void mintaWakeLock()
            }
        }

        const saatInteraksi = () => {
            if (!sentinel) void mintaWakeLock()
        }

        void mintaWakeLock()
        document.addEventListener('visibilitychange', saatTerlihat)
        window.addEventListener('pointerdown', saatInteraksi, { passive: true })
        window.addEventListener('keydown', saatInteraksi, { passive: true })

        return () => {
            batal = true
            document.removeEventListener('visibilitychange', saatTerlihat)
            window.removeEventListener('pointerdown', saatInteraksi)
            window.removeEventListener('keydown', saatInteraksi)
            void sentinel?.release().catch(() => undefined)
            sentinel = null
            void aturTetapMenyalaNative(false)
        }
    }, [aktif])
}
