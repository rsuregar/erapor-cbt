import { buatPelapor, perkirakanSumber, type KirimInfo } from '@/lib/laporProteksi'
import { adaNative, aturProteksiKontenNative, isShortcutPengawas } from '@/lib/native'
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
    const pelaporRef = useRef<ReturnType<typeof buatPelapor> | null>(null)
    const terakhirUndoRef = useRef(0)

    const baruSajaUndo = useCallback(() => performance.now() - terakhirUndoRef.current < 300, [])

    const kabari = useCallback((teks: string) => {
        setPesan(teks)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setPesan(null), 3000)
    }, [])

    const laporTempelDiblokir = useCallback(
        (alasan?: 'salin_soal' | 'tempel_massal') => {
            kabari(
                alasan === 'salin_soal'
                    ? 'Tidak boleh menyalin pertanyaan ke kolom jawaban. Ketik jawabanmu sendiri.'
                    : 'Menempel teks dinonaktifkan selama ujian. Ketik jawabanmu sendiri.',
            )
            pelaporRef.current?.lapor('salin_diblokir', {
                aksi: 'paste',
                sumber: 'tidak_diketahui',
                diblokir: true,
                soal: opsiRef.current.soalAktif?.(),
            })
        },
        [kabari],
    )

    useEffect(() => {
        if (!aktif) return
        document.body.classList.add('ujian-berjalan')
        void aturProteksiKontenNative(true)

        const bersihkanClipboardWeb = () => {
            void navigator.clipboard?.writeText?.('').catch(() => undefined)
        }
        bersihkanClipboardWeb()

        const pelapor = buatPelapor((jenis, meta) => opsiRef.current.lapor?.(jenis, meta))
        pelaporRef.current = pelapor
        let terakhirPapanKetik: number | null = null
        const soal = () => opsiRef.current.soalAktif?.()

        const blokir = (teks: string, catat: (e: Event) => void) => (e: Event) => {
            e.preventDefault()
            e.stopImmediatePropagation?.()
            kabari(teks)
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

        const sebelumInput = (e: Event) => {
            const ie = e as InputEvent
            if (ie.inputType === 'historyUndo' || ie.inputType === 'historyRedo') {
                terakhirUndoRef.current = performance.now()
                return
            }
            if (adalahInputTypeTempel(ie.inputType)) {
                e.preventDefault()
                e.stopImmediatePropagation?.()
                kabari('Menempel teks dinonaktifkan selama ujian. Ketik jawabanmu sendiri.')
                pelapor.lapor('salin_diblokir', {
                    aksi: ie.inputType === 'deleteByCut' ? 'cut' : 'paste',
                    sumber: perkirakanSumber(performance.now(), terakhirPapanKetik),
                    diblokir: true,
                    soal: soal(),
                })
                return
            }
            if (ie.inputType === 'insertText' && typeof ie.data === 'string' && ie.data.length >= 12) {
                const cek = terdeteksiTempel({
                    sebelum: '',
                    sesudah: ie.data,
                    teksSoal: opsiRef.current.teksSoalAktif?.(),
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
                kabari('Menyalin dan menempel dinonaktifkan selama ujian.')
                pelapor.lapor('salin_diblokir', {
                    aksi: aksiCopas,
                    sumber: 'papan_ketik',
                    diblokir: true,
                    soal: soal(),
                })
                return
            }
            const k = e.key.toLowerCase()
            if ((e.ctrlKey || e.metaKey) && k === 'a' && !adalahTargetIsian(e.target)) {
                e.preventDefault()
                return
            }
            // Blokir alat pengembang (F12, Ctrl/Cmd+Shift+I/J/C) tanpa mengganggu pintasan pengawas (Ctrl+Shift+Q/X).
            if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k))) {
                e.preventDefault()
                kabari('Alat pengembang dinonaktifkan selama ujian.')

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
                kabari('Tidak perlu memuat ulang — jawabanmu tersimpan otomatis, walau internet lambat.')

                return
            }
            // Cetak, simpan halaman, lihat sumber.
            if ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 's' || k === 'u')) {
                e.preventDefault()
                kabari('Mencetak dan menyimpan halaman dinonaktifkan selama ujian.')
            }
        }
        const cetak = () => kabari('Soal ujian tidak boleh dicetak.')
        const saatFokus = () => bersihkanClipboardWeb()
        const saatTerlihat = () => {
            if (document.visibilityState === 'visible') bersihkanClipboardWeb()
        }

        const peristiwa: [string, EventListener][] = [
            ['copy', salin],
            ['cut', salin],
            ['paste', salin],
            ['beforeinput', sebelumInput],
            ['selectstart', mulaiSeleksi],
            ['contextmenu', menu],
            ['dragstart', seret],
            ['dragover', seret],
            ['drop', seret],
        ]
        peristiwa.forEach(([n, f]) => document.addEventListener(n, f, true))
        document.addEventListener('selectionchange', ubahSeleksi)
        document.addEventListener('keydown', tombol, true)
        window.addEventListener('beforeprint', cetak)
        window.addEventListener('focus', saatFokus)
        document.addEventListener('visibilitychange', saatTerlihat)
        // Android: tombol Kembali tidak boleh menutup layar ujian (selama ada pendengar, Capacitor tidak menutup app).
        const kembali = adaNative() ? App.addListener('backButton', () => kabari('Tombol kembali dinonaktifkan selama ujian.')) : null

        return () => {
            document.body.classList.remove('ujian-berjalan')
            void aturProteksiKontenNative(false)
            peristiwa.forEach(([n, f]) => document.removeEventListener(n, f, true))
            document.removeEventListener('selectionchange', ubahSeleksi)
            document.removeEventListener('keydown', tombol, true)
            window.removeEventListener('beforeprint', cetak)
            window.removeEventListener('focus', saatFokus)
            document.removeEventListener('visibilitychange', saatTerlihat)
            void kembali?.then((h) => h.remove())
            clearTimeout(timer.current)
            // Yang masih tertahan di jendela penggabungan ikut dikirim.
            pelapor.siram()
            pelaporRef.current = null
        }
    }, [aktif, kabari, laporTempelDiblokir])

    return { pesan, laporTempelDiblokir, baruSajaUndo }
}
