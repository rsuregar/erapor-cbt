/**
 * Format soal CBT — sama dengan App\Services\Cbt\StrukturSoal (PHP).
 * Ubah keduanya bersamaan.
 */

export type TiptapMark = { type: string; attrs?: Record<string, any> }

export type TiptapNode = {
    type: string
    attrs?: Record<string, any>
    content?: TiptapNode[]
    text?: string
    marks?: TiptapMark[]
}

export type DokumenTiptap = TiptapNode & { type: 'doc' }

export type JenisSoal =
    | 'pilihan_ganda'
    | 'pg_stimulus'
    | 'pg_kompleks'
    | 'isian'
    | 'uraian'
    | 'studi_kasus'
    | 'menjodohkan'
    | 'benar_salah'

export type ItemKonten = { id: string; konten: DokumenTiptap }

export type OpsiPilihan = ItemKonten[]

export type OpsiBenarSalah = {
    label_benar: string
    label_salah: string
    pernyataan: ItemKonten[]
}

export type OpsiMenjodohkan = { kiri: ItemKonten[]; kanan: ItemKonten[] }

export type Opsi = OpsiPilihan | OpsiBenarSalah | OpsiMenjodohkan | null

/** Kunci TIDAK PERNAH dikirim ke perangkat murid; hanya dipakai pratinjau guru. */
export type Kunci =
    | { opsi: string }
    | { opsi: string[] }
    | Record<string, boolean>
    | Record<string, string>
    | { jawaban: string[]; abaikan_kapital?: boolean }
    | null

/** Jawaban murid per jenis. */
export type Jawaban =
    | string // pilihan_ganda, pg_stimulus (id opsi), isian, uraian, studi_kasus (teks)
    | string[] // pg_kompleks
    | Record<string, boolean> // benar_salah
    | Record<string, string> // menjodohkan: id kiri → id kanan
    | null

export type SoalTampil = {
    jenis: JenisSoal
    pertanyaan: DokumenTiptap
    opsi?: Opsi
    stimulus?: { judul?: string | null; konten: DokumenTiptap } | null
}

export const dokumenKosong = (): DokumenTiptap => ({
    type: 'doc',
    content: [{ type: 'paragraph' }],
})
