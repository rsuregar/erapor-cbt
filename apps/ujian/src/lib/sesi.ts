import { Preferences } from '@capacitor/preferences'

/**
 * Token login & id perangkat. Capacitor Preferences = SharedPreferences /
 * UserDefaults di app, localStorage di PWA.
 */
let token: string | null | undefined
let nama: string | null = null
let uuid: string | null = null
let nis: string | null = null
let kelas: string | null = null
let nisn: string | null = null
let foto: string | null = null
let sekolah: string | null = null
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
        kelas = (await Preferences.get({ key: 'kelas' })).value
        nisn = (await Preferences.get({ key: 'nisn' })).value
        foto = (await Preferences.get({ key: 'foto' })).value
        sekolah = (await Preferences.get({ key: 'sekolah' })).value
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

    /** Kelas murid saat ini */
    kelas(): string | null {
        return kelas
    },

    /** NISN resmi nasional */
    nisn(): string | null {
        return nisn
    },

    /** Pasfoto / avatar resmi */
    foto(): string | null {
        return foto
    },

    /** Nama sekolah */
    sekolah(): string | null {
        return sekolah
    },

    /** Pemilik data ujian lokal — perangkat lab dipakai bergantian. */
    uuid(): string | null {
        return uuid
    },

    async masuk(
        tokenBaru: string,
        namaMurid: string | null,
        uuidMurid: string,
        nisMurid: string,
        kelasMurid?: string | null,
        nisnMurid?: string | null,
        fotoMurid?: string | null,
        sekolahMurid?: string | null,
    ): Promise<void> {
        token = tokenBaru
        nama = namaMurid
        uuid = uuidMurid
        nis = nisMurid
        kelas = kelasMurid ?? null
        nisn = nisnMurid ?? null
        foto = fotoMurid ?? null
        sekolah = sekolahMurid ?? null

        await Preferences.set({ key: 'token', value: tokenBaru })
        await Preferences.set({ key: 'nama', value: namaMurid ?? '' })
        await Preferences.set({ key: 'uuid', value: uuidMurid })
        await Preferences.set({ key: 'nis', value: nisMurid })
        if (kelasMurid) await Preferences.set({ key: 'kelas', value: kelasMurid })
        if (nisnMurid) await Preferences.set({ key: 'nisn', value: nisnMurid })
        if (fotoMurid) await Preferences.set({ key: 'foto', value: fotoMurid })
        if (sekolahMurid) await Preferences.set({ key: 'sekolah', value: sekolahMurid })
    },

    async perbaruiProfil(data: {
        nama?: string | null
        nis?: string | null
        kelas?: string | null
        nisn?: string | null
        foto?: string | null
        sekolah?: string | null
    }): Promise<void> {
        if (data.nama !== undefined && data.nama !== null) {
            nama = data.nama
            await Preferences.set({ key: 'nama', value: data.nama })
        }
        if (data.nis !== undefined && data.nis !== null) {
            nis = data.nis
            await Preferences.set({ key: 'nis', value: data.nis })
        }
        if (data.kelas !== undefined && data.kelas !== null) {
            kelas = data.kelas
            await Preferences.set({ key: 'kelas', value: data.kelas })
        }
        if (data.nisn !== undefined && data.nisn !== null) {
            nisn = data.nisn
            await Preferences.set({ key: 'nisn', value: data.nisn })
        }
        if (data.foto !== undefined && data.foto !== null) {
            foto = data.foto
            await Preferences.set({ key: 'foto', value: data.foto })
        }
        if (data.sekolah !== undefined && data.sekolah !== null) {
            sekolah = data.sekolah
            await Preferences.set({ key: 'sekolah', value: data.sekolah })
        }
    },

    async keluar(): Promise<void> {
        token = null
        nama = null
        uuid = null
        nis = null
        kelas = null
        nisn = null
        foto = null
        sekolah = null
        await Preferences.remove({ key: 'token' })
        await Preferences.remove({ key: 'nama' })
        await Preferences.remove({ key: 'uuid' })
        await Preferences.remove({ key: 'nis' })
        await Preferences.remove({ key: 'kelas' })
        await Preferences.remove({ key: 'nisn' })
        await Preferences.remove({ key: 'foto' })
        await Preferences.remove({ key: 'sekolah' })
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
