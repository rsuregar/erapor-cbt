import { describe, expect, it, vi } from 'vitest'
import { bisaBukaPengaturanWifi, isShortcutPengawas, jumlahMonitor, keluarAplikasi, keluarAplikasiTauri, validasiPinPengawas } from './native'

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

    it('memvalidasi PIN pengawas dengan trim dan menolak PIN salah', () => {
        expect(validasiPinPengawas('778899')).toBe(true)
        expect(validasiPinPengawas(' alakhyar ')).toBe(true)
        expect(validasiPinPengawas('salah')).toBe(false)
        expect(validasiPinPengawas('')).toBe(false)
    })

    it('bisaBukaPengaturanWifi bernilai false di browser biasa dan true di Tauri', () => {
        expect(bisaBukaPengaturanWifi()).toBe(false)
        // @ts-expect-error mock tauri internals in node environment
        globalThis.window = { __TAURI_INTERNALS__: {} }
        expect(bisaBukaPengaturanWifi()).toBe(true)
        // @ts-expect-error cleanup
        delete globalThis.window
    })

    it('jumlahMonitor mendeteksi screen.isExtended di browser', async () => {
        const asli = globalThis.screen
        // @ts-expect-error mock screen in node environment
        globalThis.screen = { isExtended: true }
        expect(await jumlahMonitor()).toBe(2)
        // @ts-expect-error mock screen in node environment
        globalThis.screen = { isExtended: false }
        expect(await jumlahMonitor()).toBe(1)
        globalThis.screen = asli
    })
})
