import { cn } from '@/lib/utils'
import { useState } from 'react'

function inisial(nama: string): string {
    return nama
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((bagian) => bagian[0])
        .join('')
        .toUpperCase()
}

/** Pasfoto resmi dari API; inisial adalah cadangan bila belum tersedia/gagal dimuat. */
export function FotoMurid({ nama, foto, ukuran = 'md', className }: { nama: string; foto: string | null | undefined; ukuran?: 'sm' | 'md' | 'lg'; className?: string }) {
    const [gagal, setGagal] = useState(false)
    const ukuranKelas = { sm: 'size-9 text-xs', md: 'size-11 text-sm', lg: 'size-14 text-title' }[ukuran]

    if (foto && !gagal) {
        return <img src={foto} alt={`Foto ${nama}`} className={cn('shrink-0 rounded-full object-cover ring-2 ring-white/80', ukuranKelas, className)} onError={() => setGagal(true)} />
    }

    return (
        <span aria-label={`Inisial ${nama}`} className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-primary ring-2 ring-white/80', ukuranKelas, className)}>
            {inisial(nama) || 'M'}
        </span>
    )
}
