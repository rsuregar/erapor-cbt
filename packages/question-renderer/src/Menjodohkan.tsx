import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as PointerReact, type ReactNode } from 'react'
import RenderKonten from './RenderKonten'
import type { OpsiMenjodohkan } from './types'

/**
 * Soal menjodohkan dengan garis penghubung.
 *
 * - Semua perangkat: KETUK pernyataan (kiri) lalu pasangannya (kanan) — atau
 *   sebaliknya. Di layar sentuh menarik garis bertabrakan dengan menggulir,
 *   jadi ketuk adalah cara utama; kartunya tombol, jadi keyboard (Tab + Enter)
 *   ikut berfungsi.
 * - Laptop (mouse): bisa juga MENARIK garis dari kartu kiri ke kartu kanan.
 * - Tiap nomor punya warna; garis, titik, dan lencana di kartu kanan memakai
 *   warna yang sama, sehingga pasangan tetap terbaca walau garis bersilangan.
 *
 * Format jawaban tetap `{ [kiriId]: kananId }` (satu pasangan kanan boleh
 * dipakai lebih dari sekali, sama seperti dropdown sebelumnya).
 */

const WARNA = ['#006195', '#EC2A6B', '#218A62', '#CE352C', '#7A4FB5', '#8A6410', '#0F7C8C', '#1E2A32']
const HURUF = (i: number) => {
    const abjad = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    return i < 26 ? abjad[i] : abjad[Math.floor(i / 26) - 1] + abjad[i % 26]
}

type Pilihan = { sisi: 'kiri' | 'kanan'; id: string } | null
type Garis = { d: string; warna: string; kunci?: boolean; x2: number; y2: number }

