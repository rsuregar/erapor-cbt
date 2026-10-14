import { api } from '@/lib/api'
import { RenderKonten, type TiptapNode } from '@erapor-cbt/question-renderer'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

const angka = (n: number | null) => (n === null ? '—' : String(n).replace('.', ','))

/** Hasil setelah nilai dirilis guru (GET /attempt/{id}/hasil). */
export default function Hasil({ attemptId }: { attemptId: number }) {
    const hasil = useQuery({ queryKey: ['hasil', attemptId], queryFn: () => api.hasil(attemptId), retry: false })

    return (
        <main className="mx-auto max-w-3xl space-y-4 p-4">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500">
                <ArrowLeft className="size-4" /> Kembali
            </Link>
            {hasil.isPending && <p className="text-slate-500">Memuat…</p>}
            {hasil.isError && <p className="rounded-lg bg-slate-100 p-4 text-slate-600">{hasil.error.message}</p>}
            {hasil.data && (
                <>
                    <section className="rounded-2xl bg-slate-900 p-5 text-white">
                        <p className="text-sm opacity-80">{hasil.data.ujian.nama}</p>
                        <p className="text-4xl font-bold">{angka(hasil.data.nilai)}</p>
                        <p className="text-sm opacity-80">
                            Skor {angka(hasil.data.skor)} / {angka(hasil.data.skor_maks)}
                            {hasil.data.tuntas !== null && ` · ${hasil.data.tuntas ? 'Tuntas' : 'Remedial'} (KKTP ${hasil.data.kktp})`}
                        </p>
                    </section>
                    {hasil.data.soal.map((s) => (
                        <article key={s.id} className="space-y-2 rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="rounded-md bg-slate-900 px-2 py-0.5 font-semibold text-white">{s.nomor}</span>
                                <span className="ml-auto font-medium">
                                    {s.anulir === 'dikeluarkan' ? 'Dianulir' : `${angka(s.skor)} / ${angka(s.bobot)}`}
                                </span>
                            </div>
                            <RenderKonten doc={s.pertanyaan as TiptapNode} />
                            {s.komentar.length > 0 && <p className="rounded-lg bg-sky-50 p-2 text-sm text-sky-900">Catatan guru: {s.komentar.join(' · ')}</p>}
                            {s.pembahasan && (
                                <details className="text-sm">
                                    <summary className="cursor-pointer font-medium">Pembahasan</summary>
                                    <RenderKonten doc={s.pembahasan as TiptapNode} />
                                </details>
                            )}
                        </article>
                    ))}
                </>
            )}
        </main>
    )
}
