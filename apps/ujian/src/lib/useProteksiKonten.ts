import { buatPelapor, perkirakanSumber, type KirimInfo } from '@/lib/laporProteksi'
import { adaNative, aturProteksiKontenNative, bersihkanClipboardNative, isShortcutPengawas, isTauri } from '@/lib/native'
import {
    adalahInputTypeTempel,
    adalahNodeDiDalamIsian,
    adalahPintasanCopas,
    adalahTargetIsian,
    ekstrakTeksInputEvent,
    terdeteksiTempel,
} from '@/lib/proteksiSalin'
import { App } from '@capacitor/app'
import { useCallback, useEffect, useRef, useState } from 'react'

type ElemenIsian = {
    value: string
    tagName?: string
    selectionStart?: number | null
    selectionEnd?: number | null
    setSelectionRange?: (a: number, b: number) => void
}

function ambilElemenIsian(target: EventTarget | null): ElemenIsian | null {
    if (!adalahTargetIsian(target)) return null
    const el = ((target as Element).closest?.('textarea, input') ?? target) as Partial<ElemenIsian> | null
    if (!el || typeof el.value !== 'string') return null
    return el as ElemenIsian
}

function pulihkanNilaiIsian(el: ElemenIsian, nilai: string, awal: number | null, akhir: number | null): void {
    const proto =
        el.tagName === 'TEXTAREA'
            ? (globalThis as { HTMLTextAreaElement?: { prototype: object } }).HTMLTextAreaElement?.prototype
            : (globalThis as { HTMLInputElement?: { prototype: object } }).HTMLInputElement?.prototype
    const desc = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : undefined
    if (desc?.set) desc.set.call(el, nilai)
    else el.value = nilai
    try {
        if (awal !== null && akhir !== null) el.setSelectionRange?.(awal, akhir)
    } catch {}
}

/**
 * Proteksi konten di layar ujian (story 7.5, PRD level Dasar): salin, potong,
 * tempel, klik kanan, seret, cetak, seleksi teks soal, serta tempel dari clipboard
 * keyboard (Gboard/Samsung/iOS) diblokir berlapis.
 *
 * Percobaan yang diblokir TIDAK dicatat sebagai `salin_tempel`: dilaporkan sebagai
 * `salin_diblokir` dan `klik_kanan` (informasi untuk pengawas).
 */
export type ProteksiKontenPasangOpsi = {
    lapor?: KirimInfo
    soalAktif?: () => number | undefined
    teksSoalAktif?: () => string | undefined
    kabari: (teks: string) => void
    onCatatUndo?: () => void
    onKomposisiMulai?: () => void
    onKomposisiSelesai?: () => void
    bersihkanClipboard?: () => Promise<void> | void
    pakaiTauri?: boolean
    pakaiNative?: boolean
}

