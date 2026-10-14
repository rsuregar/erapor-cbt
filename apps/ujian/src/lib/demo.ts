import { keBase64, type EntriJawaban, type EntriPelanggaran, type HasilRespons, type IsiPaket, type UjianRingkas } from '@erapor-cbt/exam-core'

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
            durasi_menit: 90, tambahan_waktu_menit: 0, jumlah_soal: 8, level_keamanan: 'ketat',
            sesi: { nama: 'Sesi 1', ruang: 'Lab Komputer 1' }, status: st.status ?? 'belum_mulai', attempt_id: st.mulai ? ATTEMPT : null, bisa_unduh: true, hasil_tersedia: false,
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

// ——— Alur mengerjakan (ujian 1) ————————————————————————————————————————
// Keadaan disimpan di localStorage supaya muat ulang bisa dicoba.

const ATTEMPT = 101
const AMBANG = 3

type Keadaan = {
    status?: UjianRingkas['status']
    mulai?: string
    kunci?: string
    pelanggaran?: number
    terkunciPada?: number
    jawaban?: Record<string, { jawaban: EntriJawaban['jawaban']; seq: number; ragu: boolean }>
}

const st: Keadaan = /* @__PURE__ */ (() => {
    try {
        return JSON.parse(localStorage.getItem('cbt-demo') ?? '{}') as Keadaan
    } catch {
        return {}
    }
})()
const simpan = () => {
    try {
        localStorage.setItem('cbt-demo', JSON.stringify(st))
    } catch {
        // abaikan
    }
}

const pil = (id: string, teks: string) => ({ id, konten: doc(teks) })

function isiPaket(): IsiPaket {
    return {
        stimulus: {
            '7': { judul: 'Bacaan: Pasar Kue Ramadan', konten: doc('Setiap sore selama Ramadan, Bu Aminah menjual 120 kue. Pada hari pertama terjual 3/4 bagian, hari kedua terjual 90 kue, dan hari ketiga habis terjual. Harga satu kue Rp2.500.') },
        },
        soal: [
            { id: 11, nomor: 1, jenis: 'pilihan_ganda', stimulus_id: null, bobot: 1, pertanyaan: doc('Hasil dari 3/4 + 2/3 adalah …'), opsi: [pil('a', '5/7'), pil('b', '17/12'), pil('c', '6/12'), pil('d', '1 1/2')] },
            { id: 12, nomor: 2, jenis: 'pg_stimulus', stimulus_id: 7, bobot: 1, pertanyaan: doc('Berapa kue yang terjual pada hari pertama?'), opsi: [pil('a', '30'), pil('b', '60'), pil('c', '90'), pil('d', '100')] },
            { id: 13, nomor: 3, jenis: 'pg_stimulus', stimulus_id: 7, bobot: 1, pertanyaan: doc('Berapa pendapatan Bu Aminah pada hari kedua?'), opsi: [pil('a', 'Rp180.000'), pil('b', 'Rp225.000'), pil('c', 'Rp250.000'), pil('d', 'Rp300.000')] },
            { id: 14, nomor: 4, jenis: 'pg_kompleks', stimulus_id: null, bobot: 2, pertanyaan: doc('Pilih semua bilangan prima.'), opsi: [pil('a', '2'), pil('b', '9'), pil('c', '11'), pil('d', '15'), pil('e', '17')] },
            {
                id: 15, nomor: 5, jenis: 'benar_salah', stimulus_id: null, bobot: 2, pertanyaan: doc('Tentukan benar atau salah setiap pernyataan berikut.'),
                opsi: { label_benar: 'Benar', label_salah: 'Salah', pernyataan: [pil('p1', 'Jumlah sudut segitiga 180°.'), pil('p2', 'Persegi panjang memiliki 4 sumbu simetri.'), pil('p3', '0,5 sama dengan 1/2.')] },
            },
            {
                id: 16, nomor: 6, jenis: 'menjodohkan', stimulus_id: null, bobot: 2, pertanyaan: doc('Jodohkan bangun dengan rumus luasnya.'),
                opsi: { kiri: [pil('k1', 'Persegi'), pil('k2', 'Segitiga'), pil('k3', 'Lingkaran')], kanan: [pil('n1', '½ × a × t'), pil('n2', 's × s'), pil('n3', 'π × r²')] },
            },
            { id: 17, nomor: 7, jenis: 'isian', stimulus_id: null, bobot: 1, pertanyaan: doc('KPK dari 12 dan 18 adalah …'), opsi: null },
            { id: 18, nomor: 8, jenis: 'uraian', stimulus_id: null, bobot: 4, pertanyaan: doc('Jelaskan langkah menyederhanakan pecahan 18/24 dan tuliskan hasilnya.'), opsi: null },
        ],
    }
}

