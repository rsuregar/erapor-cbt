import { cn } from '@/lib/utils'
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
    label?: string
    petunjuk?: string
    galat?: string | null
    ikonKiri?: ReactNode
    akhiran?: ReactNode
}

/** Kolom isian (DS: Input) — label, petunjuk/galat, cincin fokus biru. */
export const Masukan = forwardRef<HTMLInputElement, Props>(function Masukan({ label, petunjuk, galat, ikonKiri, akhiran, className, id, ...rest }, ref) {
    const otomatis = useId()
    const idKolom = id ?? otomatis

    return (
        <div className="block">
            {label && (
                <label htmlFor={idKolom} className="mb-1.5 block text-sm font-semibold text-ink">
                    {label}
                </label>
            )}
            <div
                className={cn(
                    'flex items-center gap-2 rounded-md border bg-white px-3.5 transition duration-fast focus-within:border-primary focus-within:shadow-ring',
                    galat ? 'border-coral-500' : 'border-slate-200',
                )}
            >
                {ikonKiri && <span className="inline-flex text-slate-500">{ikonKiri}</span>}
                <input ref={ref} id={idKolom} className={cn('min-h-12 min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-slate-400', className)} aria-invalid={!!galat} {...rest} />
                {akhiran}
            </div>
            {(galat || petunjuk) && <p className={cn('mt-1.5 text-xs', galat ? 'text-coral-600' : 'text-slate-500')}>{galat || petunjuk}</p>}
        </div>
    )
})
