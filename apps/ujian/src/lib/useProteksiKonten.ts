import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Proteksi konten di layar ujian (story 7.5, PRD level Dasar): salin, potong,
 * tempel, klik kanan, seret, dan cetak diblokir sebatas yang bisa dilakukan
 * browser. Tangkapan layar tidak bisa dicegah web — dimitigasi watermark.
 *
 * Sengaja TIDAK dicatat sebagai pelanggaran `salin_tempel`: setelah diblokir,
 * Ctrl+C yang tak sengaja tidak berbahaya, sedangkan server menghitungnya ke
 * ambang kunci.
 */
export function useProteksiKonten(aktif: boolean) {
    const [pesan, setPesan] = useState<string | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout>>()

    const kabari = useCallback((teks: string) => {
        setPesan(teks)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setPesan(null), 3000)
    }, [])

    useEffect(() => {
        if (!aktif) return
        document.body.classList.add('ujian-berjalan')

        const blokir = (teks: string) => (e: Event) => {
            e.preventDefault()
            kabari(teks)
        }
        const salin = blokir('Menyalin dan menempel dinonaktifkan selama ujian.')
        const menu = blokir('Klik kanan dinonaktifkan selama ujian.')
        const seret = (e: Event) => e.preventDefault()
        const tombol = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase()
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

        const peristiwa: [string, EventListener][] = [
            ['copy', salin],
            ['cut', salin],
            ['paste', salin],
            ['contextmenu', menu],
            ['dragstart', seret],
            ['drop', seret],
        ]
        peristiwa.forEach(([n, f]) => document.addEventListener(n, f, true))
        document.addEventListener('keydown', tombol, true)
        window.addEventListener('beforeprint', cetak)

        return () => {
            document.body.classList.remove('ujian-berjalan')
            peristiwa.forEach(([n, f]) => document.removeEventListener(n, f, true))
            document.removeEventListener('keydown', tombol, true)
            window.removeEventListener('beforeprint', cetak)
            clearTimeout(timer.current)
        }
    }, [aktif, kabari])

    return pesan
}
