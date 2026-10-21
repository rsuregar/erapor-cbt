import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/**
 * Jembatan ke plugin native app (android/…/UjianNativePlugin.java). Semua
 * fungsi aman dipanggil di PWA: tidak melakukan apa-apa / mengembalikan null.
 */

type StatusKunci = { aktif: boolean; mode: 'kios' | 'sematan' | 'tidak' }
type PosisiNative = { lat: number; lng: number; akurasi_m: number; palsu: boolean }

import type { JembatanKvSqlite } from '@erapor-cbt/exam-core'

interface UjianNativePlugin {
    kunciLayar(): Promise<StatusKunci>
    lepasKunci(): Promise<StatusKunci>
    statusKunciLayar(): Promise<StatusKunci>
    izinLokasi(): Promise<{ izin: PermissionState }>
    ambilLokasi(opsi: { maksUmurMs?: number; batasMs?: number }): Promise<PosisiNative>
    sqliteAmbil(opsi: { kunci: string }): Promise<{ ada: boolean; nilai?: string | null }>
    sqliteSimpan(opsi: { kunci: string; nilai: string }): Promise<void>
    sqliteHapus(opsi: { kunci: string }): Promise<void>
    sqliteDaftarKunci(opsi: { awalan?: string }): Promise<{ kunci: string[] }>
    unduhMedia(opsi: { url: string }): Promise<{ path: string }>
    hapusMedia(opsi: { path: string[] }): Promise<void>
    pasangApk(opsi: { url: string }): Promise<void>
    addListener(event: 'progresPembaruan', cb: (p: ProgresPembaruan) => void): Promise<PluginListenerHandle>
}

const UjianNative = registerPlugin<UjianNativePlugin>('UjianNative')

/** Android: plugin lokal tersedia. iOS menyusul. */
export const adaNative = () => Capacitor.getPlatform() === 'android'

/**
 * Jembatan langsung ke SQLite database Android (erapor_cbt.db)
 * Memenuhi kontrak JembatanKvSqlite dari @erapor-cbt/exam-core.
 * Galat SQLite DITERUSKAN, tidak diubah menjadi "data tidak ada": paket/jawaban
 * yang tersimpan tidak boleh tampak hilang (lihat lib/penyimpanan.ts).
 */
export const jembatanSqliteNative: JembatanKvSqlite = {
    async ambil(kunci: string): Promise<string | undefined> {
        if (!adaNative()) return undefined
        const res = await UjianNative.sqliteAmbil({ kunci })
        return res.ada && res.nilai !== null && res.nilai !== undefined ? res.nilai : undefined
    },
    async simpan(kunci: string, nilaiString: string): Promise<void> {
        if (!adaNative()) return
        await UjianNative.sqliteSimpan({ kunci, nilai: nilaiString })
    },
    async hapus(kunci: string): Promise<void> {
        if (!adaNative()) return
        await UjianNative.sqliteHapus({ kunci })
    },
    async daftarKunci(awalan: string): Promise<string[]> {
        if (!adaNative()) return []
        const res = await UjianNative.sqliteDaftarKunci({ awalan })
        return res.kunci ?? []
    },
}


/** Deteksi apakah aplikasi berjalan di dalam Tauri Desktop (Windows / macOS / Linux Exam Browser) */
export const isTauri = () =>
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Jembatan langsung ke SQLite database Desktop (Windows & macOS via Tauri)
 * Memenuhi kontrak JembatanKvSqlite dari @erapor-cbt/exam-core.
 */
export const jembatanSqliteTauri: JembatanKvSqlite = {
    async ambil(kunci: string): Promise<string | undefined> {
        if (!isTauri()) return undefined
        const { invoke } = await import('@tauri-apps/api/core')
        const res = await invoke<string | null>('sqlite_ambil', { kunci })
        return res !== null && res !== undefined ? res : undefined
    },
    async simpan(kunci: string, nilaiString: string): Promise<void> {
        if (!isTauri()) return
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('sqlite_simpan', { kunci, nilai: nilaiString })
    },
    async hapus(kunci: string): Promise<void> {
        if (!isTauri()) return
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('sqlite_hapus', { kunci })
    },
    async daftarKunci(awalan: string): Promise<string[]> {
        if (!isTauri()) return []
        const { invoke } = await import('@tauri-apps/api/core')
        return await invoke<string[]>('sqlite_daftar_kunci', { awalan })
    },
}


/** True jika aplikasi berjalan sebagai native app (Android APK, iOS, atau Tauri Desktop Exam Browser). */
export const isNative = () => Capacitor.isNativePlatform() || isTauri()

