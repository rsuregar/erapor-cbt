import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

const NADA = {
    brand: ['bg-primary text-white', 'bg-primary-50 text-primary-700'],
    sky: ['bg-sky-500 text-white', 'bg-sky-100 text-sky-700'],
    magenta: ['bg-magenta-500 text-white', 'bg-magenta-100 text-magenta-600'],
    green: ['bg-green-500 text-white', 'bg-green-100 text-green-700'],
    red: ['bg-coral-500 text-white', 'bg-coral-100 text-coral-700'],
    amber: ['bg-amber-500 text-amber-900', 'bg-amber-100 text-amber-700'],
    neutral: ['bg-slate-500 text-white', 'bg-slate-100 text-slate-700'],
} as const

export type NadaLencana = keyof typeof NADA

/** Lencana status (DS: Badge) — pil, tebal, nada lembut atau padat. */
export function Lencana({ nada = 'brand', padat, className, ...rest }: HTMLAttributes<HTMLSpanElement> & { nada?: NadaLencana; padat?: boolean }) {
    return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-micro font-bold', NADA[nada][padat ? 0 : 1], className)} {...rest} />
}
