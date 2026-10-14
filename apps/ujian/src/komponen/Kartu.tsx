import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

const NADA = {
    default: 'bg-white border-slate-200 shadow-sm',
    sunken: 'bg-slate-100 border-transparent',
    brand: 'bg-primary border-primary text-white shadow-sm',
    green: 'bg-green-100 border-transparent shadow-sm',
} as const

/** Permukaan dasar (DS: Card) — putih, sudut 18px, bayangan lembut. */
export function Kartu({ nada = 'default', interaktif, className, ...rest }: HTMLAttributes<HTMLDivElement> & { nada?: keyof typeof NADA; interaktif?: boolean }) {
    return (
        <div
            className={cn(
                'rounded-lg border p-4 transition duration-base ease-out',
                NADA[nada],
                interaktif && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
                className,
            )}
            {...rest}
        />
    )
}