/**
 * Keluar / tutup aplikasi (Tauri Desktop Exam Browser atau Capacitor Mobile).
 * Selalu membersihkan sesi akun (logout) terlebih dahulu agar tidak tertinggal.
 */
export async function keluarAplikasi(): Promise<void> {
    try {
        const { api } = await import('@/lib/api')
        const { sesi } = await import('@/lib/sesi')
        const { penyimpanan } = await import('@/lib/ujian')

        // Panggil endpoint logout server jika memungkinkan
        if (api && typeof api.keluar === 'function') {
            await api.keluar().catch(() => undefined)
        }

        // Hapus cache lokal data ujian murid
        if (sesi && typeof sesi.uuid === 'function') {
            const uuid = sesi.uuid()
            if (uuid && penyimpanan && typeof penyimpanan.hapus === 'function') {
                await penyimpanan.hapus(`daftar-ujian:${uuid}`).catch(() => undefined)
            }
        }

        // Hapus kredensial sesi lokal
        if (sesi && typeof sesi.keluar === 'function') {
            await sesi.keluar().catch(() => undefined)
        }
    } catch {
        // Abaikan jika modul sesi belum diinisialisasi atau di lingkungan non-browser
    }

    if (isTauri()) {
        try {
            const { invoke } = await import('@tauri-apps/api/core')
            await invoke('keluar_aplikasi')
        } catch {
            // Abaikan jika tidak di runtime Tauri
        }
    } else if (Capacitor.isNativePlatform()) {
        try {
            const { App } = await import('@capacitor/app')
            await App.exitApp()
        } catch {
            // Abaikan jika bukan runtime Capacitor
        }
    } else if (typeof window !== 'undefined' && typeof window.close === 'function') {
        window.close()
    }
}

/** Progres pasang pembaruan: Rust `pasang_pembaruan` (desktop) atau event `progresPembaruan` (Android). `diterima` = byte sejak event sebelumnya. */
export type ProgresPembaruan = { jenis: 'mulai'; total: number | null } | { jenis: 'progres'; diterima: number } | { jenis: 'memasang' }

type RilisDipasang = { unduh: string; manifes?: string }

/**
 * True bila app ini bisa memasang pembaruan sendiri: Android (APK rilis), atau desktop
 * yang dibuild dengan pubkey updater dan rilisnya memuat manifes.
 */
export async function bisaPasangPembaruan(info: RilisDipasang): Promise<boolean> {
    if (adaNative()) return true
    if (!isTauri() || !info.manifes) return false
    try {
        const { invoke } = await import('@tauri-apps/api/core')

        return await invoke<boolean>('pembaruan_tersedia')
    } catch {
        return false
    }
}

/**
 * Unduh dengan progres lalu pasang pembaruan. Melempar Error berpesan bila gagal
 * (pemanggil kembali ke unduh manual).
 * - Desktop: verifikasi tanda tangan, pasang, app dimulai ulang (promise tidak selesai).
 * - Android: resolve saat pemasang sistem terbuka; murid menekan "Pasang".
 */
export async function pasangPembaruan(info: RilisDipasang, onProgres: (p: ProgresPembaruan) => void): Promise<void> {
    if (adaNative()) {
        const dengar = await UjianNative.addListener('progresPembaruan', onProgres)
        try {
            await UjianNative.pasangApk({ url: info.unduh })
        } catch (e) {
            const { code, message } = e as { code?: string; message?: string }
            throw new Error(
                code === 'IZIN_PASANG'
                    ? 'Aktifkan "Izinkan dari sumber ini" untuk app ujian di layar setelan yang terbuka, lalu tekan Perbarui sekarang lagi.'
                    : (message ?? 'Pembaruan gagal.'),
            )
        } finally {
            void dengar.remove()
        }

        return
    }
    if (!isTauri() || !info.manifes) throw new Error('Pembaruan di dalam app tidak tersedia.')

    const { Channel, invoke } = await import('@tauri-apps/api/core')
    const progres = new Channel<ProgresPembaruan>()
    progres.onmessage = onProgres
    try {
        await invoke('pasang_pembaruan', { manifes: info.manifes, progres })
    } catch (e) {
        throw new Error(typeof e === 'string' ? e : e instanceof Error ? e.message : 'Pembaruan gagal.')
    }
}

/**
 * Shortcut pengawas untuk membuka dialog tutup aplikasi: (Ctrl/Alt/Cmd) + Shift + Q/X.
 * Memakai `e.code` (tombol fisik), bukan `e.key`: di macOS, Option+Shift+Q menghasilkan
 * karakter "Œ" sehingga `e.key` bukan "Q". Di macOS, Cmd+Shift+Q dipakai sistem untuk
 * Log Out, jadi gunakan Ctrl+Shift+Q / X.
 */
