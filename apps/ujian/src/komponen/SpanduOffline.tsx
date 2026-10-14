import { jamMenit } from '@/lib/tanggal'
import { CloudOff } from 'lucide-react'

/** Spanduk offline di luar layar ujian: data yang tampil adalah salinan terakhir di perangkat. */
export function SpanduOffline({ pada, children }: { pada?: number; children?: React.ReactNode }) {
    return (
        <div role="status" className="flex gap-2.5 rounded-md bg-amber-100 px-3.5 py-3 text-sm text-amber-900">
            <CloudOff className="mt-0.5 size-4 shrink-0" />
            <p>
                <b>Kamu sedang offline.</b>
                {pada ? ` Daftar terakhir diperbarui ${jamMenit(new Date(pada).toISOString())}.` : ''} {children}
            </p>
        </div>
    )
}
