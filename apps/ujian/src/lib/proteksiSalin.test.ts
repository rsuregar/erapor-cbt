import { describe, expect, it } from 'vitest'
import {
    adalahInputTypeTempel,
    adalahNodeDiDalamIsian,
    adalahPintasanCopas,
    adalahTargetIsian,
    ekstrakTeksDokumen,
    ekstrakTeksInputEvent,
    hitungSisipan,
    terdeteksiTempel,
} from './proteksiSalin'

describe('ekstrakTeksDokumen', () => {
    it('mengekstrak teks paragraf, list bersarang, dan rumus inlineMath/blockMath', () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        { type: 'text', text: 'Jelaskan proses fotosintesis pada tumbuhan' },
                        { type: 'inlineMath', attrs: { latex: '6CO_2 + 6H_2O' } },
                    ],
                },
                {
                    type: 'bulletList',
                    content: [
                        {
                            type: 'listItem',
                            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sebutkan dua tahapannya.' }] }],
                        },
                    ],
                },
                { type: 'blockMath', attrs: { latex: 'E = mc^2' } },
            ],
        }

        expect(ekstrakTeksDokumen(doc)).toBe(
            'Jelaskan proses fotosintesis pada tumbuhan 6CO_2 + 6H_2O Sebutkan dua tahapannya. E = mc^2',
        )
    })

    it('mengembalikan string kosong untuk null atau undefined', () => {
        expect(ekstrakTeksDokumen(null)).toBe('')
        expect(ekstrakTeksDokumen(undefined)).toBe('')
    })
})

describe('hitungSisipan', () => {
    it('mendeteksi sisipan di akhir, awal, tengah, dan saat mengganti sebagian', () => {
        expect(hitungSisipan('halo ', 'halo dunia')).toBe('dunia')
        expect(hitungSisipan('dunia', 'halo dunia')).toBe('halo ')
        expect(hitungSisipan('ac', 'abc')).toBe('b')
        expect(hitungSisipan('jawaban lama', 'jawaban baru sekali')).toBe('baru sekali')
    })

    it('mengembalikan string kosong saat penghapusan murni', () => {
        expect(hitungSisipan('halo dunia', 'halo ')).toBe('')
    })
})

describe('terdeteksiTempel', () => {
    const teksSoal = 'Jelaskan mengapa peristiwa Rengasdengklok terjadi sebelum proklamasi kemerdekaan Indonesia!'

    it('mengizinkan ketikan normal satu huruf walau cocok dengan isi soal', () => {
        expect(
            terdeteksiTempel({
                sebelum: 'Jelaskan mengapa peristiw',
                sesudah: 'Jelaskan mengapa peristiwa',
                teksSoal,
            }),
        ).toEqual({ diblokir: false })
    })

    it('mengizinkan autocorrect satu kata panjang (< 3 kata)', () => {
        expect(
            terdeteksiTempel({
                sebelum: 'Saya menjawab ',
                sesudah: 'Saya menjawab tanggungjawab',
                teksSoal,
            }),
        ).toEqual({ diblokir: false })
    })

    it('memblokir tempelan potongan teks pertanyaan ke kolom jawaban (salin_soal)', () => {
        expect(
            terdeteksiTempel({
                sebelum: '',
                sesudah: 'peristiwa Rengasdengklok terjadi',
                teksSoal,
            }),
        ).toEqual({ diblokir: true, alasan: 'salin_soal' })
    })

    it('memblokir tempelan kalimat panjang dari luar (tempel_massal)', () => {
        expect(
            terdeteksiTempel({
                sebelum: 'Menurut saya ',
                sesudah: 'Menurut saya ini adalah jawaban lengkap dari catatan luar.',
                teksSoal,
            }),
        ).toEqual({ diblokir: true, alasan: 'tempel_massal' })
    })

    it('memblokir tempelan teks multibaris yang cukup panjang', () => {
        expect(
            terdeteksiTempel({
                sebelum: '',
                sesudah: 'Baris satu\nBaris kedua',
                teksSoal,
            }),
        ).toEqual({ diblokir: true, alasan: 'tempel_massal' })
    })

    it('memblokir tempelan pendek 3 kata (16+ char), potongan soal 2 kata (10+ char), dan URL, sambil mengizinkan 2 kata ketikan bebas', () => {
        expect(
            terdeteksiTempel({
                sebelum: '',
                sesudah: 'tiga kata panjang',
                teksSoal,
            }),
        ).toEqual({ diblokir: true, alasan: 'tempel_massal' })

        expect(
            terdeteksiTempel({
                sebelum: '',
                sesudah: 'proklamasi kemerdekaan',
                teksSoal,
            }),
        ).toEqual({ diblokir: true, alasan: 'salin_soal' })

        expect(
            terdeteksiTempel({
                sebelum: '',
                sesudah: 'https://contoh.id/catatan',
                teksSoal,
            }),
        ).toEqual({ diblokir: true, alasan: 'tempel_massal' })

        expect(
            terdeteksiTempel({
                sebelum: '',
                sesudah: 'dua kata',
                teksSoal,
            }),
        ).toEqual({ diblokir: false })
    })
})