export function isShortcutPengawas(e: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'code'>): boolean {
    const isModifier = e.ctrlKey || e.metaKey || e.altKey
    return isModifier && e.shiftKey && (e.code === 'KeyQ' || e.code === 'KeyX')
}

/**
 * Media soal sebagai berkas di penyimpanan app (Android: files/media, desktop: app data/media),
 * supaya gambar tetap tampil saat offline tanpa bergantung pada service worker.
 * null = bukan app native (PWA memakai Cache Storage + service worker).
 */
export function adaMediaNative(): boolean {
    return adaNative() || isTauri()
}

/** Unduh satu media bila belum ada; kembalikan path berkas lokal. Berkas yang sudah ada tidak butuh jaringan. */
export async function unduhMediaNative(url: string): Promise<string> {
    if (adaNative()) return (await UjianNative.unduhMedia({ url })).path
    const { invoke } = await import('@tauri-apps/api/core')
    try {
        return await invoke<string>('unduh_media', { url })
    } catch (e) {
        throw new Error(typeof e === 'string' ? e : 'Gagal mengunduh media.')
    }
}

/** Hapus berkas media (path di luar folder media diabaikan di sisi native). */
export async function hapusMediaNative(path: string[]): Promise<void> {
    if (path.length === 0) return
    if (adaNative()) return UjianNative.hapusMedia({ path })
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('hapus_media', { path })
}

/** URL yang bisa dipakai <img> untuk berkas lokal. */
export async function srcMediaNative(path: string): Promise<string> {
    if (adaNative()) return Capacitor.convertFileSrc(path)
    const { convertFileSrc } = await import('@tauri-apps/api/core')

    return convertFileSrc(path)
}

/** Keluar / tutup aplikasi desktop Tauri (alias untuk kompatibilitas) */
export const keluarAplikasiTauri = keluarAplikasi

/** Sematkan aplikasi selama ujian. null = bukan app native. */
export async function kunciLayar(): Promise<boolean | null> {
    if (!adaNative()) return null

    return (await UjianNative.kunciLayar().catch(() => ({ aktif: false }))).aktif
}

export async function lepasKunciLayar(): Promise<void> {
    if (adaNative()) await UjianNative.lepasKunci().catch(() => undefined)
}

/** Untuk `kiosk_aktif` (kontrak): null di PWA, karena web tidak bisa membaca kunci OS. */
export async function statusKunciLayar(): Promise<boolean | null> {
    if (!adaNative()) return null

    return (await UjianNative.statusKunciLayar().catch(() => ({ aktif: false }))).aktif
}

export function izinLokasiNative(): Promise<PermissionState> {
    return UjianNative.izinLokasi().then((r) => r.izin)
}

/** Posisi + tanda lokasi palsu dari OS. Galat membawa `code`: DITOLAK / TIDAK_ADA / WAKTU_HABIS. */
export function ambilLokasiNative(opsi: { maksUmurMs?: number; batasMs?: number }): Promise<PosisiNative> {
    return UjianNative.ambilLokasi(opsi)
}

/** Jendela Exam Browser dikembalikan ke kios bila pengguna tidak kembali dalam waktu ini. */
const BATAS_PULIH_KIOS_MS = 15_000

/**
 * Buka tautan di browser sistem (mis. unduh pembaruan). Di Exam Browser desktop,
 * jendela kios (layar penuh + selalu di atas) menutupi browser, jadi kios dilepas
 * sementara lalu dipulihkan saat jendela app kembali difokuskan. Hanya dipanggil
 * dari layar di luar ujian (Masuk/Beranda).
 */
export async function bukaTautanLuar(url: string): Promise<void> {
    if (!isTauri()) {
        window.open(url, '_blank', 'noopener,noreferrer')
        return
    }

    // Dynamic import: modul Tauri hanya berfungsi di runtime desktop (sama seperti jembatanSqliteTauri).
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    const jendela = getCurrentWindow()
    const pulihkan = () => {
        void jendela.setFullscreen(true)
        void jendela.setAlwaysOnTop(true)
    }

    await jendela.setAlwaysOnTop(false)
    await jendela.setFullscreen(false)
    try {
        await openUrl(url)
    } catch (e) {
        pulihkan()
        throw e
    }

    let pernahKeluarFokus = false
    const lepas = await jendela.onFocusChanged(({ payload: fokus }) => {
        if (!fokus) {
            pernahKeluarFokus = true
        } else if (pernahKeluarFokus) {
            lepas()
            pulihkan()
        }
    })
    setTimeout(() => {
        if (!pernahKeluarFokus) {
            lepas()
            pulihkan()
        }
    }, BATAS_PULIH_KIOS_MS)
}
