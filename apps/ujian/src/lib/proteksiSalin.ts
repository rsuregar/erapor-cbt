import type { Doc } from '@erapor-cbt/exam-core'

type NodeDokumen = {
    type?: string
    text?: string
    attrs?: { latex?: unknown }
    content?: NodeDokumen[]
}

/** Ekstrak teks polos dari dokumen Tiptap (pertanyaan/bacaan), termasuk LaTeX pada node rumus. */
export function ekstrakTeksDokumen(doc: Doc | null | undefined): string {
    if (!doc) return ''
    const bagian: string[] = []

    const telusuri = (node: NodeDokumen | null | undefined) => {
        if (!node) return
        if (typeof node.text === 'string' && node.text.trim()) {
            bagian.push(node.text)
        }
        if ((node.type === 'inlineMath' || node.type === 'blockMath') && typeof node.attrs?.latex === 'string' && node.attrs.latex.trim()) {
            bagian.push(node.attrs.latex)
        }
        if (Array.isArray(node.content)) {
            for (const anak of node.content) telusuri(anak)
        }
    }

    telusuri(doc as NodeDokumen)
    return bagian.join(' ').replace(/\s+/g, ' ').trim()
}

export function normalisasiTeks(teks: string): string {
    return teks.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Ambil fragmen teks yang baru disisipkan antara `sebelum` dan `sesudah`. */
export function hitungSisipan(sebelum: string, sesudah: string): string {
    if (sesudah.length <= sebelum.length && sesudah === sebelum.slice(0, sesudah.length)) {
        return ''
    }

    let awal = 0
    const batas = Math.min(sebelum.length, sesudah.length)
    while (awal < batas && sebelum[awal] === sesudah[awal]) {
        awal += 1
    }

    let akhir = 0
    while (
        akhir < sebelum.length - awal &&
        akhir < sesudah.length - awal &&
        sebelum[sebelum.length - 1 - akhir] === sesudah[sesudah.length - 1 - akhir]
    ) {
        akhir += 1
    }

    return sesudah.slice(awal, sesudah.length - akhir)
}

/**
 * Deteksi tempelan (paste/clipboard keyboard HP) dari selisih perubahan kolom jawaban.
 * Ketikan normal 1 huruf, autocorrect singkat, atau swipe 1-2 kata tidak diblokir.
 */
export function terdeteksiTempel(opsi: {
    sebelum: string
    sesudah: string
    teksSoal?: string
}): { diblokir: boolean; alasan?: 'salin_soal' | 'tempel_massal' } {
    const sisipan = hitungSisipan(opsi.sebelum, opsi.sesudah)
    if (sisipan.length <= 1) return { diblokir: false }

    const sisipanNorm = normalisasiTeks(sisipan)
    const jumlahKata = sisipanNorm ? sisipanNorm.split(' ').length : 0

    if (opsi.teksSoal) {
        const soalNorm = normalisasiTeks(opsi.teksSoal)
        if (sisipanNorm.length >= 10 && jumlahKata >= 2 && soalNorm.includes(sisipanNorm)) {
            return { diblokir: true, alasan: 'salin_soal' }
        }
    }

    if (
        ((sisipan.includes('\n') || sisipan.includes('\r')) && sisipanNorm.length >= 8) ||
        (sisipanNorm.length >= 16 && jumlahKata >= 3) ||
        /(?:https?:\/\/|www\.)\S+/i.test(sisipanNorm)
    ) {
        return { diblokir: true, alasan: 'tempel_massal' }
    }

    return { diblokir: false }
}

const INPUT_TYPE_TEMPEL = new Set([
    'insertFromPaste',
    'insertFromPasteAsQuotation',
    'insertFromDrop',
    'insertFromYank',
    'deleteByCut',
])

export function adalahInputTypeTempel(inputType: string | null | undefined): boolean {
    return !!inputType && INPUT_TYPE_TEMPEL.has(inputType)
}

export function ekstrakTeksInputEvent(e: {
    data?: string | null
    dataTransfer?: { getData?: (type: string) => string } | null
}): string {
    if (typeof e.data === 'string' && e.data.length > 0) return e.data
    try {
        return e.dataTransfer?.getData?.('text/plain') ?? ''
    } catch {
        return ''
    }
}

export function adalahPintasanCopas(e: {
    key: string
    code?: string
    ctrlKey: boolean
    metaKey: boolean
    shiftKey?: boolean
}): 'copy' | 'cut' | 'paste' | null {
    const k = e.key.toLowerCase()
    if (e.ctrlKey || e.metaKey) {
        if (k === 'c' || e.code === 'KeyC') return 'copy'
        if ((k === 'x' || e.code === 'KeyX') && !e.shiftKey) return 'cut'
        if (k === 'v' || e.code === 'KeyV') return 'paste'
        if (e.ctrlKey && !e.metaKey && e.key === 'Insert') return 'copy'
    }
    if (e.shiftKey && e.key === 'Insert') return 'paste'
    if (e.shiftKey && e.key === 'Delete') return 'cut'
    return null
}

const INPUT_NON_TEKS = new Set(['radio', 'checkbox', 'button', 'submit', 'reset'])

export function adalahTargetIsian(target: EventTarget | null): boolean {
    if (!target || typeof (target as Element).closest !== 'function') return false
    const el = target as Element
    if (el.closest('textarea, [contenteditable="true"]')) return true
    const input = el.closest('input') as HTMLInputElement | null
    if (!input) return false
    const tipe = (input.type || 'text').toLowerCase()
    return !INPUT_NON_TEKS.has(tipe)
}

export function adalahNodeDiDalamIsian(node: unknown): boolean {
    if (!node || typeof node !== 'object') return false
    const n = node as { nodeType?: number; parentElement?: Element | null }
    const target = n.nodeType === 3 ? n.parentElement : (node as EventTarget)
    return adalahTargetIsian(target ?? null)
}
