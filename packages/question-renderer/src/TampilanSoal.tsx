import { useId, useState } from 'react'
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
    /** Nama bagian soal (mis. "Bagian I: Pilihan Ganda"), tampil di samping nomor. */
    section?: string | null
    jawaban?: Jawaban
    onJawab?: (jawaban: Jawaban) => void
    /** Pratinjau guru: tandai kunci. Jangan pernah diisi di app murid. */
    kunci?: Kunci
    nonaktif?: boolean
    tata?: TataLetak
    ragu?: boolean
    onRagu?: (ragu: boolean) => void
    skalaFont?: number
    onUbahSkalaFont?: (skala: number) => void
}

/**
 * Satu soal seperti yang dilihat murid. Komponen yang sama dipakai pratinjau
 * di panel guru dan layar ujian di app murid, supaya tampilannya identik
 * (PRD G-05). Hanya bergantung pada React, KaTeX, dan Tailwind.
 */
export default function TampilanSoal({
    soal,
    nomor,
    section,
    jawaban = null,
    onJawab,
    kunci,
    nonaktif,
    tata = 'otomatis',
    ragu = false,
    onRagu,
    skalaFont,
    onUbahSkalaFont,
}: Props) {
    const [skalaInternal, setSkalaInternal] = useState(1)
    const skala = skalaFont ?? skalaInternal
    const setSkala = onUbahSkalaFont ?? setSkalaInternal

    const ubah = (j: Jawaban) => !nonaktif && onJawab?.(j)
    const duaKolom = !!soal.stimulus && tata !== 'satu-kolom'

    const perbesar = () => setSkala(Math.min(1.4, Number((skala + 0.15).toFixed(2))))
    const perkecil = () => setSkala(Math.max(0.85, Number((skala - 0.15).toFixed(2))))
    const normal = () => setSkala(1)

    const kelasGrid = !duaKolom
        ? 'mx-auto max-w-3xl w-full pt-5 sm:pt-7 pb-6 px-4'
        : tata === 'dua-kolom'
          ? 'grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700 h-full min-h-full w-full'
          : 'grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-700 h-full min-h-full w-full'

    const kelasKiri = tata === 'dua-kolom'
        ? 'pr-6 lg:pr-8 h-full overflow-y-auto pt-5 sm:pt-6 pb-6 px-4 sm:px-6 space-y-3.5 bg-slate-50/40'
        : 'pb-6 lg:pb-0 pr-0 lg:pr-8 h-full overflow-y-auto pt-5 sm:pt-6 pb-6 px-4 sm:px-6 space-y-3.5 bg-slate-50/40'

    const kelasKanan = duaKolom
        ? tata === 'dua-kolom'
            ? 'pl-6 lg:pl-8 h-full overflow-y-auto pt-5 sm:pt-6 pb-6 px-4 sm:px-6 space-y-4 bg-white'
            : 'pl-0 lg:pl-8 h-full overflow-y-auto pt-5 sm:pt-6 pb-6 px-4 sm:px-6 space-y-4 bg-white'
        : 'space-y-4'

    return (
        <div className={kelasGrid}>
            {soal.stimulus && (
                <section className={duaKolom ? kelasKiri : 'mb-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700'}>
                    <div className="mb-3.5 flex items-center justify-between border-b border-slate-200/80 pb-2.5 dark:border-slate-700">
                        <div className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800 border border-sky-200/70 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800">
                            <svg viewBox="0 0 24 24" className="size-3.5 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                            </svg>
                            <span>{soal.stimulus.judul || 'Wacana / Bahan Bacaan'}</span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">Gunakan untuk menjawab soal</span>
                    </div>
                    <div className="leading-relaxed" style={{ fontSize: `${skala * 100}%` }}>
                        <RenderKonten doc={soal.stimulus.konten} />
                    </div>
                </section>
            )}

            <div className={kelasKanan}>
                {(nomor !== undefined || onRagu) && (
                    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-slate-200/90 bg-slate-100/75 p-2 sm:px-3 sm:py-2 dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center gap-2">
                            {nomor !== undefined && (
                                <span className="inline-flex h-7 sm:h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs sm:text-sm font-extrabold text-white shadow-xs dark:bg-slate-100 dark:text-slate-900 tabular-nums">
                                    Soal {nomor}
                                </span>
                            )}
                            {section && (
                                <span className="inline-block max-w-[14rem] sm:max-w-xs truncate rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300" title={section}>
                                    {section}
                                </span>
                            )}
                            {onRagu && (
                                <button
                                    type="button"
                                    aria-pressed={ragu}
                                    onClick={() => onRagu(!ragu)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                                        ragu
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-xs dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700'
                                            : 'bg-white/90 text-slate-700 border border-slate-300/80 hover:bg-white hover:border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                                    }`}
                                >
                                    <svg viewBox="0 0 24 24" className={`size-3.5 ${ragu ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} fill={ragu ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
                                        <path d="M6 3h12v18l-6-4-6 4z" />
                                    </svg>
                                    <span>{ragu ? 'Ragu-ragu' : 'Tandai ragu-ragu'}</span>
                                </button>
                            )}
                        </div>

                        {/* Kontrol Ukuran Font / Zoom Teks */}
                        <div className="flex items-center gap-1">
                            <span className="hidden sm:inline text-[11px] font-semibold text-slate-400 mr-0.5">Ukuran Teks:</span>
                            <div className="inline-flex items-center rounded-lg bg-white/90 border border-slate-300/80 p-0.5 shadow-2xs dark:bg-slate-700 dark:border-slate-600">
                                <button
                                    type="button"
                                    onClick={perkecil}
                                    disabled={skala <= 0.85}
                                    title="Kecilkan huruf (Zoom Out)"
                                    aria-label="Kecilkan ukuran huruf"
                                    className="inline-flex h-6 w-7 items-center justify-center rounded text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 transition dark:text-slate-200 dark:hover:bg-slate-600"
                                >
                                    A-
                                </button>
                                <button
                                    type="button"
                                    onClick={normal}
                                    title="Kembalikan ukuran normal (100%)"
                                    aria-label="Kembalikan ukuran normal"
                                    className={`inline-flex h-6 px-2 items-center justify-center rounded text-[11px] transition font-bold ${
                                        skala === 1
                                            ? 'bg-sky-600 text-white shadow-2xs'
                                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-600'
                                    }`}
                                >
                                    {skala === 1 ? 'Normal' : `${Math.round(skala * 100)}%`}
                                </button>
                                <button
                                    type="button"
                                    onClick={perbesar}
                                    disabled={skala >= 1.4}
                                    title="Besarkan huruf (Zoom In)"
                                    aria-label="Besarkan ukuran huruf"
                                    className="inline-flex h-6 w-7 items-center justify-center rounded text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 transition dark:text-slate-200 dark:hover:bg-slate-600"
                                >
                                    A+
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-4" style={{ fontSize: `${skala * 100}%` }}>
                    <RenderKonten doc={soal.pertanyaan} />
                    <IsianJawaban soal={soal} jawaban={jawaban} ubah={ubah} kunci={kunci} nonaktif={nonaktif} />
                </div>
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
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 px-3.5 py-3 transition-all duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-400 ${
                                    aktif
                                        ? 'border-sky-600 bg-sky-50/70 shadow-2xs dark:border-sky-500 dark:bg-sky-950/40'
                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600'
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
                                    className={`grid size-7 sm:size-8 shrink-0 place-items-center text-xs sm:text-sm font-bold transition-colors ${
                                        kompleks ? 'rounded-md' : 'rounded-full'
                                    } ${aktif ? 'bg-sky-600 text-white shadow-2xs dark:bg-sky-500' : 'border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}
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
