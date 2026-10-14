import { cn } from '@/lib/utils'
import { useRef } from 'react'

/**
 * Token ujian 6 karakter, satu kotak per huruf — besar dan mudah dibaca
 * dari papan tulis. Huruf otomatis kapital; tempel sekaligus didukung.
 */
export function KotakToken({ nilai, onUbah, galat, nonaktif }: { nilai: string; onUbah: (v: string) => void; galat?: boolean; nonaktif?: boolean }) {
    const kotak = useRef<(HTMLInputElement | null)[]>([])
    const huruf = nilai.padEnd(6, ' ').slice(0, 6).split('')
    const rapikan = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')

    const isi = (mulai: number, teks: string) => {
        const bersih = rapikan(teks)
        if (!bersih) return
        const baru = (nilai.slice(0, mulai) + bersih).slice(0, 6)
        onUbah(baru)
        kotak.current[Math.min(baru.length, 5)]?.focus()
    }

    return (
        <div className="mx-auto flex max-w-sm justify-center gap-1.5 sm:gap-2" onPaste={(e) => (e.preventDefault(), isi(0, e.clipboardData.getData('text')))}>
            {huruf.map((h, i) => (
                <input
                    key={i}
                    ref={(el) => {
                        kotak.current[i] = el
                    }}
                    value={h.trim()}
                    disabled={nonaktif}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    maxLength={1}
                    aria-label={`Huruf token ${i + 1}`}
                    onChange={(e) => isi(i, e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Backspace') {
                            e.preventDefault()
                            const sampai = h.trim() ? i : i - 1
                            if (sampai >= 0) {
                                onUbah(nilai.slice(0, sampai))
                                kotak.current[sampai]?.focus()
                            }
                        }
                    }}
                    className={cn(
                        'aspect-square w-0 min-w-0 max-w-14 flex-1 rounded-md border-2 bg-white text-center font-display text-h3 font-semibold uppercase text-ink outline-none transition focus:border-primary focus:shadow-ring',
                        galat ? 'border-coral-500' : 'border-slate-200',
                        nonaktif && 'opacity-50',
                    )}
                />
            ))}
        </div>
    )
}
