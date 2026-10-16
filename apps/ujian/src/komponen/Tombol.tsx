import { cn } from '@/lib/utils'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

const VARIAN = {
    primary: 'bg-primary text-white border-primary shadow-brand hover:bg-primary-600',
    secondary: 'bg-primary-50 text-primary-700 border-transparent hover:bg-primary-100',
    outline: 'bg-white text-primary border-slate-300 hover:bg-slate-50',
    ghost: 'bg-transparent text-primary border-transparent hover:bg-primary-50',
    magenta: 'bg-magenta-500 text-white border-magenta-500 shadow-[0_10px_24px_rgba(236,42,107,0.22)]',
    danger: 'bg-coral-500 text-white border-coral-500 hover:bg-coral-600',
} as const

const UKURAN = {
    sm: 'text-sm px-3.5 py-2 gap-1.5 rounded-lg',
    md: 'text-body px-5 py-[11px] gap-2 rounded-lg',
    lg: 'text-body-lg px-6 py-3.5 gap-2 rounded-lg font-bold',
} as const

const DASAR =
    'inline-flex min-h-11 select-none items-center justify-center border font-semibold leading-none transition duration-fast ease-standard active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50'

/** Kelas tombol untuk elemen lain (mis. <Link>) supaya tidak ada tombol di dalam tautan. */
export function kelasTombol(varian: keyof typeof VARIAN = 'primary', ukuran: keyof typeof UKURAN = 'md', penuh = false): string {
    return cn(DASAR, VARIAN[varian], UKURAN[ukuran], penuh && 'w-full')
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
    varian?: keyof typeof VARIAN
    ukuran?: keyof typeof UKURAN
    penuh?: boolean
    ikonKiri?: ReactNode
    ikonKanan?: ReactNode
}

/** Tombol Al Akhyar (DS: Button) — tekan = skala 0,97; nonaktif = 50%. */
export const Tombol = forwardRef<HTMLButtonElement, Props>(function Tombol(
    { varian = 'primary', ukuran = 'md', penuh, ikonKiri, ikonKanan, className, children, ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            className={cn(kelasTombol(varian, ukuran, penuh), className)}
            {...rest}
        >
            {ikonKiri}
            {children}
            {ikonKanan}
        </button>
    )
})
