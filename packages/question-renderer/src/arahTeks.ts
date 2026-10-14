import type { TiptapNode } from './types'

const ARAB = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g
const LATIN = /[A-Za-zÀ-ɏ]/g

/**
 * Arah satu paragraf: RTL hanya bila huruf Arab lebih banyak dari huruf
 * Latin. Aturan "huruf pertama" (dir=auto, unicode-bidi: plaintext) salah
 * untuk kalimat Indonesia yang diawali kata Arab — "الْعَلِيمُ artinya …"
 * — yang lazim di soal PAI: seluruh kalimatnya jadi rata kanan.
 * Di paragraf LTR, kata Arab tetap tampil benar oleh algoritme bidi.
 */
export function arahTeks(teks: string): 'rtl' | 'ltr' {
    const arab = teks.match(ARAB)?.length ?? 0
    if (arab === 0) return 'ltr'
    const latin = teks.match(LATIN)?.length ?? 0
    return arab > latin ? 'rtl' : 'ltr'
}

export function teksNode(node: TiptapNode): string {
    if (node.type === 'text') return node.text ?? ''
    return (node.content ?? []).map(teksNode).join(' ')
}
