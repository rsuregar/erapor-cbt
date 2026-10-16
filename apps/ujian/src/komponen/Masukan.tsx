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
                    'flex items-center gap-2.5 rounded-xl border bg-white px-3.5 transition duration-fast focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15',
                    galat ? 'border-coral-500 focus-within:border-coral-500 focus-within:ring-coral-500/15' : 'border-slate-200 hover:border-slate-300',
                )}
            >
                {ikonKiri && <span className="inline-flex text-slate-500">{ikonKiri}</span>}
                <input
                    ref={ref}
                    id={idKolom}
                    className={cn(
                        'min-h-12 min-w-0 flex-1 border-0 bg-transparent text-body text-ink outline-none focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none placeholder:text-slate-400',
                        className,
                    )}
                    aria-invalid={!!galat}
                    {...rest}
                />
                {akhiran}
            </div>
            {(galat || petunjuk) && <p className={cn('mt-1.5 text-xs', galat ? 'text-coral-600' : 'text-slate-500')}>{galat || petunjuk}</p>}
        </div>
    )
})
