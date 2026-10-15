import { KepalaFitur } from '@/komponen/KepalaFitur'
import { Kartu } from '@/komponen/Kartu'
import { Lencana } from '@/komponen/Lencana'
import { api } from '@/lib/api'
import { RenderKonten, type TiptapNode } from '@erapor-cbt/question-renderer'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Info, MessageSquareText } from 'lucide-react'

const angka = (n: number | null) => (n === null ? '—' : String(n).replace('.', ','))

/** Nilai & pembahasan setelah dirilis guru (PRD M-12). */
export default function Hasil({ attemptId }: { attemptId: number }) {
    const navigate = useNavigate()
    const hasil = useQuery({ queryKey: ['hasil', attemptId], queryFn: () => api.hasil(attemptId), retry: false })
    const h = hasil.data

    return (
        <div className="min-h-full pb-10">
            <KepalaFitur
                judul={h?.ujian.nama ?? 'Hasil ujian'}
                subjudul={h?.ujian.mapel ?? undefined}
                nada={h?.tuntas === false ? 'red' : 'brand'}
                onKembali={() => navigate({ to: '/' })}
            >
                {h && (
                    <div className="flex items-end gap-4">
                        <div>
                            <p className="text-xs opacity-85">Nilai</p>
                            <p className="font-display text-display font-semibold leading-none">{angka(h.nilai)}</p>
                        </div>
                        <div className="pb-1 text-sm opacity-90">
                            Skor {angka(h.skor)} / {angka(h.skor_maks)}
                            {h.kktp !== null && <span className="block">KKTP {h.kktp}</span>}
                        </div>
                        {h.tuntas !== null && (
                            <span className="mb-1 ml-auto rounded-full bg-white px-3 py-1 text-xs font-bold text-ink">{h.tuntas ? 'Tuntas' : 'Remedial'}</span>
                        )}
                    </div>
                )}
            </KepalaFitur>

            <main className="mx-auto max-w-3xl space-y-3 px-4 pt-5">
                {hasil.isPending && <p className="text-slate-500">Memuat…</p>}
                {hasil.isError && <Kartu nada="sunken" className="text-center text-slate-500">{hasil.error.message}</Kartu>}

                {/* Banner info penundaan pembahasan */}
                {h?.pembahasan_ditunda && (
                    <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-xs text-sky-900">
                        <Info className="size-4 shrink-0 text-sky-600 mt-0.5" />
                        <div>
                            <p className="font-semibold">Ujian Masih Berlangsung</p>
                            <p className="mt-0.5 text-sky-800">
                                Nilai akhir Anda sudah tercatat di atas. Kunci jawaban dan pembahasan per butir soal akan otomatis terbuka setelah seluruh jadwal ujian berakhir
                                {h.pembahasan_terbuka_pada ? ` (${new Date(h.pembahasan_terbuka_pada).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})` : ''}.
                            </p>
                        </div>
                    </div>
                )}

                {h?.soal.map((s) => {
                    const penuh = s.skor !== null && s.skor >= s.bobot
                    return (
                        <Kartu key={s.id} className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex size-8 items-center justify-center rounded-sm bg-ink text-sm font-bold text-white">{s.nomor}</span>
                                <span className="ml-auto">
                                    {s.anulir === 'dikeluarkan' ? (
                                        <Lencana nada="neutral">Dianulir</Lencana>
                                    ) : s.skor === null ? null : (
                                        <Lencana nada={penuh ? 'green' : s.skor ? 'amber' : 'red'}>
                                            {angka(s.skor)} / {angka(s.bobot)}
                                        </Lencana>
                                    )}
                                </span>
                            </div>
                            <RenderKonten doc={s.pertanyaan as TiptapNode} />
                            {s.komentar.length > 0 && (
                                <p className="flex gap-2 rounded-sm bg-sky-100 px-3 py-2 text-sm text-ink">
                                    <MessageSquareText className="mt-0.5 size-4 shrink-0 text-sky-600" /> {s.komentar.join(' · ')}
                                </p>
                            )}
                            {s.pembahasan && (
                                <details className="rounded-sm bg-slate-50 px-3 py-2 text-sm">
                                    <summary className="cursor-pointer font-semibold text-primary">Pembahasan</summary>
                                    <div className="mt-2">
                                        <RenderKonten doc={s.pembahasan as TiptapNode} />
                                    </div>
                                </details>
                            )}
                        </Kartu>
                    )
                })}
            </main>
        </div>
    )
}