export default function Menjodohkan({
    opsi,
    isi,
    ubah,
    kunci,
    nonaktif,
}: {
    opsi: OpsiMenjodohkan
    isi: Record<string, string>
    ubah: (j: Record<string, string>) => void
    kunci?: Record<string, string>
    nonaktif?: boolean
}) {
    const wadah = useRef<HTMLDivElement>(null)
    const elKiri = useRef(new Map<string, HTMLElement>())
    const elKanan = useRef(new Map<string, HTMLElement>())
    const [pilih, setPilih] = useState<Pilihan>(null)
    const [garis, setGaris] = useState<Garis[]>([])
    const [tarik, setTarik] = useState<{ dari: string; x: number; y: number } | null>(null)

    const warna = (kiriId: string) => WARNA[Math.max(0, opsi.kiri.findIndex((k) => k.id === kiriId)) % WARNA.length]
    const terpasang = (kiriId: string) => (isi[kiriId] ? opsi.kanan.find((k) => k.id === isi[kiriId]) : undefined)

    const pasang = (kiriId: string, kananId: string) => {
        if (nonaktif) return
        ubah({ ...isi, [kiriId]: kananId })
        setPilih(null)
    }
    const lepas = (kiriId: string) => {
        if (nonaktif) return
        const sisa = { ...isi }
        delete sisa[kiriId]
        ubah(sisa)
    }

    const klikKiri = (id: string) => {
        if (nonaktif) return
        if (pilih?.sisi === 'kanan') pasang(id, pilih.id)
        else setPilih(pilih?.sisi === 'kiri' && pilih.id === id ? null : { sisi: 'kiri', id })
    }
    const klikKanan = (id: string) => {
        if (nonaktif) return
        if (pilih?.sisi === 'kiri') pasang(pilih.id, id)
        else setPilih(pilih?.sisi === 'kanan' && pilih.id === id ? null : { sisi: 'kanan', id })
    }

    // Garis dari tepi kanan kartu kiri ke tepi kiri kartu kanan (lengkung).
    const hitung = useCallback(() => {
        const w = wadah.current
        if (!w) return
        const b = w.getBoundingClientRect()
        const titik = (el: HTMLElement, tepi: 'kanan' | 'kiri') => {
            const r = el.getBoundingClientRect()
            return { x: (tepi === 'kanan' ? r.right : r.left) - b.left, y: r.top + r.height / 2 - b.top }
        }
        const lengkung = (a: { x: number; y: number }, c: { x: number; y: number }) => {
            const dx = Math.max(16, (c.x - a.x) / 2)
            return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${c.x - dx} ${c.y}, ${c.x} ${c.y}`
        }
        const daftar: Garis[] = []
        const tambah = (peta: Record<string, string>, isKunci: boolean) => {
            for (const [k, v] of Object.entries(peta)) {
                const a = elKiri.current.get(k)
                const c = elKanan.current.get(v)
                if (!a || !c) continue
                const p1 = titik(a, 'kanan')
                const p2 = titik(c, 'kiri')
                daftar.push({ d: lengkung(p1, p2), warna: isKunci ? '#2FA97B' : warna(k), kunci: isKunci, x2: p2.x, y2: p2.y })
            }
        }
        if (kunci) tambah(kunci, true)
        tambah(isi, false)
        setGaris(daftar)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isi, kunci, opsi])

    useLayoutEffect(() => hitung(), [hitung])
    useEffect(() => {
        // Ukuran teks (A+/Aa), lebar layar, gambar yang baru termuat → posisi kartu berubah.
        // Kartu dipantau satu per satu: satu kartu bisa membesar tanpa mengubah tinggi wadah.
        const ro = new ResizeObserver(() => hitung())
        if (wadah.current) ro.observe(wadah.current)
        for (const el of [...elKiri.current.values(), ...elKanan.current.values()]) ro.observe(el)
        window.addEventListener('resize', hitung)

        return () => {
            ro.disconnect()
            window.removeEventListener('resize', hitung)
        }
    }, [hitung])

    // Tarik garis dengan mouse (sentuh memakai ketuk, lihat catatan di atas).
    const mulaiTarik = (e: PointerReact, kiriId: string) => {
        if (nonaktif || e.pointerType !== 'mouse' || e.button !== 0) return
        const w = wadah.current
        if (!w) return
        const awal = { x: e.clientX, y: e.clientY }
        let bergerak = false
        const posisi = (ev: PointerEvent) => {
            const b = w.getBoundingClientRect()
            return { x: ev.clientX - b.left, y: ev.clientY - b.top }
        }
        const gerak = (ev: PointerEvent) => {
            if (!bergerak && Math.hypot(ev.clientX - awal.x, ev.clientY - awal.y) < 6) return
            bergerak = true
            setTarik({ dari: kiriId, ...posisi(ev) })
        }
        const lepasMouse = (ev: PointerEvent) => {
            window.removeEventListener('pointermove', gerak)
            window.removeEventListener('pointerup', lepasMouse)
            setTarik(null)
            if (!bergerak) return // klik biasa → ditangani onClick
            const sasaran = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-kanan-id]')
            if (sasaran?.dataset.kananId) pasang(kiriId, sasaran.dataset.kananId)
            // Cegah onClick setelah tarik memilih kartu kiri.
            const cegah = (ce: MouseEvent) => {
                ce.stopPropagation()
                ce.preventDefault()
            }
            window.addEventListener('click', cegah, { capture: true, once: true })
            setTimeout(() => window.removeEventListener('click', cegah, { capture: true }), 0)
        }
        window.addEventListener('pointermove', gerak)
        window.addEventListener('pointerup', lepasMouse)
    }

    const garisTarik = (() => {
        if (!tarik) return null
        const a = elKiri.current.get(tarik.dari)
        const w = wadah.current
        if (!a || !w) return null
        const b = w.getBoundingClientRect()
        const r = a.getBoundingClientRect()
        const x1 = r.right - b.left
        const y1 = r.top + r.height / 2 - b.top
        const dx = Math.max(16, (tarik.x - x1) / 2)
        return { d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${tarik.x - dx} ${tarik.y}, ${tarik.x} ${tarik.y}`, warna: warna(tarik.dari) }
    })()

    const petunjukPilih =
        pilih?.sisi === 'kiri'
            ? `Nomor ${opsi.kiri.findIndex((k) => k.id === pilih.id) + 1} dipilih — sekarang ketuk pasangannya di kolom kanan.`
            : pilih?.sisi === 'kanan'
              ? `Pasangan ${HURUF(opsi.kanan.findIndex((k) => k.id === pilih.id))} dipilih — sekarang ketuk nomornya di kolom kiri.`
              : ''

    return (
        <div className="space-y-2">
            <div ref={wadah} className="relative grid grid-cols-2 gap-x-8 sm:gap-x-14">
                <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" aria-hidden>
                    {garis.map((g, i) => (
                        <g key={i}>
                            <path d={g.d} fill="none" stroke={g.warna} strokeWidth={g.kunci ? 2 : 3} strokeLinecap="round" strokeDasharray={g.kunci ? '6 5' : undefined} opacity={g.kunci ? 0.9 : 1} />
                            {!g.kunci && <circle cx={g.x2} cy={g.y2} r={5} fill={g.warna} />}
                        </g>
                    ))}
                    {garisTarik && <path d={garisTarik.d} fill="none" stroke={garisTarik.warna} strokeWidth={3} strokeLinecap="round" strokeDasharray="2 6" />}
                </svg>

                <Kolom judul="Pernyataan">
                    {opsi.kiri.map((kiri, i) => {
                        const pasangan = terpasang(kiri.id)
                        const w = warna(kiri.id)
                        const dipilih = pilih?.sisi === 'kiri' && pilih.id === kiri.id
                        return (
                            <div key={kiri.id} className="relative">
                                <button
                                    type="button"
                                    ref={(el) => {
                                        if (el) elKiri.current.set(kiri.id, el)
                                        else elKiri.current.delete(kiri.id)
                                    }}
                                    disabled={nonaktif}
                                    aria-pressed={dipilih}
                                    aria-label={`Nomor ${i + 1}${pasangan ? `, dipasangkan dengan ${HURUF(opsi.kanan.indexOf(pasangan))}` : ', belum dipasangkan'}`}
                                    onPointerDown={(e) => mulaiTarik(e, kiri.id)}
                                    onClick={() => klikKiri(kiri.id)}
                                    className={`relative flex min-h-12 w-full touch-manipulation select-none items-start gap-2 rounded-lg border-2 bg-white p-2.5 text-left transition sm:p-3 dark:bg-slate-900/40 ${
                                        dipilih ? 'ring-4 ring-offset-1' : ''
                                    } ${pasangan ? 'pr-10' : ''} ${nonaktif ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    style={{ borderColor: pasangan || dipilih ? w : undefined, ['--tw-ring-color' as string]: `${w}33` }}
                                >
                                    <Lencana warna={w} isi={String(i + 1)} />
                                    <RenderKonten doc={kiri.konten} className="min-w-0 flex-1 pt-0.5" />
                                    {/* Titik jangkar garis */}
                                    <span className="absolute -right-[7px] top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-white" style={{ background: pasangan || dipilih ? w : '#C6CED6' }} />
                                </button>
                                {pasangan && !nonaktif && (
                                    <button
                                        type="button"
                                        onClick={() => lepas(kiri.id)}
                                        aria-label={`Lepas pasangan nomor ${i + 1}`}
                                        className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700"
                                    >
                                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                                            <path d="M18 6 6 18M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </Kolom>

                <Kolom judul="Pasangan">
                    {opsi.kanan.map((kanan, j) => {
                        const dariKiri = opsi.kiri.filter((k) => isi[k.id] === kanan.id)
                        const dipilih = pilih?.sisi === 'kanan' && pilih.id === kanan.id
                        const benarKunci = kunci && Object.values(kunci).includes(kanan.id)
                        return (
                            <button
                                key={kanan.id}
                                type="button"
                                data-kanan-id={kanan.id}
                                ref={(el) => {
                                    if (el) elKanan.current.set(kanan.id, el)
                                    else elKanan.current.delete(kanan.id)
                                }}
                                disabled={nonaktif}
                                aria-pressed={dipilih}
                                aria-label={`Pasangan ${HURUF(j)}${dariKiri.length ? `, dipasangkan dengan nomor ${dariKiri.map((k) => opsi.kiri.indexOf(k) + 1).join(', ')}` : ''}`}
                                onClick={() => klikKanan(kanan.id)}
                                className={`relative flex min-h-12 w-full touch-manipulation select-none items-start gap-2 rounded-lg border-2 bg-white p-2.5 text-left transition sm:p-3 dark:bg-slate-900/40 ${
                                    dipilih ? 'border-ink ring-4 ring-slate-300 ring-offset-1' : dariKiri.length ? '' : 'border-slate-200 dark:border-slate-700'
                                } ${nonaktif ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'} ${benarKunci ? 'outline outline-2 outline-offset-2 outline-emerald-500' : ''}`}
                                style={{ borderColor: !dipilih && dariKiri.length ? warna(dariKiri[0].id) : undefined }}
                            >
                                <span className="absolute -left-[7px] top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-white" style={{ background: dariKiri.length ? warna(dariKiri[0].id) : '#C6CED6' }} />
                                <span className="grid size-7 shrink-0 place-items-center rounded-md border border-slate-300 bg-slate-100 text-xs font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                                    {HURUF(j)}
                                </span>
                                <RenderKonten doc={kanan.konten} className="min-w-0 flex-1 pt-0.5" />
                                {dariKiri.length > 0 && (
                                    <span className="flex shrink-0 flex-col gap-1">
                                        {dariKiri.map((k) => (
                                            <Lencana key={k.id} warna={warna(k.id)} isi={String(opsi.kiri.indexOf(k) + 1)} kecil />
                                        ))}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </Kolom>
            </div>
            <p aria-live="polite" className="min-h-5 text-sm font-medium text-sky-800 dark:text-sky-300">
                {petunjukPilih}
            </p>
        </div>
    )
}

function Kolom({ judul, children }: { judul: string; children: ReactNode }) {
    return (
        <div className="min-w-0 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{judul}</p>
            {children}
        </div>
    )
}

function Lencana({ warna, isi, kecil }: { warna: string; isi: string; kecil?: boolean }) {
    return (
        <span
            className={`grid shrink-0 place-items-center rounded-full font-bold tabular-nums text-white ${kecil ? 'size-5 text-[11px]' : 'size-7 text-xs'}`}
            style={{ background: warna }}
        >
            {isi}
        </span>
    )
}
