import { Lencana } from '@/komponen/Lencana'
import { Tombol } from '@/komponen/Tombol'
import type { AksiCek, HasilCek, ItemCek } from '@/lib/kesiapan'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, ChevronDown, Info, MonitorSmartphone, XCircle } from 'lucide-react'

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
 * Cek kesiapan perangkat (story 7.3), satu baris di kartu "Sebelum mulai".
 * `gagal` yang tidak mengunci Mulai (level Dasar) tampil sebagai saran kuning,
 * bukan silang merah — supaya lencana "Siap" tidak bertentangan dengan isinya.
 * Yang lulus dilipat; perhatian murid jatuh ke yang perlu diperbaiki.
 */
export function KartuKesiapan({
    id,
    daftar,
    penghalang,
    onAksi,
}: {
    id?: string
    daftar: ItemCek[]
    penghalang: ItemCek[]
    onAksi: (a: AksiCek) => void
}) {
    const menghalangi = new Set(penghalang.map((i) => i.kunci))
    const tampil = (i: ItemCek): HasilCek => (i.hasil === 'gagal' && !menghalangi.has(i.kunci) ? 'peringatan' : i.hasil)
    const perlu = daftar.filter((i) => i.hasil !== 'lulus')
    const lulus = daftar.filter((i) => i.hasil === 'lulus')
    const [lencana, nada] = penghalang.length
        ? ([`${penghalang.length} perlu diperbaiki`, 'red'] as const)
        : perlu.some((i) => tampil(i) === 'peringatan')
          ? (['Siap, ada saran', 'amber'] as const)
          : (['Siap', 'green'] as const)
    // Satu tombol panduan cukup walau beberapa butir menunjuk ke halaman yang sama.
    const aksiPertama = new Map<AksiCek, string>()
    for (const i of perlu) if (i.aksi && !aksiPertama.has(i.aksi)) aksiPertama.set(i.aksi, i.kunci)

    return (
        <section id={id} tabIndex={-1} aria-labelledby="judul-perangkat" className="scroll-mt-4 space-y-3 outline-none">
            <div className="flex items-center gap-2 text-sm">
                {penghalang.length ? <MonitorSmartphone className="size-5 text-primary" /> : <CheckCircle2 className="size-5 text-green-500" />}
                <h3 id="judul-perangkat" className="mr-auto text-sm font-semibold">
                    Perangkat
                </h3>
                <Lencana nada={nada}>{lencana}</Lencana>
            </div>

            {perlu.map((i) => {
                const hasil = tampil(i)

                // Info bukan masalah: tanpa kotak berwarna, panduan cukup tautan.
                if (hasil === 'info') {
                    return (
                        <div key={i.kunci} className="flex gap-2.5 text-sm">
                            <span className="mt-px shrink-0">{IKON.info}</span>
                            <p className="min-w-0 flex-1 text-slate-700">
                                <b className="font-semibold text-ink">{i.judul}.</b> {i.keterangan}
                                {i.aksi === 'panduan' && aksiPertama.get(i.aksi) === i.kunci && (
                                    <>
                                        {' '}
                                        <button type="button" className="font-semibold text-primary underline underline-offset-2" onClick={() => onAksi('panduan')}>
                                            Lihat panduan
                                        </button>
                                    </>
                                )}
                            </p>
                        </div>
                    )
                }

                return (
                    <div
                        key={i.kunci}
                        className={cn('flex gap-2.5 rounded-sm p-3', hasil === 'gagal' ? 'bg-coral-100/60' : 'bg-amber-100/60')}
                    >
                        <span className="mt-px shrink-0">{IKON[hasil]}</span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-ink">
                                {hasil === 'peringatan' && i.hasil === 'gagal' && <span className="font-semibold text-amber-700">Saran · </span>}
                                {i.judul}
                            </p>
                            <p className="text-sm text-slate-700">{i.keterangan}</p>
                            {i.aksi && i.aksi !== 'layar_penuh' && aksiPertama.get(i.aksi) === i.kunci && (
                                <Tombol varian="outline" ukuran="sm" className="mt-2 min-h-11" onClick={() => onAksi(i.aksi!)}>
                                    {LABEL_AKSI[i.aksi]}
                                </Tombol>
                            )}
                        </div>
                    </div>
                )
            })}

            {lulus.length > 0 && (
                <details className="group">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                        {lulus.length} pemeriksaan lulus
                    </summary>
                    <ul className="space-y-1.5 pb-1 pl-1">
                        {lulus.map((i) => (
                            <li key={i.kunci} className="flex items-start gap-2 text-sm">
                                <span className="mt-px shrink-0">{IKON.lulus}</span>
                                <span>
                                    <b className="font-semibold text-ink">{i.judul}</b> <span className="text-slate-500">· {i.keterangan}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    )
}
