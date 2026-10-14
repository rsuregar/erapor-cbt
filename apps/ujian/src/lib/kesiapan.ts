import { platform } from '@/lib/api'
import { hpMiring, jenisPerangkat, layarDibagi, layarPenuhAktif, standalone } from '@/lib/perangkat'
import type { UjianRingkas } from '@erapor-cbt/exam-core'

/**
 * Cek kesiapan perangkat sebelum Mulai (story 7.3, PRD alur hari ujian #2).
 * `gagal` mengunci tombol Mulai di level Ketat/Lockdown (atau di semua level
 * bila `wajib`), `peringatan` tidak pernah mengunci.
 */

export type HasilCek = 'lulus' | 'peringatan' | 'gagal' | 'info'

export type AksiCek = 'layar_penuh' | 'perbarui' | 'panduan'

export type ItemCek = {
    kunci: string
    judul: string
    hasil: HasilCek
    keterangan: string
    aksi?: AksiCek
    /** gagal di level apa pun (app tidak bisa berjalan) */
    wajib?: boolean
}

export type KeadaanTambahan = {
    pembaruanTersedia: boolean
    ruangBebas: number | null
    baterai: { level: number; mengisi: boolean } | null
}

const MB = 1024 * 1024

export function periksa(level: UjianRingkas['level_keamanan'], t: KeadaanTambahan): ItemCek[] {
    const daftar: ItemCek[] = []
    const jenis = jenisPerangkat()
    const asli = platform() !== 'pwa'

    const fiturHilang = [
        !globalThis.isSecureContext && 'koneksi aman (https)',
        !globalThis.indexedDB && 'penyimpanan IndexedDB',
        !globalThis.crypto?.subtle && 'WebCrypto',
    ].filter(Boolean)
    daftar.push(
        fiturHilang.length
            ? { kunci: 'browser', judul: 'Browser', hasil: 'gagal', wajib: true, keterangan: `Browser ini tidak mendukung ${fiturHilang.join(', ')}. Perbarui browser atau pakai Chrome/Safari terbaru.` }
            : { kunci: 'browser', judul: 'Browser', hasil: 'lulus', keterangan: 'Mendukung penyimpanan offline dan enkripsi soal.' },
    )

    daftar.push(
        t.pembaruanTersedia
            ? { kunci: 'versi', judul: 'Versi aplikasi', hasil: 'peringatan', aksi: 'perbarui', keterangan: 'Versi baru tersedia. Perbarui sekarang, sebelum ujian dimulai.' }
            : { kunci: 'versi', judul: 'Versi aplikasi', hasil: 'lulus', keterangan: `Versi ${__VERSI_APP__}` },
    )

    if (asli) {
        daftar.push({ kunci: 'tampilan', judul: 'Tampilan', hasil: 'lulus', keterangan: 'Aplikasi ujian terpasang.' })
    } else if (jenis === 'desktop') {
        daftar.push(
            layarPenuhAktif()
                ? { kunci: 'tampilan', judul: 'Layar penuh', hasil: 'lulus', keterangan: 'Layar penuh aktif.' }
                : document.fullscreenEnabled
                  ? { kunci: 'tampilan', judul: 'Layar penuh', hasil: 'lulus', aksi: 'layar_penuh', keterangan: level === 'dasar' ? 'Disarankan. Layar penuh menyala saat kamu menekan Mulai.' : 'Wajib. Layar penuh menyala saat kamu menekan Mulai — izinkan bila diminta.' }
                  : { kunci: 'tampilan', judul: 'Layar penuh', hasil: 'gagal', keterangan: 'Browser ini tidak bisa masuk layar penuh. Pakai Chrome, Edge, atau Firefox terbaru.' },
        )
    } else {
        daftar.push(
            standalone()
                ? { kunci: 'tampilan', judul: 'Tampilan', hasil: 'lulus', keterangan: 'Dibuka dari ikon di layar utama.' }
                : { kunci: 'tampilan', judul: 'Tampilan', hasil: 'gagal', aksi: 'panduan', keterangan: 'Buka ujian dari ikon "Ujian" di layar utama, bukan dari tab browser.' },
        )
    }

    if (jenis !== 'desktop') {
        daftar.push(
            layarDibagi()
                ? { kunci: 'layar', judul: 'Ukuran layar', hasil: 'gagal', keterangan: 'Layar sedang dibagi dengan aplikasi lain (Split View / jendela mengambang). Tampilkan ujian satu layar penuh.' }
                : hpMiring()
                  ? { kunci: 'layar', judul: 'Ukuran layar', hasil: 'peringatan', keterangan: 'Putar HP ke posisi tegak agar soal lebih mudah dibaca.' }
                  : { kunci: 'layar', judul: 'Ukuran layar', hasil: 'lulus', keterangan: 'Satu layar penuh.' },
        )
        if (!asli) {
            daftar.push({
                kunci: 'kunci_os',
                judul: 'Kunci layar',
                hasil: 'info',
                aksi: 'panduan',
                keterangan: `${jenis === 'ios' ? 'Akses Terpandu' : 'Sematkan Aplikasi'} dinyalakan bersama pengawas sebelum token diberikan.`,
            })
        }
    } else if (level === 'lockdown' && !asli) {
        daftar.push({ kunci: 'kunci_os', judul: 'Kunci layar', hasil: 'info', keterangan: 'Browser laptop tidak bisa dikunci. Keluar dari layar ujian langsung tercatat dan bisa mengunci ujian.' })
    }

    if (t.ruangBebas !== null) {
        daftar.push(
            t.ruangBebas < 50 * MB
                ? { kunci: 'ruang', judul: 'Penyimpanan', hasil: 'peringatan', keterangan: `Sisa ruang ${Math.round(t.ruangBebas / MB)} MB. Hapus foto/video atau aplikasi yang tidak dipakai agar jawaban offline aman tersimpan.` }
                : { kunci: 'ruang', judul: 'Penyimpanan', hasil: 'lulus', keterangan: 'Ruang cukup untuk menyimpan jawaban offline.' },
        )
    }

    if (t.baterai) {
        const persen = Math.round(t.baterai.level * 100)
        daftar.push(
            t.baterai.level < 0.2 && !t.baterai.mengisi
                ? { kunci: 'baterai', judul: 'Baterai', hasil: 'peringatan', keterangan: `Baterai ${persen}%. Isi daya atau sambungkan charger sebelum mulai.` }
                : { kunci: 'baterai', judul: 'Baterai', hasil: 'lulus', keterangan: `Baterai ${persen}%${t.baterai.mengisi ? ' · sedang diisi' : ''}.` },
        )
    }

    return daftar
}

/** Tombol Mulai terkunci? Level Dasar hanya memperingatkan, kecuali yang wajib. */
export function menghalangi(daftar: ItemCek[], level: UjianRingkas['level_keamanan']): ItemCek[] {
    return daftar.filter((i) => i.hasil === 'gagal' && (i.wajib || level !== 'dasar'))
}
