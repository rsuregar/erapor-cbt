import { Preferences } from '@capacitor/preferences'

/**
 * Token login & id perangkat. Capacitor Preferences = SharedPreferences /
 * UserDefaults di app, localStorage di PWA.
 */
let token: string | null | undefined
let nama: string | null = null
let uuid: string | null = null

export const sesi = {
    async muat(): Promise<void> {
        if (token !== undefined) return
        token = (await Preferences.get({ key: 'token' })).value
        nama = (await Preferences.get({ key: 'nama' })).value
        uuid = (await Preferences.get({ key: 'uuid' })).value
    },

    token(): string | null {
        return token ?? null
    },

    nama(): string | null {
        return nama
    },

    /** Pemilik data ujian lokal — perangkat lab dipakai bergantian. */
    uuid(): string | null {
        return uuid
    },

    async masuk(tokenBaru: string, namaMurid: string | null, uuidMurid: string): Promise<void> {
        token = tokenBaru
        nama = namaMurid
        uuid = uuidMurid
        await Preferences.set({ key: 'token', value: tokenBaru })
        await Preferences.set({ key: 'nama', value: namaMurid ?? '' })
        await Preferences.set({ key: 'uuid', value: uuidMurid })
    },

    async keluar(): Promise<void> {
        token = null
        nama = null
        uuid = null
        await Preferences.remove({ key: 'token' })
        await Preferences.remove({ key: 'nama' })
        await Preferences.remove({ key: 'uuid' })
    },

    /** Id acak per instalasi — kontrak: `perangkat_id`. */
    async perangkatId(): Promise<string> {
        const ada = (await Preferences.get({ key: 'perangkat_id' })).value
        if (ada) return ada
        const baru = crypto.randomUUID()
        await Preferences.set({ key: 'perangkat_id', value: baru })

        return baru
    },
}
