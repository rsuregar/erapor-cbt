import { buatPelapor, perkirakanSumber, type KirimInfo } from '@/lib/laporProteksi'
import { adaNative, aturProteksiKontenNative, bersihkanClipboardNative, isShortcutPengawas, isTauri } from '@/lib/native'
import { adalahInputTypeTempel, adalahPintasanCopas, adalahTargetIsian, terdeteksiTempel } from '@/lib/proteksiSalin'
import { App } from '@capacitor/app'
import { useCallback, useEffect, useRef, useState } from 'react'

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
    const soal = () => opsi.soalAktif?.()

    const laporTempelDiblokir = (alasan?: 'salin_soal' | 'tempel_massal') => {
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
    const salin = blokir('Menyalin dan menempel dinonaktifkan selama ujian.', (e) => {
        if (e.type !== 'copy' && e.type !== 'cut' && e.type !== 'paste') return
        if (e.type === 'copy' || e.type === 'cut') {
            try {
                ;(e as ClipboardEvent).clipboardData?.setData('text/plain', '')
            } catch {}
            if (!adalahTargetIsian(e.target)) {
                window.getSelection()?.removeAllRanges()
            }
        }
        pelapor.lapor('salin_diblokir', {
            aksi: e.type,
            sumber: perkirakanSumber(performance.now(), terakhirPapanKetik),
            diblokir: true,
            soal: soal(),
        })
    })
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
        if (ie.inputType === 'insertText' && !ie.isComposing && typeof ie.data === 'string' && ie.data.length >= 12) {
            const cek = terdeteksiTempel({
                sebelum: '',
                sesudah: ie.data,
                teksSoal: opsi.teksSoalAktif?.(),
            })
            if (cek.diblokir) {
                e.preventDefault()
                e.stopImmediatePropagation?.()
                laporTempelDiblokir(cek.alasan)
            }
        }
    }

    const mulaiSeleksi = (e: Event) => {
        if (!adalahTargetIsian(e.target)) {
            e.preventDefault()
        }
    }
    const ubahSeleksi = () => {
        if (adalahTargetIsian(document.activeElement)) return
        const sel = window.getSelection()
        if (sel && !sel.isCollapsed) sel.removeAllRanges()
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
    const [pesan, setPesan] = useState<string | null>(null)
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
        setPesan(teks)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setPesan(null), 3000)
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

    return { pesan, laporTempelDiblokir, baruSajaUndo, sedangAmanInput }
}
