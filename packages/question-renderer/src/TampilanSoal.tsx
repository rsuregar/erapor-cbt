import { useId } from 'react'
import RenderKonten from './RenderKonten'
import type {
    ItemKonten,
    Jawaban,
    Kunci,
    OpsiBenarSalah,
    OpsiMenjodohkan,
    SoalTampil,
} from './types'

const HURUF = 'ABCDEF'

/**
 * Tata letak:
 *  - 'otomatis'  : dua kolom mulai lebar lg (web / tablet lanskap), satu
 *                  kolom di bawahnya. Dipakai app murid.
 *  - 'satu-kolom' / 'dua-kolom': dipaksa — untuk pratinjau HP/lanskap di
 *                  panel guru, yang lebarnya bukan lebar layar.
 * Dua kolom hanya berlaku bila ada bacaan: bacaan di kiri, soal di kanan
 * (pola Bluebook/ANBK). Tanpa bacaan, soal satu kolom di tengah.
 */
export type TataLetak = 'otomatis' | 'satu-kolom' | 'dua-kolom'

type Props = {
    soal: SoalTampil
    /** Nomor urut di ujian (opsional). */
    nomor?: number
    jawaban?: Jawaban
    onJawab?: (jawaban: Jawaban) => void
    /** Pratinjau guru: tandai kunci. Jangan pernah diisi di app murid. */
    kunci?: Kunci
    nonaktif?: boolean
    tata?: TataLetak
    ragu?: boolean
    onRagu?: (ragu: boolean) => void
}

/**
 * Satu soal seperti yang dilihat murid. Komponen yang sama dipakai pratinjau
 * di panel guru dan layar ujian di app murid, supaya tampilannya identik
 * (PRD G-05). Hanya bergantung pada React, KaTeX, dan Tailwind.
 */
