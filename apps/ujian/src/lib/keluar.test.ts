import { describe, expect, it, vi } from 'vitest'
import { keluarAplikasi, keluarAplikasiTauri } from './native'

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
