import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

/**
 * Persiapan ujian: pra-unduh paket + media, masukkan token, mulai.
 * Alurnya (dekripsi, outbox, sinkron) sudah ada di exam-core; layar
 * mengerjakan dibangun di sprint app berikutnya.
 */
export default function Persiapan({ ujianId }: { ujianId: number }) {
    const ujian = useQuery({ queryKey: ['ujian'], queryFn: () => api.daftarUjian(), select: (d) => d.find((u) => u.id === ujianId) })

    return (
        <main className="mx-auto max-w-xl space-y-4 p-4">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500">
                <ArrowLeft className="size-4" /> Kembali
            </Link>
            {ujian.data ? (
                <section className="space-y-2 rounded-xl border border-slate-200 p-4">
                    <h1 className="text-lg font-semibold">{ujian.data.nama}</h1>
                    <p className="text-sm text-slate-500">
                        {ujian.data.mapel} · {ujian.data.jumlah_soal} soal · keamanan {ujian.data.level_keamanan}
                    </p>
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Layar unduh paket, token, dan pengerjaan sedang dibangun.</p>
                </section>
            ) : (
                <p className="text-slate-500">{ujian.isPending ? 'Memuat…' : 'Ujian tidak ditemukan.'}</p>
            )}
        </main>
    )
}