describe('deteksi inputType, pintasan, dan target isian', () => {
    it('ekstrakTeksInputEvent membaca dataTransfer saat e.data null (khas WebKit iPadOS)', () => {
        expect(ekstrakTeksInputEvent({ data: 'teks langsung', dataTransfer: null })).toBe('teks langsung')
        expect(
            ekstrakTeksInputEvent({
                data: null,
                dataTransfer: { getData: (t) => (t === 'text/plain' ? 'hasil tempel webkit' : '') },
            }),
        ).toBe('hasil tempel webkit')
        expect(ekstrakTeksInputEvent({ data: null, dataTransfer: null })).toBe('')
    })

    it('adalahNodeDiDalamIsian mengenali Text node di dalam textarea vs di luar textarea', () => {
        const textareaMock = {
            closest: (sel: string) => (sel.includes('textarea') ? {} : null),
        } as unknown as Element
        const soalMock = {
            closest: () => null,
        } as unknown as Element

        expect(adalahNodeDiDalamIsian({ nodeType: 3, parentElement: textareaMock })).toBe(true)
        expect(adalahNodeDiDalamIsian({ nodeType: 3, parentElement: soalMock })).toBe(false)
        expect(adalahNodeDiDalamIsian(null)).toBe(false)
    })
    it('mengenali inputType tempel dan potong', () => {
        expect(adalahInputTypeTempel('insertFromPaste')).toBe(true)
        expect(adalahInputTypeTempel('insertFromPasteAsQuotation')).toBe(true)
        expect(adalahInputTypeTempel('insertFromDrop')).toBe(true)
        expect(adalahInputTypeTempel('insertFromYank')).toBe(true)
        expect(adalahInputTypeTempel('deleteByCut')).toBe(true)
        expect(adalahInputTypeTempel('insertText')).toBe(false)
        expect(adalahInputTypeTempel(undefined)).toBe(false)
    })

    it('mengenali pintasan copas Windows, macOS, Shift+Insert, Ctrl+Insert, Ctrl+Shift+V', () => {
        expect(adalahPintasanCopas({ key: 'c', ctrlKey: true, metaKey: false })).toBe('copy')
        expect(adalahPintasanCopas({ key: 'X', ctrlKey: false, metaKey: true })).toBe('cut')
        expect(adalahPintasanCopas({ key: 'V', ctrlKey: true, metaKey: false, shiftKey: true })).toBe('paste')
        expect(adalahPintasanCopas({ key: 'Insert', ctrlKey: false, metaKey: false, shiftKey: true })).toBe('paste')
        expect(adalahPintasanCopas({ key: 'Insert', ctrlKey: true, metaKey: false })).toBe('copy')
        expect(adalahPintasanCopas({ key: 'Delete', ctrlKey: false, metaKey: false, shiftKey: true })).toBe('cut')
        expect(adalahPintasanCopas({ key: 'a', ctrlKey: true, metaKey: false })).toBeNull()
        // Pintasan pengawas Ctrl+Shift+X / Cmd+Shift+X tidak boleh diblokir sebagai Cut.
        expect(adalahPintasanCopas({ key: 'X', code: 'KeyX', ctrlKey: true, metaKey: false, shiftKey: true })).toBeNull()
        expect(adalahPintasanCopas({ key: 'x', code: 'KeyX', ctrlKey: false, metaKey: true, shiftKey: true })).toBeNull()
    })

    it('adalahTargetIsian aman untuk null/non-element di lingkungan Node', () => {
        expect(adalahTargetIsian(null)).toBe(false)
        expect(adalahTargetIsian({} as EventTarget)).toBe(false)
    })
})
