/**
 * Bentuk data API app ujian murid. Sumber kebenaran:
 * erapor/docs/cbt/kontrak-api-murid.md — ubah dokumen itu dulu, lalu file ini.
 */

export type StatusPengerjaan = 'belum_mulai' | 'mengerjakan' | 'terkunci' | 'menunggu_sinkron' | 'selesai'

export type Platform = 'android' | 'ios' | 'pwa'

export type JenisSoal =
    | 'pilihan_ganda'
    | 'pg_stimulus'
    | 'pg_kompleks'
    | 'isian'
    | 'uraian'
    | 'studi_kasus'
    | 'menjodohkan'
    | 'benar_salah'

/** Dokumen Tiptap (JSON), dirender oleh @erapor-cbt/question-renderer. */
export type Doc = { type: string; [kunci: string]: unknown }

/** GET /ujian */
export type UjianRingkas = {
    id: number
    nama: string
    mapel: string | null
    /** Identitas peserta untuk konfirmasi sebelum ujian; foto null bila belum ada. */
    murid: { id: number; nama: string; foto: string | null }
    dibuka_pada: string
    ditutup_pada: string
    durasi_menit: number
    tambahan_waktu_menit: number
    jumlah_soal: number
    level_keamanan: 'dasar' | 'ketat' | 'lockdown'
    sesi: { nama: string; ruang: string | null } | null
    /** wajib = hanya bisa dikerjakan di sekolah; minta izin GPS sebelum Mulai. */
    lokasi: { wajib: boolean; radius_meter: number | null }
    status: StatusPengerjaan
    attempt_id: number | null
    bisa_unduh: boolean
    hasil_tersedia: boolean
}

/** Versi app native (kontrak § Versi aplikasi). null = tidak dicek / belum ada. */
export type InfoAplikasi = {
    versi_minimum: { android: string | null; ios: string | null }
    tautan_pembaruan: { android: string | null; ios: string | null }
}

/** GET /ujian — `aplikasi` berlaku global, bukan per ujian. */
export type DaftarUjianRespons = { data: UjianRingkas[]; aplikasi?: InfoAplikasi }

/** GET /ujian/{ujian}/paket (terenkripsi) */
export type PaketTerenkripsi = {
    versi: string
    algoritma: 'AES-256-GCM'
    iv: string
    aad: string
    isi: string
    media: string[]
}

export type SoalPaket = {
    /** id item paket — dipakai di semua kiriman jawaban */
    id: number
    nomor: number
    jenis: JenisSoal
    stimulus_id: number | null
    pertanyaan: Doc
    opsi: unknown
    bobot: number
}

/** Isi paket setelah didekripsi. Tidak pernah memuat kunci/rubrik/pembahasan. */
export type IsiPaket = {
    soal: SoalPaket[]
    stimulus: Record<string, { judul: string | null; konten: Doc }>
}

/** pilihan_ganda/pg_stimulus/isian/uraian/studi_kasus: teks; pg_kompleks: id[]; benar_salah & menjodohkan: peta. */
export type Jawaban = string | string[] | Record<string, boolean | string> | null

export type PerangkatInfo = {
    platform: Platform
    versi_app?: string
    kiosk_aktif?: boolean | null
}

/**
 * Posisi perangkat (kontrak § Lokasi ujian). Titik sekolah tidak pernah
 * dikirim/diterima klien — server yang membandingkan.
 */
export type Lokasi = {
    lat: number
    lng: number
    /** coords.accuracy dari OS, meter */
    akurasi_m: number
    /** mock location menurut OS (Android); PWA selalu false */
    palsu?: boolean
}

/** POST /ujian/{ujian}/mulai */
export type MulaiRespons = {
    attempt_id: number
    kunci: string
    waktu_server: string
    mulai_pada: string
    berakhir_pada: string
    minimal_kumpul_pada: string | null
    ambang_pelanggaran: number
    level_keamanan: UjianRingkas['level_keamanan']
    /** true = sertakan `detak.lokasi` di setiap sinkron */
    lokasi_wajib: boolean
    jawaban_tersimpan: Record<string, { jawaban: Jawaban; seq: number; ragu: boolean }>
}

export type EntriJawaban = {
    soal_id: number
    seq: number
    jawaban: Jawaban
    ragu?: boolean
    /** milidetik sejak mulai attempt (jam monotonik), bukan jam perangkat */
    waktu_klien_ms?: number
}

export type Detak = {
    soal_aktif?: number | null
    offline_ms?: number
    kiosk_aktif?: boolean | null
    /** posisi terakhir yang diketahui, bila MulaiRespons.lokasi_wajib */
    lokasi?: Lokasi
}

/** POST /attempt/{attempt}/sinkron */
export type SinkronRespons = {
    diakui: Record<string, number>
    waktu_server: string
    berakhir_pada: string
    status: StatusPengerjaan
    pesan_pengawas: string | null
    pesan_pada: string | null
}

export type JenisPelanggaran =
    | 'pindah_tab'
    | 'keluar_layar_penuh'
    | 'latar_belakang'
    | 'ukuran_layar'
    | 'muat_ulang'
    | 'offline'
    | 'perangkat_lain'
    | 'multi_monitor'
    | 'salin_tempel'

export type EntriPelanggaran = {
    jenis: JenisPelanggaran
    mulai_ms: number
    durasi_ms?: number
    offline?: boolean
    meta?: Record<string, unknown>
    /** nama field berkas bukti, mis. "bukti_0" */
    bukti?: string
}

export type PelanggaranRespons = { status: 'mengerjakan' | 'terkunci'; jumlah_dihitung: number; ambang: number }

/** GET /attempt/{attempt}/hasil */
export type HasilRespons = {
    ujian: { id: number; nama: string; mapel: string | null }
    nilai: number
    skor: number
    skor_maks: number
    kktp: number | null
    tuntas: boolean | null
    dikumpulkan_pada: string | null
    tampilkan_pembahasan: boolean
    pembahasan_ditunda?: boolean
    pembahasan_terbuka_pada?: string | null
    soal: (SoalPaket & {
        jawaban: Jawaban
        skor: number | null
        anulir: 'skor_penuh' | 'dikeluarkan' | null
        komentar: string[]
        kunci: Record<string, unknown> | null
        pembahasan: Doc | null
    })[]
    stimulus: IsiPaket['stimulus']
}

/** Kode galat stabil dari server. */
export type KodeGalat =
    | 'TOKEN_SALAH'
    | 'BELUM_DIBUKA'
    | 'SUDAH_DITUTUP'
    | 'PERANGKAT_LAIN'
    | 'TERKUNCI'
    | 'SUDAH_SELESAI'
    | 'BELUM_MINIMAL'
    | 'BUKAN_PESERTA'
    | 'BELUM_BISA_UNDUH'
    | 'BELUM_DIRILIS'
    | 'FORMAT_SALAH'
    // Lokasi ujian (/mulai)
    | 'LOKASI_DIPERLUKAN'
    | 'LOKASI_TIDAK_AKURAT'
    | 'LOKASI_PALSU'
    | 'DI_LUAR_LOKASI'
    | 'LOKASI_BELUM_DIATUR'
    // Versi app native lebih lama dari minimum (426)
    | 'VERSI_USANG'
    | (string & {})
