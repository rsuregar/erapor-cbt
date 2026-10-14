import type { HasilRespons, UjianRingkas } from '@erapor-cbt/exam-core'

/**
 * Mode demo (HANYA saat `npm run dev`): data contoh tanpa server, untuk
 * meninjau desain. Masuk dengan username "demo". Tidak ikut build produksi.
 */
export const TOKEN_DEMO = 'demo'

const doc = (teks: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: teks }] }] })

function ujian(): UjianRingkas[] {
    const j = (menit: number) => new Date(Date.now() + menit * 60_000).toISOString()

    return [
        {
            id: 1, nama: 'Penilaian Akhir Semester Ganjil', mapel: 'Matematika', dibuka_pada: j(-20), ditutup_pada: j(100),
            durasi_menit: 90, tambahan_waktu_menit: 0, jumlah_soal: 30, level_keamanan: 'ketat',
            sesi: { nama: 'Sesi 1', ruang: 'Lab Komputer 1' }, status: 'belum_mulai', attempt_id: null, bisa_unduh: true, hasil_tersedia: false,
        },
        {
            id: 2, nama: 'Ulangan Harian Bab 3', mapel: 'Bahasa Arab', dibuka_pada: j(60 * 26), ditutup_pada: j(60 * 27),
            durasi_menit: 45, tambahan_waktu_menit: 0, jumlah_soal: 20, level_keamanan: 'dasar',
            sesi: { nama: 'Sesi 2', ruang: 'Kelas 8A' }, status: 'belum_mulai', attempt_id: null, bisa_unduh: false, hasil_tersedia: false,
        },
        {
            id: 3, nama: 'Penilaian Tengah Semester', mapel: 'Ilmu Pengetahuan Alam', dibuka_pada: j(-60 * 72), ditutup_pada: j(-60 * 70),
            durasi_menit: 90, tambahan_waktu_menit: 0, jumlah_soal: 25, level_keamanan: 'lockdown',
            sesi: null, status: 'selesai', attempt_id: 31, bisa_unduh: false, hasil_tersedia: true,
        },
    ]
}

function hasil(): HasilRespons {
    return {
        ujian: { id: 3, nama: 'Penilaian Tengah Semester', mapel: 'Ilmu Pengetahuan Alam' },
        nilai: 86.5, skor: 17.3, skor_maks: 20, kktp: 75, tuntas: true, dikumpulkan_pada: new Date().toISOString(), tampilkan_pembahasan: true,
        soal: [
            { id: 1, nomor: 1, jenis: 'pilihan_ganda', stimulus_id: null, pertanyaan: doc('Organ yang berfungsi memompa darah ke seluruh tubuh adalah …'), opsi: [], bobot: 2, jawaban: 'o1', skor: 2, anulir: null, komentar: [], kunci: { opsi: 'o1' }, pembahasan: doc('Jantung memompa darah melalui pembuluh darah ke seluruh tubuh.') },
            { id: 2, nomor: 2, jenis: 'uraian', stimulus_id: null, pertanyaan: doc('Jelaskan proses fotosintesis secara singkat.'), opsi: null, bobot: 4, jawaban: 'Tumbuhan membuat makanan dari cahaya.', skor: 2.5, anulir: null, komentar: ['Sebutkan juga bahan dan hasil fotosintesis.'], kunci: null, pembahasan: null },
        ],
        stimulus: {},
    }
}

/** fetch tiruan untuk KlienApi. */
export async function fetchDemo(url: string | URL | Request): Promise<Response> {
    const jalur = String(url)
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
    await new Promise((r) => setTimeout(r, 300))

    if (jalur.endsWith('/auth/login')) return json({ data: { access_token: TOKEN_DEMO, uuid: 'demo', user: { name: 'Ahmad Fauzan Hidayat' } } })
    if (jalur.endsWith('/auth/logout')) return json({ message: 'ok' })
    if (jalur.endsWith('/cbt/ujian')) return json({ data: ujian() })
    if (/\/cbt\/attempt\/\d+\/hasil$/.test(jalur)) return json(hasil())

    return json({ message: 'Belum tersedia di mode demo.', kode: 'DEMO' }, 404)
}
