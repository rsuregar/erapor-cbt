import { cn } from '@/lib/utils'

/** Bilah progres; `nilai` null = tak tentu (beranimasi). */
export function Progres({ nilai, className }: { nilai: number | null; className?: string }) {
    return (
        <div
            className={cn('relative h-2 overflow-hidden rounded-full bg-slate-100', className)}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={nilai === null ? undefined : Math.round(nilai * 100)}
        >
            {nilai === null ? (
                <div className="absolute inset-y-0 w-1/3 animate-[progres-tak-tentu_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
            ) : (
                <div className="h-full rounded-full bg-primary transition-[width] duration-base ease-out" style={{ width: `${Math.min(100, Math.max(0, nilai * 100))}%` }} />
            )}
        </div>
    )
}
