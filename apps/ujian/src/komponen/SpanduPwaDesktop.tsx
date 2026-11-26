import { UNDUHAN_TERBARU } from '@/lib/dataUnduhan'
import { cariUnduhan } from '@/lib/pembaruan'
import { apakahPwaDesktopTerpasang } from '@/lib/pwaDesktop'
import { useOnline } from '@/lib/useOnline'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Download, ExternalLink } from 'lucide-react'

const REPO_RILIS = (import.meta.env.VITE_UPDATE_REPO as string | undefined) || 'rsuregar/erapor-cbt-releases'
const HALAMAN_RILIS = `https://github.com/${REPO_RILIS}/releases`

function osDesktop(): 'windows' | 'macos' | null {
    if (typeof navigator === 'undefined') return null
    const ua = navigator.userAgent
    if (/Windows/i.test(ua)) return 'windows'
    if (/Macintosh|Mac OS X/i.test(ua)) return 'macos'
    return null
}

/**
 * Peringatan bagi murid di laptop/PC yang membuka versi PWA standalone (terlanjur terpasang
 * atau via menu "Install page as app" di Chrome), agar tidak salah mengira sebagai Exam Browser.
 */
export function SpanduPwaDesktop() {
    const terpasang = apakahPwaDesktopTerpasang()
    const online = useOnline()
    const os = osDesktop()
    const { data } = useQuery({
        queryKey: ['unduhan-app'],
        queryFn: cariUnduhan,
        initialData: UNDUHAN_TERBARU,
        enabled: terpasang && online,
        staleTime: 60 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
    })

    if (!terpasang) return null

    const berkas = os ? data?.[os] : undefined
    const href = berkas?.unduh ?? HALAMAN_RILIS
    const labelUnduh =
        os === 'windows'
            ? 'Unduh Exam Browser Windows (.msi)'
            : os === 'macos'
              ? 'Unduh Exam Browser macOS (.dmg)'
              : 'Unduh Exam Browser'

    return (
        <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-950 shadow-xs"
        >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1 space-y-2">
                <p className="font-bold">Ini versi browser (PWA), bukan Exam Browser Desktop</p>
                <p className="text-xs leading-relaxed text-amber-900">
                    Untuk ujian di laptop/PC, gunakan aplikasi resmi CBT Al Akhyar (Exam Browser) agar layar terkunci otomatis dan menghindari kendala browser.
                </p>
                <a
                    href={href}
                    {...(berkas ? { download: '' } : { target: '_blank', rel: 'noopener noreferrer' })}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-800 active:scale-[0.98]"
                >
                    {berkas ? <Download className="size-3.5" /> : <ExternalLink className="size-3.5" />}
                    <span>{labelUnduh}</span>
                </a>
            </div>
        </div>
    )
}