async function paketTerenkripsi() {
    if (!st.kunci) {
        st.kunci = keBase64(crypto.getRandomValues(new Uint8Array(32)))
        simpan()
    }
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const aad = 'demo:1'
    const k = await crypto.subtle.importKey('raw', Uint8Array.from(atob(st.kunci), (c) => c.charCodeAt(0)), 'AES-GCM', false, ['encrypt'])
    const isi = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) }, k, new TextEncoder().encode(JSON.stringify(isiPaket())))

    return { versi: 'demo', algoritma: 'AES-256-GCM', iv: keBase64(iv), aad, isi: keBase64(new Uint8Array(isi)), media: [] }
}

function sinkron(entri: EntriJawaban[]) {
    st.jawaban ??= {}
    const diakui: Record<string, number> = {}
    for (const e of entri) {
        st.jawaban[e.soal_id] = { jawaban: e.jawaban, seq: e.seq, ragu: !!e.ragu }
        diakui[e.soal_id] = e.seq
    }
    // "Pengawas" membuka kunci 20 detik kemudian, supaya alurnya bisa dicoba.
    if (st.status === 'terkunci' && st.terkunciPada && Date.now() - st.terkunciPada > 20_000) st.status = 'mengerjakan'
    simpan()
    const mulai = Date.parse(st.mulai ?? new Date().toISOString())
    const pesan = Date.now() - mulai > 45_000

    return {
        diakui,
        waktu_server: new Date().toISOString(),
        berakhir_pada: new Date(mulai + 90 * 60_000).toISOString(),
        status: st.status ?? 'mengerjakan',
        pesan_pengawas: pesan ? 'Periksa kembali nomor peserta di lembar kehadiran.' : null,
        pesan_pada: pesan ? new Date(mulai + 45_000).toISOString() : null,
    }
}

/** fetch tiruan untuk KlienApi. */
export async function fetchDemo(url: string | URL | Request, init?: RequestInit): Promise<Response> {
    const jalur = String(url)
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
    await new Promise((r) => setTimeout(r, 300))

    if (jalur.endsWith('/auth/login')) return json({ data: { access_token: TOKEN_DEMO, uuid: 'demo', user: { name: 'Ahmad Fauzan Hidayat' } } })
    if (jalur.endsWith('/auth/logout')) return json({ message: 'ok' })
    if (jalur.endsWith('/cbt/ujian')) return json({ data: ujian() })
    if (/\/cbt\/attempt\/\d+\/hasil$/.test(jalur)) return json(hasil())

    const isi = typeof init?.body === 'string' ? JSON.parse(init.body) : null
    if (jalur.endsWith('/cbt/ujian/1/paket')) {
        const teks = JSON.stringify(await paketTerenkripsi())

        return new Response(teks, { headers: { 'Content-Type': 'application/json', 'Content-Length': String(teks.length) } })
    }
    if (jalur.endsWith('/cbt/ujian/1/mulai')) {
        if (isi?.token === '000000') return json({ message: 'Token salah.', kode: 'TOKEN_SALAH' }, 422)
        if (st.status === 'selesai') return json({ message: 'Ujian sudah dikumpulkan.', kode: 'SUDAH_SELESAI' }, 409)
        st.mulai ??= new Date().toISOString()
        st.status ??= 'mengerjakan'
        simpan()
        await paketTerenkripsi()
        const mulai = Date.parse(st.mulai)

        return json({
            attempt_id: ATTEMPT, kunci: st.kunci, waktu_server: new Date().toISOString(), mulai_pada: st.mulai,
            berakhir_pada: new Date(mulai + 90 * 60_000).toISOString(), minimal_kumpul_pada: null, ambang_pelanggaran: AMBANG, jawaban_tersimpan: st.jawaban ?? {},
        })
    }
    if (jalur.endsWith(`/cbt/attempt/${ATTEMPT}/sinkron`)) {
        if (st.status === 'selesai') return json({ message: 'Sudah selesai.', kode: 'SUDAH_SELESAI' }, 409)

        return json(sinkron(isi?.entri ?? []))
    }
    if (jalur.endsWith(`/cbt/attempt/${ATTEMPT}/pelanggaran`)) {
        const entri = JSON.parse(String((init?.body as FormData).get('entri'))) as EntriPelanggaran[]
        st.pelanggaran = (st.pelanggaran ?? 0) + entri.filter((e) => e.jenis !== 'offline').length
        if (st.status === 'mengerjakan' && st.pelanggaran >= AMBANG) {
            st.status = 'terkunci'
            st.terkunciPada = Date.now()
        }
        simpan()

        return json({ status: st.status === 'terkunci' ? 'terkunci' : 'mengerjakan', jumlah_dihitung: st.pelanggaran, ambang: AMBANG })
    }
    if (jalur.endsWith(`/cbt/attempt/${ATTEMPT}/kumpul`)) {
        st.status = 'selesai'
        simpan()

        return json({ status: 'selesai' })
    }

    return json({ message: 'Belum tersedia di mode demo.', kode: 'DEMO' }, 404)
}
