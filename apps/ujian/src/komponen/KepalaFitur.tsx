import { cn } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

const NADA = { brand: 'bg-primary', sky: 'bg-sky-500', red: 'bg-coral-500', magenta: 'bg-magenta-500' } as const

/**
 * Kepala layar fitur (DS: AppHeader) — berwarna, sudut bawah membulat,
 * tombol kembali + judul di kiri, logo di kanan.
 */
export function KepalaFitur({
    judul,
    subjudul,
    nada = 'brand',
    onKembali,
    kanan,
    children,
    className,
}: {
    judul: ReactNode
    subjudul?: ReactNode
    nada?: keyof typeof NADA
    onKembali?: () => void
    kanan?: ReactNode
    children?: ReactNode
    className?: string
}) {
    return (
        <header className={cn('rounded-b-xl px-[18px] pb-5 pt-4 text-white', NADA[nada], className)}>
            <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    {onKembali && (
                        <button onClick={onKembali} aria-label="Kembali" className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm bg-white/15 transition active:scale-95">
                            <ChevronLeft className="size-5" />
                        </button>
                    )}
                    <div className="min-w-0">
                        <div className="truncate text-title font-bold leading-tight">{judul}</div>
                        {subjudul && <div className="mt-0.5 text-xs opacity-85">{subjudul}</div>}
                    </div>
                </div>
                {kanan && <div className="shrink-0">{kanan}</div>}
            </div>
            {children && <div className="mx-auto mt-4 max-w-3xl">{children}</div>}
        </header>
    )
}