export default function TampilanSoal({
    soal,
    nomor,
    jawaban = null,
    onJawab,
    kunci,
    nonaktif,
    tata = 'otomatis',
    ragu = false,
    onRagu,
}: Props) {
    const ubah = (j: Jawaban) => !nonaktif && onJawab?.(j)
    const duaKolom = !!soal.stimulus && tata !== 'satu-kolom'
    const kelasGrid = !duaKolom
        ? 'mx-auto max-w-2xl'
        : tata === 'dua-kolom'
          ? 'grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700'
          : 'grid lg:grid-cols-2 lg:divide-x lg:divide-slate-200 dark:lg:divide-slate-700'
    const kelasKiri = tata === 'dua-kolom' ? 'pr-6 max-h-[70vh] overflow-y-auto' : 'pb-4 lg:pb-0 lg:pr-6 lg:max-h-[70vh] lg:overflow-y-auto'
    const kelasKanan = duaKolom ? (tata === 'dua-kolom' ? 'pl-6' : 'lg:pl-6') : ''

    return (
        <div className={kelasGrid}>
            {soal.stimulus && (
                <section className={duaKolom ? kelasKiri : 'mb-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700'}>
                    <RenderKonten doc={soal.stimulus.konten} />
                </section>
            )}

            <div className={`space-y-4 ${kelasKanan}`}>
                {(nomor !== undefined || onRagu) && (
                    <div className="flex items-center gap-3 rounded-md border-b-2 border-dashed border-slate-300 bg-slate-100 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800">
                        {nomor !== undefined && (
                            <span className="grid size-8 place-items-center rounded bg-slate-900 text-sm font-bold text-white tabular-nums dark:bg-slate-100 dark:text-slate-900">
                                {nomor}
                            </span>
                        )}
                        {onRagu && (
                            <button
                                type="button"
                                aria-pressed={ragu}
                                onClick={() => onRagu(!ragu)}
                                className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm ${
                                    ragu ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'
                                }`}
                            >
                                <svg viewBox="0 0 24 24" className="size-4" fill={ragu ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
                                    <path d="M6 3h12v18l-6-4-6 4z" />
                                </svg>
                                Tandai ragu-ragu
                            </button>
                        )}
                    </div>
                )}

                <RenderKonten doc={soal.pertanyaan} />

                <IsianJawaban soal={soal} jawaban={jawaban} ubah={ubah} kunci={kunci} nonaktif={nonaktif} />
            </div>
        </div>
    )
}

function IsianJawaban({
    soal,
    jawaban,
    ubah,
    kunci,
    nonaktif,
}: {
    soal: SoalTampil
    jawaban: Jawaban
    ubah: (j: Jawaban) => void
    kunci?: Kunci
    nonaktif?: boolean
}) {
    const nama = useId()

    switch (soal.jenis) {
        case 'pilihan_ganda':
        case 'pg_stimulus':
        case 'pg_kompleks': {
            const kompleks = soal.jenis === 'pg_kompleks'
            const opsi = (soal.opsi as ItemKonten[] | null) ?? []
            const dipilih = kompleks ? ((jawaban as string[]) ?? []) : [jawaban as string]
            const benar = new Set(
                kunci && 'opsi' in kunci ? ([] as string[]).concat(kunci.opsi as string | string[]) : [],
            )
            return (
                <div className="space-y-2">
                    {kompleks && (
                        <p className="text-xs font-medium text-sky-700 dark:text-sky-300">
                            Pilih lebih dari satu jawaban.
                        </p>
                    )}
                    {opsi.map((o, i) => {
                        const aktif = dipilih.includes(o.id)
                        return (
                            <label
                                key={o.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-400 ${
                                    aktif
                                        ? 'border-sky-600 bg-sky-50/60 dark:bg-sky-950/40'
                                        : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
                                } ${benar.has(o.id) ? 'outline outline-2 outline-offset-2 outline-emerald-500' : ''}`}
                            >
                                <input
                                    type={kompleks ? 'checkbox' : 'radio'}
                                    name={nama}
                                    className="sr-only"
                                    checked={aktif}
                                    disabled={nonaktif}
                                    onChange={() =>
                                        ubah(
                                            kompleks
                                                ? aktif
                                                    ? dipilih.filter((id) => id !== o.id)
                                                    : [...dipilih, o.id]
                                                : o.id,
                                        )
                                    }
                                />
                                <span
                                    aria-hidden
                                    className={`grid size-7 shrink-0 place-items-center border-2 text-sm font-bold ${
                                        kompleks ? 'rounded-md' : 'rounded-full'
                                    } ${aktif ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-400 text-slate-700 dark:text-slate-200'}`}
                                >
                                    {HURUF[i]}
                                </span>
                                <RenderKonten doc={o.konten} className="flex-1 pt-0.5" />
                            </label>
                        )
                    })}
                </div>
            )
        }

        case 'benar_salah': {
            const opsi = soal.opsi as OpsiBenarSalah | null
            const isi = (jawaban as Record<string, boolean>) ?? {}
            const k = (kunci as Record<string, boolean> | undefined) ?? {}
            if (!opsi) return null
            return (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800">
                                <th className="border border-slate-200 p-2 text-left dark:border-slate-700">Pernyataan</th>
                                <th className="w-20 border border-slate-200 p-2 dark:border-slate-700">{opsi.label_benar}</th>
                                <th className="w-20 border border-slate-200 p-2 dark:border-slate-700">{opsi.label_salah}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {opsi.pernyataan.map((p) => (
                                <tr key={p.id}>
                                    <td className="border border-slate-200 p-2 dark:border-slate-700">
                                        <RenderKonten doc={p.konten} />
                                    </td>
                                    {[true, false].map((nilai) => (
                                        <td
                                            key={String(nilai)}
                                            className={`border border-slate-200 p-2 text-center dark:border-slate-700 ${
                                                k[p.id] === nilai ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name={`${nama}-${p.id}`}
                                                aria-label={nilai ? opsi.label_benar : opsi.label_salah}
                                                checked={isi[p.id] === nilai}
                                                disabled={nonaktif}
                                                onChange={() => ubah({ ...isi, [p.id]: nilai })}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
        }

        case 'menjodohkan': {
            // Dropdown per item kiri: berfungsi sama baiknya di HP dan desktop.
            // Tarik-garis di desktop bisa menyusul tanpa mengubah format jawaban.
            const opsi = soal.opsi as OpsiMenjodohkan | null
            const isi = (jawaban as Record<string, string>) ?? {}
            const k = (kunci as Record<string, string> | undefined) ?? {}
            if (!opsi) return null
            return (
                <div className="space-y-3">
                    <div className="space-y-2">
                        {opsi.kiri.map((kiri, i) => (
                            <div
                                key={kiri.id}
                                className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_minmax(10rem,40%)] dark:border-slate-700"
                            >
                                <div className="flex gap-2">
                                    <span className="font-semibold">{i + 1}.</span>
                                    <RenderKonten doc={kiri.konten} className="flex-1" />
                                </div>
                                <select
                                    className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                                    value={isi[kiri.id] ?? ''}
                                    disabled={nonaktif}
                                    onChange={(e) => ubah({ ...isi, [kiri.id]: e.target.value })}
                                >
                                    <option value="">— pilih pasangan —</option>
                                    {opsi.kanan.map((kanan, j) => (
                                        <option key={kanan.id} value={kanan.id}>
                                            {HURUF_PASANGAN(j)}
                                            {k[kiri.id] === kanan.id ? ' ✓' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pilihan pasangan</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {opsi.kanan.map((kanan, j) => (
                                <div key={kanan.id} className="flex gap-2">
                                    <span className="font-semibold">{HURUF_PASANGAN(j)}.</span>
                                    <RenderKonten doc={kanan.konten} className="flex-1" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )
        }

        case 'isian': {
            const k = kunci as { jawaban?: string[] } | undefined
            return (
                <div className="space-y-1">
                    <input
                        type="text"
                        className="h-10 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900"
                        placeholder="Tulis jawaban singkat…"
                        value={(jawaban as string) ?? ''}
                        disabled={nonaktif}
                        onChange={(e) => ubah(e.target.value)}
                    />
                    {k?.jawaban?.length ? (
                        <p className="text-xs text-emerald-700">Diterima: {k.jawaban.join(' / ')}</p>
                    ) : null}
                </div>
            )
        }

        case 'uraian':
        case 'studi_kasus': {
            const teks = (jawaban as string) ?? ''
            const kata = teks.trim() ? teks.trim().split(/\s+/).length : 0
            return (
                <div className="space-y-1">
                    <textarea
                        rows={6}
                        dir="auto"
                        className="w-full rounded-md border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900"
                        placeholder="Tulis jawaban…"
                        value={teks}
                        disabled={nonaktif}
                        onChange={(e) => ubah(e.target.value)}
                    />
                    <p className="text-right text-xs text-slate-500 tabular-nums">{kata} kata</p>
                </div>
            )
        }
    }
}

/** Label pasangan kanan: A, B, C, … lalu AA bila lebih dari 26. */
function HURUF_PASANGAN(i: number): string {
    const abjad = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    return i < 26 ? abjad[i] : abjad[Math.floor(i / 26) - 1] + abjad[i % 26]
}
