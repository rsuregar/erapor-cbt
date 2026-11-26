import { Capacitor } from '@capacitor/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bersihkanServiceWorkerNative } from './pembaruanPwa'

describe('bersihkanServiceWorkerNative', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('tidak melakukan apa-apa dan mengembalikan false pada PWA (bukan native)', async () => {
        vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
        const getRegistrations = vi.fn()
        const keys = vi.fn()
        vi.stubGlobal('window', {})
        vi.stubGlobal('navigator', { serviceWorker: { controller: {}, getRegistrations } })
        vi.stubGlobal('caches', { keys, delete: vi.fn() })

        await expect(bersihkanServiceWorkerNative()).resolves.toBe(false)
        expect(getRegistrations).not.toHaveBeenCalled()
        expect(keys).not.toHaveBeenCalled()
    })

    it('melepas semua service worker, menghapus cache workbox tanpa menyentuh cbt-media, dan mengembalikan true bila dikontrol', async () => {
        vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
        const unregisterA = vi.fn().mockResolvedValue(true)
        const unregisterB = vi.fn().mockResolvedValue(true)
        const cacheDelete = vi.fn().mockResolvedValue(true)

        vi.stubGlobal('navigator', {
            serviceWorker: {
                controller: { scriptURL: 'https://localhost/sw.js' },
                getRegistrations: vi.fn().mockResolvedValue([{ unregister: unregisterA }, { unregister: unregisterB }]),
            },
        })
        vi.stubGlobal('caches', {
            keys: vi.fn().mockResolvedValue(['workbox-precache-v2-https://localhost/', 'cbt-media', 'lainnya']),
            delete: cacheDelete,
        })

        await expect(bersihkanServiceWorkerNative()).resolves.toBe(true)
        expect(unregisterA).toHaveBeenCalledOnce()
        expect(unregisterB).toHaveBeenCalledOnce()
        expect(cacheDelete).toHaveBeenCalledWith('workbox-precache-v2-https://localhost/')
        expect(cacheDelete).toHaveBeenCalledWith('lainnya')
        expect(cacheDelete).not.toHaveBeenCalledWith('cbt-media')
    })

    it('tetap membersihkan cache workbox yang tersisa meski registrasi kosong dan mengembalikan false', async () => {
        vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
        const cacheDelete = vi.fn().mockResolvedValue(true)
        vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
        vi.stubGlobal('navigator', {
            serviceWorker: {
                controller: null,
                getRegistrations: vi.fn().mockResolvedValue([]),
            },
        })
        vi.stubGlobal('caches', {
            keys: vi.fn().mockResolvedValue(['workbox-precache-v2-http://tauri.localhost/', 'cbt-media']),
            delete: cacheDelete,
        })

        await expect(bersihkanServiceWorkerNative()).resolves.toBe(false)
        expect(cacheDelete).toHaveBeenCalledOnce()
        expect(cacheDelete).toHaveBeenCalledWith('workbox-precache-v2-http://tauri.localhost/')
        expect(cacheDelete).not.toHaveBeenCalledWith('cbt-media')
    })
})
