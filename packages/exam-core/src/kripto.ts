import type { IsiPaket, PaketTerenkripsi } from './kontrak'

/**
 * Dekripsi paket soal (AES-256-GCM, WebCrypto) persis seperti kontrak:
 * kunci dari /mulai, iv & aad dari paket, isi = ciphertext ‖ tag.
 * AAD mengikat paket ke murid — paket murid lain gagal didekripsi.
 */
export async function dekripsiPaket(paket: PaketTerenkripsi, kunciBase64: string): Promise<IsiPaket> {
    if (paket.algoritma !== 'AES-256-GCM') {
        throw new Error(`Algoritma paket tidak dikenal: ${paket.algoritma}`)
    }
    const subtle = globalThis.crypto.subtle
    const kunci = await subtle.importKey('raw', dariBase64(kunciBase64), 'AES-GCM', false, ['decrypt'])
    const isi = await subtle.decrypt(
        { name: 'AES-GCM', iv: dariBase64(paket.iv), additionalData: new TextEncoder().encode(paket.aad) },
        kunci,
        dariBase64(paket.isi),
    )

    return JSON.parse(new TextDecoder().decode(isi)) as IsiPaket
}

export function dariBase64(teks: string): Uint8Array<ArrayBuffer> {
    const biner = atob(teks)
    const hasil = new Uint8Array(biner.length)
    for (let i = 0; i < biner.length; i++) hasil[i] = biner.charCodeAt(i)

    return hasil
}

export function keBase64(data: Uint8Array): string {
    let biner = ''
    for (let i = 0; i < data.length; i++) biner += String.fromCharCode(data[i])

    return btoa(biner)
}
