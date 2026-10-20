import { describe, expect, it, vi } from 'vitest'
import { isShortcutPengawas, keluarAplikasi, keluarAplikasiTauri } from './native'

const tombol = (code: string, mod: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>>) => ({
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    code,
    ...mod,
})

describe('Shortcut Pengawas', () => {
    it('menerima Ctrl/Alt/Cmd + Shift + Q/X di Windows maupun macOS', () => {
        expect(isShortcutPengawas(tombol('KeyQ', { ctrlKey: true, shiftKey: true }))).toBe(true)
        expect(isShortcutPengawas(tombol('KeyX', { altKey: true, shiftKey: true }))).toBe(true)
        expect(isShortcutPengawas(tombol('KeyX', { metaKey: true, shiftKey: true }))).toBe(true)
    })

    it('tetap terdeteksi saat Option+Shift+Q di macOS menghasilkan karakter khusus', () => {
        // e.key bernilai "Œ", tetapi e.code tetap "KeyQ"
        expect(isShortcutPengawas(tombol('KeyQ', { altKey: true, shiftKey: true }))).toBe(true)
    })

    it('menolak kombinasi tanpa Shift atau tanpa modifier', () => {
        expect(isShortcutPengawas(tombol('KeyQ', { ctrlKey: true }))).toBe(false)
        expect(isShortcutPengawas(tombol('KeyQ', { shiftKey: true }))).toBe(false)
        expect(isShortcutPengawas(tombol('KeyW', { ctrlKey: true, shiftKey: true }))).toBe(false)
    })
})

describe('Utilitas Keluar Aplikasi', () => {
    it('mengekspor keluarAplikasi dan alias keluarAplikasiTauri', () => {
        expect(typeof keluarAplikasi).toBe('function')
        expect(keluarAplikasiTauri).toBe(keluarAplikasi)
    })

    it('memanggil window.close() jika window tersedia di lingkungan browser', async () => {
        const mockClose = vi.fn()
        // @ts-expect-error mock window in node environment
        globalThis.window = { close: mockClose }

        await keluarAplikasi()
        expect(mockClose).toHaveBeenCalled()

        // @ts-expect-error cleanup
        delete globalThis.window
    })
})
