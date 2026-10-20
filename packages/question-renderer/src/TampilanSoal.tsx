import { useId, useState } from 'react'
import Menjodohkan from './Menjodohkan'
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
 * Petunjuk cara menjawab per jenis soal — satu baris di atas area jawaban, terutama
 * untuk jenis yang jarang ditemui murid (benar/salah, menjodohkan, uraian).
 */
const PETUNJUK: Partial<Record<SoalTampil['jenis'], string>> = {
    pilihan_ganda: 'Pilih satu jawaban yang paling tepat.',
    pg_stimulus: 'Baca bacaannya, lalu pilih satu jawaban yang paling tepat.',
    pg_kompleks: 'Boleh pilih lebih dari satu. Pilih semua jawaban yang benar.',
    benar_salah: 'Tentukan Benar atau Salah untuk setiap pernyataan.',
    menjodohkan: 'Ketuk nomor di kiri, lalu ketuk pasangannya di kanan. Di laptop, garis bisa juga ditarik dengan mouse.',
    isian: 'Tulis jawaban singkat, berupa kata atau angka.',
    uraian: 'Tulis jawabanmu dengan kalimat sendiri. Tersimpan otomatis saat kamu mengetik.',
    studi_kasus: 'Baca kasusnya, lalu tulis jawabanmu. Tersimpan otomatis saat kamu mengetik.',
}

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
    /**
     * App murid di HP: tombol ragu-ragu & ukuran teks dipindah ke kaki halaman
     * (zona jempol) oleh pemanggil — di bawah lebar sm keduanya disembunyikan di sini.
     */
    kontrolDiKaki?: boolean
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
    kontrolDiKaki = false,
}: Props) {
    const [skalaInternal, setSkalaInternal] = useState(1)
    const skala = skalaFont ?? skalaInternal
    const setSkala = onUbahSkalaFont ?? setSkalaInternal

    const ubah = (j: Jawaban) => !nonaktif && onJawab?.(j)
    const duaKolom = !!soal.stimulus && tata !== 'satu-kolom'

    const perbesar = () => setSkala(Math.min(1.4, Number((skala + 0.15).toFixed(2))))
    const perkecil = () => setSkala(Math.max(0.85, Number((skala - 0.15).toFixed(2))))
    const normal = () => setSkala(1)

    // Gulir: di bawah lg semuanya SATU aliran yang digulir pemanggil (bacaan di atas, soal
    // di bawah) — dua panel gulir bertumpuk di HP membuat murid menggulir panel yang salah.
    // Mulai lg (atau 'dua-kolom' dipaksa) bacaan & soal masing-masing punya panel gulir.
    // Jangan campur pl-0/pr-0 dengan px-*: di CSS Tailwind pl/pr ditulis setelah px.
    const kelasGrid = !duaKolom
        ? 'mx-auto max-w-3xl w-full pt-5 sm:pt-7 pb-10 px-4'
        : tata === 'dua-kolom'
          ? 'grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700 h-full min-h-full w-full'
          : 'grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-700 w-full lg:h-full'

    const kelasKiri = tata === 'dua-kolom'
        ? 'h-full overflow-y-auto px-4 pt-5 pb-6 sm:px-6 sm:pt-6 lg:pr-8 space-y-3.5 bg-slate-50/40'
        : 'px-4 pt-5 pb-6 sm:px-6 sm:pt-6 lg:h-full lg:overflow-y-auto lg:pr-8 space-y-3.5 bg-slate-50/40'

    const kelasKanan = duaKolom
        ? tata === 'dua-kolom'
            ? 'h-full overflow-y-auto px-4 pt-5 pb-10 sm:px-6 sm:pt-6 lg:pl-8 space-y-4 bg-white'
            : 'px-4 pt-5 pb-10 sm:px-6 sm:pt-6 lg:h-full lg:overflow-y-auto lg:pl-8 space-y-4 bg-white'
        : 'space-y-4'
    // Kontrol yang di HP pindah ke kaki halaman (app murid).
    const diKaki = kontrolDiKaki ? 'hidden sm:inline-flex' : 'inline-flex'

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
                        <span className="text-xs font-medium text-slate-500">Gunakan untuk menjawab soal</span>
                    </div>
                    <div className="leading-relaxed" style={{ fontSize: `${skala * 100}%` }}>
                        <RenderKonten doc={soal.stimulus.konten} />
                    </div>
                </section>
            )}

            <div className={kelasKanan}>
                {(nomor !== undefined || onRagu) && (
                    <div
                        className={`flex flex-wrap items-center justify-between gap-2.5 ${
                            kontrolDiKaki
                                ? 'border-b border-slate-200 pb-3 sm:rounded-lg sm:border sm:border-slate-200/90 sm:bg-slate-100/75 sm:p-2 sm:px-3 dark:border-slate-700 sm:dark:bg-slate-800'
                                : 'rounded-lg border border-slate-200/90 bg-slate-100/75 p-2 sm:px-3 sm:py-2 dark:border-slate-700 dark:bg-slate-800'
                        }`}
                    >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {nomor !== undefined && (
                                <span className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-sky-200 bg-white px-3 text-sm font-extrabold text-sky-800 tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                                    Soal {nomor}
                                </span>
                            )}
                            {section && (
                                <span className="inline-block min-w-0 max-w-[11rem] truncate rounded-md sm:max-w-xs border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300" title={section}>
                                    {section}
                                </span>
                            )}
                            {onRagu && (
                                <button
                                    type="button"
                                    aria-pressed={ragu}
                                    onClick={() => onRagu(!ragu)}
                                    className={`${diKaki} min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition active:scale-95 ${
                                        ragu
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-xs dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700'
                                            : 'bg-white/90 text-slate-700 border border-slate-300/80 hover:bg-white hover:border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                                    }`}
                                >
                                    <svg viewBox="0 0 24 24" className={`size-4 ${ragu ? 'fill-amber-500 text-amber-500' : 'text-slate-500'}`} fill={ragu ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
                                        <path d="M6 3h12v18l-6-4-6 4z" />
                                    </svg>
                                    <span>{ragu ? 'Ragu-ragu' : 'Tandai ragu-ragu'}</span>
                                </button>
                            )}
                        </div>

                        {/* Kontrol Ukuran Font / Zoom Teks */}
                        <div className={`${diKaki} items-center gap-1.5`}>
                            <span className="hidden sm:inline text-xs font-semibold text-slate-500">Ukuran teks</span>
                            <div className="inline-flex items-center rounded-lg bg-white border border-slate-300/80 p-0.5 dark:bg-slate-700 dark:border-slate-600">
                                <button
                                    type="button"
                                    onClick={perkecil}
                                    disabled={skala <= 0.85}
                                    title="Kecilkan huruf (Zoom Out)"
                                    aria-label="Kecilkan ukuran huruf"
                                    className="inline-flex h-9 w-10 items-center justify-center rounded-md text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 transition dark:text-slate-200 dark:hover:bg-slate-600"
                                >
                                    A-
                                </button>
                                <button
                                    type="button"
                                    onClick={normal}
                                    title="Kembalikan ukuran normal (100%)"
                                    aria-label="Kembalikan ukuran normal"
                                    className={`inline-flex h-9 min-w-16 px-2.5 items-center justify-center rounded-md text-xs transition font-bold tabular-nums ${
                                        skala === 1
                                            ? 'bg-sky-800 text-white'
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
                                    className="inline-flex h-9 w-10 items-center justify-center rounded-md text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 transition dark:text-slate-200 dark:hover:bg-slate-600"
                                >
                                    A+
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-4" style={{ fontSize: `${skala * 100}%` }}>
                    <RenderKonten doc={soal.pertanyaan} />
                    {PETUNJUK[soal.jenis] && (
                        <p className="flex items-start gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                            <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4M12 8h.01" />
                            </svg>
                            <span>{PETUNJUK[soal.jenis]}</span>
                        </p>
                    )}
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
                                    } ${aktif ? 'bg-sky-800 text-white shadow-2xs dark:bg-sky-500' : 'border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}
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
            // Satu baris per pernyataan dengan dua pil besar (≥44 px) — radio tabel 13 px
            // sulit diketuk di HP dan tidak konsisten dengan kartu pilihan ganda.
            const opsi = soal.opsi as OpsiBenarSalah | null
            const isi = (jawaban as Record<string, boolean>) ?? {}
            const k = (kunci as Record<string, boolean> | undefined) ?? {}
            if (!opsi) return null
            return (
                <ol className="space-y-2.5">
                    {opsi.pernyataan.map((p, i) => (
                        <li key={p.id} className="rounded-lg border-2 border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
                            <div className="flex gap-2">
                                <span className="font-semibold text-slate-500 tabular-nums">{i + 1}.</span>
                                <RenderKonten doc={p.konten} className="flex-1" />
                            </div>
                            <div role="radiogroup" aria-label={`Pernyataan ${i + 1}`} className="mt-2.5 grid grid-cols-2 gap-2">
                                {[true, false].map((nilai) => {
                                    const aktif = isi[p.id] === nilai
                                    const label = nilai ? opsi.label_benar : opsi.label_salah
                                    return (
                                        <label
                                            key={String(nilai)}
                                            className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-3 text-sm font-bold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-400 ${
                                                aktif
                                                    ? nilai
                                                        ? 'border-sky-800 bg-sky-800 text-white'
                                                        : 'border-slate-700 bg-slate-700 text-white dark:border-slate-300 dark:bg-slate-300 dark:text-slate-900'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                                            } ${k[p.id] === nilai ? 'outline outline-2 outline-offset-2 outline-emerald-500' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                className="sr-only"
                                                name={`${nama}-${p.id}`}
                                                checked={aktif}
                                                disabled={nonaktif}
                                                onChange={() => ubah({ ...isi, [p.id]: nilai })}
                                            />
                                            {label}
                                        </label>
                                    )
                                })}
                            </div>
                        </li>
                    ))}
                </ol>
            )
        }

        case 'menjodohkan': {
            const opsi = soal.opsi as OpsiMenjodohkan | null
            if (!opsi) return null
            return (
                <Menjodohkan
                    opsi={opsi}
                    isi={(jawaban as Record<string, string>) ?? {}}
                    ubah={ubah}
                    kunci={kunci as Record<string, string> | undefined}
                    nonaktif={nonaktif}
                />
            )
        }

        case 'isian': {
            const k = kunci as { jawaban?: string[] } | undefined
            return (
                <div className="space-y-1">
                    <input
                        type="text"
                        data-isian-jawaban
                        aria-label="Jawaban singkat"
                        className="h-12 w-full max-w-md rounded-lg border-2 border-slate-300 bg-white px-3.5 text-base outline-none transition focus:border-sky-600 focus:ring-4 focus:ring-sky-600/15 dark:border-slate-600 dark:bg-slate-900"
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
                        data-isian-jawaban
                        aria-label="Jawaban uraian"
                        className="w-full rounded-lg border-2 border-slate-300 bg-white p-3.5 text-base leading-relaxed outline-none transition focus:border-sky-600 focus:ring-4 focus:ring-sky-600/15 dark:border-slate-600 dark:bg-slate-900"
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