/** Pasang semua listener proteksi konten (copy/cut/paste/beforeinput/IME/keydown/focus) dan kembalikan cleanup. */
export function pasangProteksiKonten(opsi: ProteksiKontenPasangOpsi): {
    laporTempelDiblokir: (alasan?: 'salin_soal' | 'tempel_massal') => void
    lepas: () => void
} {
    document.body?.classList?.add('ujian-berjalan')
    void aturProteksiKontenNative(true)

    const pelapor = buatPelapor((jenis, meta) => opsi.lapor?.(jenis, meta))
    let terakhirPapanKetik: number | null = null
    let terakhirLaporTempel = -Infinity
    const nilaiTerakhir = new WeakMap<object, string>()
    let snapshotTempel: {
        target: ElemenIsian
        nilai: string
        awal: number | null
        akhir: number | null
        pada: number
        sudahDilaporkan: boolean
    } | null = null
    const soal = () => opsi.soalAktif?.()

    const simpanSnapshot = (target: EventTarget | null, sudahDilaporkan: boolean) => {
        const el = ambilElemenIsian(target)
        if (!el) return
        snapshotTempel = {
            target: el,
            nilai: el.value,
            awal: el.selectionStart ?? el.value.length,
            akhir: el.selectionEnd ?? el.value.length,
            pada: performance.now(),
            sudahDilaporkan,
        }
    }

    const laporTempelDiblokir = (alasan?: 'salin_soal' | 'tempel_massal') => {
        terakhirLaporTempel = performance.now()
        opsi.kabari(
            alasan === 'salin_soal'
                ? 'Tidak boleh menyalin pertanyaan ke kolom jawaban. Ketik jawabanmu sendiri.'
                : 'Menempel teks dinonaktifkan selama ujian. Ketik jawabanmu sendiri.',
        )
        pelapor.lapor('salin_diblokir', {
            aksi: 'paste',
            sumber: 'tidak_diketahui',
            diblokir: true,
            soal: soal(),
        })
    }

    const blokir = (teks: string, catat: (e: Event) => void) => (e: Event) => {
        e.preventDefault()
        e.stopImmediatePropagation?.()
        opsi.kabari(teks)
        catat(e)
    }
    const salin = (e: Event) => {
        if (e.type === 'paste') {
            simpanSnapshot(e.target, true)
            terakhirLaporTempel = performance.now()
        }
        e.preventDefault()
        e.stopImmediatePropagation?.()
        opsi.kabari('Menyalin dan menempel dinonaktifkan selama ujian.')
        if (e.type !== 'copy' && e.type !== 'cut' && e.type !== 'paste') return
        if (e.type === 'copy' || e.type === 'cut') {
            try {
                const cb = (e as ClipboardEvent).clipboardData
                cb?.setData('text/plain', '')
                cb?.setData('text/html', '')
            } catch {}
            const el = ambilElemenIsian(e.target)
            if (!el) {
                window.getSelection()?.removeAllRanges()
            } else {
                try {
                    const pos = el.selectionEnd ?? 0
                    el.setSelectionRange?.(pos, pos)
                } catch {}
            }
        }
        pelapor.lapor('salin_diblokir', {
            aksi: e.type,
            sumber: perkirakanSumber(performance.now(), terakhirPapanKetik),
            diblokir: true,
            soal: soal(),
        })
    }
    const menu = blokir('Klik kanan dinonaktifkan selama ujian.', () => pelapor.lapor('klik_kanan', { soal: soal() }))
    const seret = (e: Event) => e.preventDefault()
    const komposisiMulai = () => opsi.onKomposisiMulai?.()
    const komposisiSelesai = () => opsi.onKomposisiSelesai?.()

    const sebelumInput = (e: Event) => {
        const ie = e as InputEvent
        if (ie.inputType === 'historyUndo' || ie.inputType === 'historyRedo') {
            opsi.onCatatUndo?.()
            return
        }
        if (adalahInputTypeTempel(ie.inputType)) {
            simpanSnapshot(e.target, true)
            terakhirLaporTempel = performance.now()
            e.preventDefault()
            e.stopImmediatePropagation?.()
            opsi.kabari('Menempel teks dinonaktifkan selama ujian. Ketik jawabanmu sendiri.')
            pelapor.lapor('salin_diblokir', {
                aksi: ie.inputType === 'deleteByCut' ? 'cut' : 'paste',
                sumber: perkirakanSumber(performance.now(), terakhirPapanKetik),
                diblokir: true,
                soal: soal(),
            })
            return
        }
        if ((ie.inputType === 'insertText' || ie.inputType === 'insertReplacementText') && !ie.isComposing) {
            const teks = ekstrakTeksInputEvent(ie)
            if (teks.length >= 8) {
                const cek = terdeteksiTempel({
                    sebelum: '',
                    sesudah: teks,
                    teksSoal: opsi.teksSoalAktif?.(),
                })
                if (cek.diblokir) {
                    simpanSnapshot(e.target, true)
                    e.preventDefault()
                    e.stopImmediatePropagation?.()
                    laporTempelDiblokir(cek.alasan)
                }
            }
        }
    }

    const saatFokusIsian = (e: Event) => {
        const el = ambilElemenIsian(e.target)
        if (el) nilaiTerakhir.set(el, el.value)
    }

    const saatInput = (e: Event) => {
        const el = ambilElemenIsian(e.target)
        if (!el) return
        const ie = e as InputEvent
        if (ie.inputType === 'historyUndo' || ie.inputType === 'historyRedo' || ie.isComposing) {
            snapshotTempel = null
            nilaiTerakhir.set(el, el.value)
            return
        }
        const sebelum = nilaiTerakhir.get(el) ?? ''
        const snapCocok = snapshotTempel && snapshotTempel.target === el && performance.now() - snapshotTempel.pada <= 200
        const ketikSatuHuruf =
            (ie.inputType === 'insertText' || ie.inputType === 'insertCompositionText') &&
            typeof ie.data === 'string' &&
            ie.data.length <= 1
        const tempelDariInputType = adalahInputTypeTempel(ie.inputType)
        const cekTempelLangsung =
            !tempelDariInputType &&
            !ketikSatuHuruf &&
            (ie.inputType === 'insertReplacementText' || ie.inputType === 'insertText' || !ie.inputType)
                ? terdeteksiTempel({
                      sebelum: snapCocok ? snapshotTempel!.nilai : sebelum,
                      sesudah: el.value,
                      teksSoal: opsi.teksSoalAktif?.(),
                  })
                : { diblokir: false as const }

        if (tempelDariInputType || (snapCocok && !ketikSatuHuruf && el.value !== snapshotTempel!.nilai) || cekTempelLangsung.diblokir) {
            const nilaiPulih = snapCocok ? snapshotTempel!.nilai : sebelum
            const awal = snapCocok ? snapshotTempel!.awal : nilaiPulih.length
            const akhir = snapCocok ? snapshotTempel!.akhir : nilaiPulih.length
            const sudahDilaporkan = snapCocok ? snapshotTempel!.sudahDilaporkan : false
            snapshotTempel = null
            e.stopImmediatePropagation?.()
            pulihkanNilaiIsian(el, nilaiPulih, awal, akhir)
            nilaiTerakhir.set(el, nilaiPulih)
            if (!sudahDilaporkan && performance.now() - terakhirLaporTempel > 200) {
                laporTempelDiblokir(cekTempelLangsung.diblokir ? cekTempelLangsung.alasan : undefined)
            }
            return
        }

        if (ketikSatuHuruf) snapshotTempel = null
        nilaiTerakhir.set(el, el.value)
    }

    const mulaiSeleksi = (e: Event) => {
        if (!adalahTargetIsian(e.target)) {
            e.preventDefault()
        }
    }
    const ubahSeleksi = () => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) return
        if (adalahNodeDiDalamIsian(sel.anchorNode) && adalahNodeDiDalamIsian(sel.focusNode)) return
        sel.removeAllRanges()
    }

    const tombol = (e: KeyboardEvent) => {
        if (isShortcutPengawas(e)) return
        const aksiCopas = adalahPintasanCopas(e)
        if (aksiCopas) {
            terakhirPapanKetik = performance.now()
            e.preventDefault()
            e.stopImmediatePropagation?.()
            opsi.kabari('Menyalin dan menempel dinonaktifkan selama ujian.')
            pelapor.lapor('salin_diblokir', {
                aksi: aksiCopas,
                sumber: 'papan_ketik',
                diblokir: true,
                soal: soal(),
            })
            return
        }
        const k = e.key.toLowerCase()
        if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) {
            opsi.onCatatUndo?.()
            return
        }
        if ((e.ctrlKey || e.metaKey) && k === 'a' && !adalahTargetIsian(e.target)) {
            e.preventDefault()
            return
        }
        // Blokir alat pengembang (F12, Ctrl/Cmd+Shift+I/J/C) tanpa mengganggu pintasan pengawas (Ctrl+Shift+Q/X).
        if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k))) {
            e.preventDefault()
            opsi.kabari('Alat pengembang dinonaktifkan selama ujian.')

            return
        }
        // Blokir navigasi Back/Forward bawaan WebView2 Windows (Alt + Panah Kiri/Kanan).
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault()

            return
        }
        // Muat ulang tak pernah perlu: jawaban ada di perangkat. Internet lambat sering memancingnya.
        if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && k === 'r')) {
            e.preventDefault()
            opsi.kabari('Tidak perlu memuat ulang — jawabanmu tersimpan otomatis, walau internet lambat.')

            return
        }
        // Cetak, simpan halaman, lihat sumber.
        if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 's' || k === 'u')) {
            e.preventDefault()
            opsi.kabari('Mencetak dan menyimpan halaman dinonaktifkan selama ujian.')
        }
    }
    const cetak = () => opsi.kabari('Soal ujian tidak boleh dicetak.')
    const pakaiTauri = opsi.pakaiTauri ?? isTauri()
    const pakaiNative = opsi.pakaiNative ?? adaNative()
    const bersihkan = opsi.bersihkanClipboard ?? bersihkanClipboardNative
    const saatFokus = () => {
        void bersihkan()
    }
    const saatTerlihat = () => {
        if (document.visibilityState === 'visible') void bersihkan()
    }

    const peristiwa: [string, EventListener][] = [
        ['copy', salin],
        ['cut', salin],
        ['paste', salin],
        ['beforeinput', sebelumInput],
        ['input', saatInput],
        ['focusin', saatFokusIsian],
        ['compositionstart', komposisiMulai],
        ['compositionend', komposisiSelesai],
        ['selectstart', mulaiSeleksi],
        ['contextmenu', menu],
        ['dragstart', seret],
        ['dragover', seret],
        ['drop', seret],
    ]
    peristiwa.forEach(([n, f]) => document.addEventListener(n, f, true))
    document.addEventListener('selectionchange', ubahSeleksi)
    document.addEventListener('keydown', tombol as EventListener, true)
    window.addEventListener('beforeprint', cetak)
    if (pakaiTauri) {
        window.addEventListener('focus', saatFokus)
        document.addEventListener('visibilitychange', saatTerlihat)
    }
    // Android: tombol Kembali tidak boleh menutup layar ujian (selama ada pendengar, Capacitor tidak menutup app).
    const kembali = pakaiNative ? App.addListener('backButton', () => opsi.kabari('Tombol kembali dinonaktifkan selama ujian.')) : null

    return {
        laporTempelDiblokir,
        lepas: () => {
            document.body?.classList?.remove('ujian-berjalan')
            void aturProteksiKontenNative(false)
            peristiwa.forEach(([n, f]) => document.removeEventListener(n, f, true))
            document.removeEventListener('selectionchange', ubahSeleksi)
            document.removeEventListener('keydown', tombol as EventListener, true)
            window.removeEventListener('beforeprint', cetak)
            if (pakaiTauri) {
                window.removeEventListener('focus', saatFokus)
                document.removeEventListener('visibilitychange', saatTerlihat)
            }
            void kembali?.then((h) => h.remove())
            // Yang masih tertahan di jendela penggabungan ikut dikirim.
            pelapor.siram()
        },
    }
}

