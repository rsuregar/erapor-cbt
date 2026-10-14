import { Kartu } from '@/komponen/Kartu'
import { Lencana } from '@/komponen/Lencana'
import { Tombol } from '@/komponen/Tombol'
import type { AksiCek, HasilCek, ItemCek } from '@/lib/kesiapan'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Info, MonitorSmartphone, XCircle } from 'lucide-react'

const IKON: Record<HasilCek, React.ReactNode> = {
    lulus: <CheckCircle2 className="size-5 text-green-500" />,
    peringatan: <AlertTriangle className="size-5 text-amber-500" />,
    gagal: <XCircle className="size-5 text-coral-500" />,
    info: <Info className="size-5 text-sky-500" />,
}

const LABEL_AKSI: Record<AksiCek, string> = {
    layar_penuh: 'Coba layar penuh',
    perbarui: 'Perbarui',
    panduan: 'Lihat panduan',
}

/**
 * Cek kesiapan perangkat (story 7.3). Yang lulus diringkas satu baris supaya
 * perhatian murid jatuh ke yang perlu diperbaiki.
 */
export function KartuKesiapan({
    daftar,
    penghalang,
    onAksi,
}: {
    daftar: ItemCek[]
    penghalang: ItemCek[]
    onAksi: (a: AksiCek) => void
}) {
    const perlu = daftar.filter((i) => i.hasil !== 'lulus')
    const lulus = daftar.filter((i) => i.hasil === 'lulus')
    const [lencana, nada] = penghalang.length
        ? ([`${penghalang.length} perlu diperbaiki`, 'red'] as const)
        : perlu.some((i) => i.hasil === 'peringatan')
          ? (['Siap, ada saran', 'amber'] as const)
          : (['Siap', 'green'] as const)

    return (
        <Kartu className="space-y-3">
            <div className="flex items-center gap-2">
                <MonitorSmartphone className="size-5 text-primary" />
                <h2 className="mr-auto text-body-lg">Kesiapan perangkat</h2>
                <Lencana nada={nada}>{lencana}</Lencana>
            </div>

            {perlu.map((i) => (
                <div
                    key={i.kunci}
                    className={cn(
                        'flex gap-2.5 rounded-sm p-3',
                        i.hasil === 'gagal' ? 'bg-coral-100/60' : i.hasil === 'peringatan' ? 'bg-amber-100/60' : 'bg-slate-50',
                    )}
                >
                    <span className="mt-px shrink-0">{IKON[i.hasil]}</span>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink">{i.judul}</p>
                        <p className="text-sm text-slate-700">{i.keterangan}</p>
                        {i.aksi && i.aksi !== 'layar_penuh' && i.aksi !== 'panduan' && (
                            <Tombol varian="outline" ukuran="sm" className="mt-2" onClick={() => onAksi(i.aksi!)}>
                                {LABEL_AKSI[i.aksi]}
                            </Tombol>
                        )}
                    </div>
                </div>
            ))}

            <ul className="space-y-1.5">
                {lulus.map((i) => (
                    <li key={i.kunci} className="flex items-start gap-2 text-sm">
                        <span className="mt-px shrink-0">{IKON.lulus}</span>
                        <span>
                            <b className="font-semibold text-ink">{i.judul}</b> <span className="text-slate-500">· {i.keterangan}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </Kartu>
    )
}
