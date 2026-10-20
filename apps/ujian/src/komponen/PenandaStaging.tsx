import { hostApi, STAGING } from '@/lib/lingkungan'
import { cn } from '@/lib/utils'
import { FlaskConical } from 'lucide-react'

/**
 * Garis bermotif di tepi atas setiap layar build staging — terlihat di semua
 * halaman (termasuk layar ujian) tanpa menutupi isi. Judul tab/jendela sudah
 * ber-whitelabel dari index.html (vite.config.ts, plugin html-lingkungan).
 */
export function GarisStaging() {
    if (!STAGING) return null

    return (
        <div
            aria-hidden
            title={`Build STAGING · API ${hostApi()}`}
            className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 bg-[repeating-linear-gradient(135deg,#F5A623_0_10px,#1E2A32_10px_20px)]"
        />
    )
}

/** Lencana kecil di samping label versi. */
export function LencanaStaging({ className }: { className?: string }) {
    if (!STAGING) return null

    return (
        <span className={cn('inline-flex items-center rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink', className)}>
            Staging
        </span>
    )
}

/** Pemberitahuan di halaman Masuk: server uji, bukan ujian resmi. */
export function KartuStaging() {
    if (!STAGING) return null

    return (
        <div role="note" className="flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
            <FlaskConical className="mt-0.5 size-4 shrink-0" />
            <p>
                <b>Versi STAGING</b> — terhubung ke server uji <span className="font-mono text-xs">{hostApi()}</span>. Data dan nilai di sini
                bukan ujian resmi.
            </p>
        </div>
    )
}