export function useProteksiKonten(
    aktif: boolean,
    opsi: {
        /** Melapor ke server (usePelanggaran.laporInfo). Tanpa ini, hanya memblokir. */
        lapor?: KirimInfo
        /** Nomor soal yang sedang dibuka murid, sebagai konteks untuk pengawas. */
        soalAktif?: () => number | undefined
        /** Teks soal & bacaan aktif untuk mendeteksi copas pertanyaan ke kolom jawaban. */
        teksSoalAktif?: () => string
    } = {},
) {
    const [pesanState, setPesanState] = useState<{ teks: string; kunci: number } | null>(null)
    const kunciPesanRef = useRef(0)
    const timer = useRef<ReturnType<typeof setTimeout>>()
    const opsiRef = useRef(opsi)
    opsiRef.current = opsi
    const laporTempelRef = useRef<((alasan?: 'salin_soal' | 'tempel_massal') => void) | null>(null)
    const terakhirUndoRef = useRef(-Infinity)
    const sedangKomposisiRef = useRef(false)
    const terakhirKomposisiRef = useRef(-Infinity)

    const baruSajaUndo = useCallback(() => performance.now() - terakhirUndoRef.current < 800, [])
    const sedangAmanInput = useCallback(
        () => baruSajaUndo() || sedangKomposisiRef.current || performance.now() - terakhirKomposisiRef.current < 800,
        [baruSajaUndo],
    )

    const kabari = useCallback((teks: string) => {
        kunciPesanRef.current += 1
        setPesanState({ teks, kunci: kunciPesanRef.current })
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setPesanState(null), 3000)
    }, [])

    const laporTempelDiblokir = useCallback((alasan?: 'salin_soal' | 'tempel_massal') => {
        laporTempelRef.current?.(alasan)
    }, [])

    useEffect(() => {
        if (!aktif) return
        const kontrol = pasangProteksiKonten({
            lapor: (jenis, meta) => opsiRef.current.lapor?.(jenis, meta),
            soalAktif: () => opsiRef.current.soalAktif?.(),
            teksSoalAktif: () => opsiRef.current.teksSoalAktif?.(),
            kabari,
            onCatatUndo: () => {
                terakhirUndoRef.current = performance.now()
            },
            onKomposisiMulai: () => {
                sedangKomposisiRef.current = true
            },
            onKomposisiSelesai: () => {
                sedangKomposisiRef.current = false
                terakhirKomposisiRef.current = performance.now()
            },
        })
        laporTempelRef.current = kontrol.laporTempelDiblokir

        return () => {
            clearTimeout(timer.current)
            laporTempelRef.current = null
            kontrol.lepas()
        }
    }, [aktif, kabari])

    return { pesan: pesanState?.teks ?? null, laporTempelDiblokir, baruSajaUndo, sedangAmanInput }
}
