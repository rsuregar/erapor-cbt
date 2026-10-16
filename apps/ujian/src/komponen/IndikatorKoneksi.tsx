import { useOnline } from '@/lib/useOnline'
import { cn } from '@/lib/utils'
import { Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

export interface IndikatorKoneksiProps {
    /** Nilai override status online. Bila tidak diisi, memakai hook useOnline(). */
    online?: boolean
    /** Tema kontras: 'terang' untuk latar putih/abu, 'gelap' untuk latar header warna primer. */
    tema?: 'terang' | 'gelap'
    /** Tampilkan label teks 'Online'/'Offline' (default: true). */
    tampilkanTeks?: boolean
    className?: string
}

/**
 * Lencana indikator koneksi online/offline yang responsif.
 */
export function IndikatorKoneksi({
    online: onlineProp,
    tema = 'terang',
    tampilkanTeks = true,
    className,
}: IndikatorKoneksiProps) {
    const onlineHook = useOnline()
    const online = onlineProp ?? onlineHook

    const gaya = tema === 'gelap'
        ? online
            ? 'bg-white/15 text-white border-white/20'
            : 'bg-amber-500/30 text-amber-100 border-amber-400/40'
        : online
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                gaya,
                className
            )}
            title={online ? 'Terhubung ke internet' : 'Tidak terhubung ke internet'}
            role="status"
        >
            <span
                className={cn(
                    'size-2 rounded-full shrink-0',
                    online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                )}
            />
            {online ? (
                <Wifi className="size-3.5 shrink-0 opacity-80" />
            ) : (
                <WifiOff className="size-3.5 shrink-0 opacity-90" />
            )}
            {tampilkanTeks && (
                <span>{online ? 'Online' : 'Offline'}</span>
            )}
        </span>
    )
}

/**
 * Notifikasi mengambang global saat status koneksi berpindah ke offline atau kembali online.
 */
export function NotifikasiKoneksiGlobal() {
    const online = useOnline()
    const [sempatOffline, setSempatOffline] = useState(false)
    const [tampilKembaliOnline, setTampilKembaliOnline] = useState(false)

    useEffect(() => {
        if (!online) {
            setSempatOffline(true)
            setTampilKembaliOnline(false)
        } else if (sempatOffline) {
            // Baru saja kembali online setelah sempat offline
            setTampilKembaliOnline(true)
            const timer = setTimeout(() => {
                setTampilKembaliOnline(false)
                setSempatOffline(false)
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [online, sempatOffline])

    if (!online) {
        return (
            <div
                role="status"
                aria-live="polite"
                className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur border border-white/10 transition-all duration-300 ease-out"
            >
                <span className="size-2 rounded-full bg-amber-400" />
                <WifiOff className="size-3.5 text-amber-400" />
                <span>Mode Offline &mdash; Memeriksa koneksi internet</span>
            </div>
        )
    }

    if (tampilKembaliOnline) {
        return (
            <div
                role="status"
                aria-live="polite"
                className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-emerald-600/95 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur border border-emerald-400/30 transition-all duration-300 ease-out"
            >
                <span className="size-2 rounded-full bg-white animate-ping" />
                <Wifi className="size-3.5 text-white" />
                <span>Kembali Online</span>
            </div>
        )
    }

    return null
}
