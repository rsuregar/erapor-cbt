import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

/**
 * Token ujian 6 karakter, satu kotak per huruf — besar dan mudah dibaca
 * dari papan tulis. Satu input asli tak terlihat di atas kotak-kotak, supaya
 * ketik cepat, tempel, isi-otomatis keyboard, dan hapus selalu konsisten.
 */
export function KotakToken({
    nilai,
    onUbah,
    galat,
    nonaktif,
    fokusOtomatis,
}: {
    nilai: string
    onUbah: (v: string) => void
    galat?: boolean
    nonaktif?: boolean
    /** Fokuskan begitu semua syarat lain beres — hanya di laptop; di HP keyboard yang muncul sendiri justru menutupi layar. */
    fokusOtomatis?: boolean
}) {
    const [fokus, setFokus] = useState(false)
    const ref = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (fokusOtomatis && !nonaktif && matchMedia('(pointer: fine)').matches) ref.current?.focus({ preventScroll: true })
    }, [fokusOtomatis, nonaktif])
    const huruf = nilai.padEnd(6, ' ').slice(0, 6).split('')
    const aktif = Math.min(nilai.length, 5)

    return (
        <div className="relative mx-auto flex max-w-sm justify-center gap-1.5 sm:gap-2">
            {huruf.map((h, i) => (
                <div
                    key={i}
                    aria-hidden
                    className={cn(
                        'flex aspect-square w-0 min-w-0 max-w-14 flex-1 items-center justify-center rounded-md border-2 bg-white font-display text-h3 font-semibold text-ink transition',
                        galat ? 'border-coral-500' : 'border-slate-200',
                        fokus && i === aktif && !galat && 'border-primary shadow-ring',
                        nonaktif && 'opacity-50',
                    )}
                >
                    {h.trim() || (fokus && i === aktif ? <span className="h-6 w-0.5 animate-pulse rounded-full bg-primary" /> : null)}
                </div>
            ))}
            <input
                ref={ref}
                value={nilai}
                disabled={nonaktif}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="one-time-code"
                autoCorrect="off"
                spellCheck={false}
                maxLength={6}
                aria-label="Token ujian (6 karakter)"
                onFocus={(e) => {
                    setFokus(true)
                    const el = e.currentTarget
                    requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length))
                    // HP: tunggu keyboard naik, lalu bawa kotak ke tengah — jangan tertutup tombol Mulai yang menempel di bawah.
                    if (matchMedia('(pointer: coarse)').matches) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
                }}
                onBlur={() => setFokus(false)}
                onChange={(e) => onUbah(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                className="absolute inset-0 h-full w-full cursor-text appearance-none border-0 bg-transparent p-0 text-[16px] text-transparent caret-transparent outline-none selection:bg-transparent"
            />
        </div>
    )
}
