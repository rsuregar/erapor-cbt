import { Preferences } from '@capacitor/preferences'

/**
 * Token login & id perangkat. Capacitor Preferences = SharedPreferences /
 * UserDefaults di app, localStorage di PWA.
 */
let token: string | null | undefined
let nama: string | null = null
let uuid: string | null = null
let nis: string | null = null

let perangkatIdCache: string | null = null

export const sesi = {
    /**
     * Token ditolak server (dicabut, mis. pengawas mereset sesi akun, atau kedaluwarsa): layar
     * Masuk menjelaskan kenapa murid terlempar. sessionStorage: hilang bila app ditutup.
     */
    catatKeluarPaksa(): void {
        try {
            sessionStorage.setItem('keluar_paksa', '1')
        } catch {
            // sessionStorage tidak tersedia: murid tetap diarahkan ke layar Masuk tanpa penjelasan.
        }
    },

    /** Hanya membaca (aman dipanggil dua kali oleh render ganda); hapus lewat `hapusKeluarPaksa`. */
    lihatKeluarPaksa(): boolean {
        try {
            return sessionStorage.getItem('keluar_paksa') === '1'
        } catch {
            return false
        }
    },

    hapusKeluarPaksa(): void {
        try {
            sessionStorage.removeItem('keluar_paksa')
        } catch {
            // abaikan
        }
    },

    async muat(): Promise<void> {
        if (token !== undefined) return
        token = (await Preferences.get({ key: 'token' })).value
        nama = (await Preferences.get({ key: 'nama' })).value
        uuid = (await Preferences.get({ key: 'uuid' })).value
        nis = (await Preferences.get({ key: 'nis' })).value
    },

    token(): string | null {
        return token ?? null
    },

    nama(): string | null {
        return nama
    },

    /** NIS/username saat masuk — ikut watermark soal. */
    nis(): string | null {
        return nis
    },

    /** Pemilik data ujian lokal — perangkat lab dipakai bergantian. */
    uuid(): string | null {
        return uuid
    },

    async masuk(tokenBaru: string, namaMurid: string | null, uuidMurid: string, nisMurid: string): Promise<void> {
        token = tokenBaru
        nama = namaMurid
        uuid = uuidMurid
        nis = nisMurid
        await Preferences.set({ key: 'nis', value: nisMurid })
        await Preferences.set({ key: 'token', value: tokenBaru })
        await Preferences.set({ key: 'nama', value: namaMurid ?? '' })
        await Preferences.set({ key: 'uuid', value: uuidMurid })
    },

    async keluar(): Promise<void> {
        token = null
        nama = null
        uuid = null
        nis = null
        await Preferences.remove({ key: 'nis' })
        await Preferences.remove({ key: 'token' })
        await Preferences.remove({ key: 'nama' })
        await Preferences.remove({ key: 'uuid' })
    },

    /** Id acak per instalasi — kontrak: `perangkat_id`. */
    async perangkatId(): Promise<string> {
        if (perangkatIdCache) return perangkatIdCache
        const ada = (await Preferences.get({ key: 'perangkat_id' })).value
        if (ada) {
            perangkatIdCache = ada
            return ada
        }
        const baru = crypto.randomUUID()
        await Preferences.set({ key: 'perangkat_id', value: baru })
        perangkatIdCache = baru

        return baru
    },
}
