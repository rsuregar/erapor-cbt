import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AMBANG_JEDA_FRAME_IOS_MS, INTERVAL_CEK_FRAME_IOS_MS, KONFIRMASI_BLUR_IOS_MS } from './deteksiKepergian'
import { pasangPengawasKepergian, pasangPengawasLayarDibagi, pasangPengawasLayarPenuh } from './usePelanggaran'
import { pasangProteksiKonten } from './useProteksiKonten'

type StateDom = {
    visibilityState: 'visible' | 'hidden'
    focused: boolean
    fullscreenElement: object | null
}

function buatLingkunganDom(awal: Partial<StateDom> = {}) {
    const state: StateDom = {
        visibilityState: awal.visibilityState ?? 'visible',
        focused: awal.focused ?? true,
        fullscreenElement: awal.fullscreenElement ?? null,
    }
    const targetWin = new EventTarget()
    const targetDoc = new EventTarget()
    const bersihkanKelas = vi.fn()
    const tambahKelas = vi.fn()

    const selectionMock = { isCollapsed: true, anchorNode: null as unknown, focusNode: null as unknown, removeAllRanges: vi.fn() }
    const winMock = Object.assign(targetWin, {
        getSelection: () => selectionMock,
        addEventListener: targetWin.addEventListener.bind(targetWin),
        removeEventListener: targetWin.removeEventListener.bind(targetWin),
        dispatchEvent: targetWin.dispatchEvent.bind(targetWin),
    })

    const docMock = Object.assign(targetDoc, {
        hasFocus: () => state.focused,
        activeElement: null,
        body: { classList: { add: tambahKelas, remove: bersihkanKelas } },
        addEventListener: targetDoc.addEventListener.bind(targetDoc),
        removeEventListener: targetDoc.removeEventListener.bind(targetDoc),
        dispatchEvent: targetDoc.dispatchEvent.bind(targetDoc),
    }) as EventTarget & {
        readonly visibilityState: 'visible' | 'hidden'
        readonly fullscreenElement: object | null
        hasFocus: () => boolean
        activeElement: unknown
        body: { classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } }
    }
    Object.defineProperties(docMock, {
        visibilityState: { get: () => state.visibilityState, configurable: true },
        fullscreenElement: { get: () => state.fullscreenElement, configurable: true },
    })

    const navMock = {
        onLine: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        maxTouchPoints: 0,
        clipboard: {
            writeText: vi.fn().mockResolvedValue(undefined),
        },
    }

    vi.stubGlobal('window', winMock)
    vi.stubGlobal('document', docMock)
    vi.stubGlobal('navigator', navMock)

    const buatEvent = (tipe: string, props: Record<string, unknown> = {}) => {
        const ev = new Event(tipe, { cancelable: true, bubbles: true })
        for (const [k, v] of Object.entries(props)) {
            if (k === 'target') {
                Object.defineProperty(ev, k, { value: v, configurable: true })
            } else {
                ;(ev as unknown as Record<string, unknown>)[k] = v
            }
        }
        return ev
    }

    return {
        state,
        winMock,
        docMock,
        navMock,
        selectionMock,
        buatEvent,
        emitFocus: () => {
            state.focused = true
            winMock.dispatchEvent(buatEvent('focus'))
        },
        emitBlur: () => {
            state.focused = false
            winMock.dispatchEvent(buatEvent('blur'))
        },
        emitVisibility: (v: 'visible' | 'hidden') => {
            state.visibilityState = v
            docMock.dispatchEvent(buatEvent('visibilitychange'))
        },
        emitFullscreen: (el: object | null) => {
            state.fullscreenElement = el
            docMock.dispatchEvent(buatEvent('fullscreenchange'))
        },
    }
}

const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('E2E pencegahan false positive pelanggaran & proteksi konten', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-11-26T09:00:00Z'))
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('1. Web PWA: focus & visibilitychange tidak pernah memanggil navigator.clipboard.writeText', () => {
        const env = buatLingkunganDom()
        const kontrol = pasangProteksiKonten({
            kabari: vi.fn(),
            pakaiTauri: false,
            pakaiNative: false,
        })

        env.emitBlur()
        env.emitFocus()
        env.emitVisibility('hidden')
        env.emitVisibility('visible')

        expect(env.navMock.clipboard.writeText).not.toHaveBeenCalled()
        kontrol.lepas()
    })

    it('2. Tauri: window.focus memanggil bersihkanClipboard native tanpa menyentuh navigator.clipboard.writeText', () => {
        const env = buatLingkunganDom()
        const bersihkanNative = vi.fn()
        const kontrol = pasangProteksiKonten({
            kabari: vi.fn(),
            pakaiTauri: true,
            pakaiNative: false,
            bersihkanClipboard: bersihkanNative,
        })

        env.emitFocus()
        env.emitVisibility('visible')

        expect(bersihkanNative).toHaveBeenCalledTimes(2)
        expect(env.navMock.clipboard.writeText).not.toHaveBeenCalled()
        kontrol.lepas()
    })

    it('3. Tauri: popup internal WebView2 (window.blur 8 dtk saat OS window tetap fokus) menghasilkan 0 pelanggaran', async () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()
        let onFocusTauri: ((e: { payload: boolean }) => void) | undefined

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: true,
            pantauBlur: false,
            msSejakMulai: () => 10_000,
            onCatat,
            bacaPlatform: () => 'pwa',
            imporJendelaTauri: async () => ({
                isFocused: async () => true,
                onFocusChanged: async (cb) => {
                    onFocusTauri = cb
                    return vi.fn()
                },
            }),
        })
        await flushMicrotasks()

        // Simulasi popup internal WebView2 memicu DOM blur/focus tanpa kehilangan fokus OS Tauri.
        expect(onFocusTauri).toBeDefined()
        env.emitBlur()
        vi.advanceTimersByTime(8000)
        env.emitFocus()

        expect(onCatat).not.toHaveBeenCalled()
        lepas()
    })

    it('4. Tauri: Alt+Tab singkat 3 dtk = 0 pelanggaran; Alt+Tab nyata 6 dtk = 1 pelanggaran', async () => {
        buatLingkunganDom()
        const onCatat = vi.fn()
        let onFocusTauri: ((e: { payload: boolean }) => void) | undefined

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: true,
            pantauBlur: false,
            msSejakMulai: () => 15_000,
            onCatat,
            bacaPlatform: () => 'pwa',
            imporJendelaTauri: async () => ({
                isFocused: async () => true,
                onFocusChanged: async (cb) => {
                    onFocusTauri = cb
                    return vi.fn()
                },
            }),
        })
        await flushMicrotasks()

        // Alt+Tab singkat 3 detik -> ditoleransi
        onFocusTauri!( { payload: false } )
        vi.advanceTimersByTime(3000)
        onFocusTauri!( { payload: true } )
        expect(onCatat).not.toHaveBeenCalled()

        // Alt+Tab nyata 6 detik -> tercatat
        onFocusTauri!( { payload: false } )
        vi.advanceTimersByTime(6000)
        onFocusTauri!( { payload: true } )
        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledWith('pindah_tab', 15_000, 6000)
        lepas()
    })

    it('5. PWA: notifikasi / salah klik singkat 4 dtk menghasilkan 0 pelanggaran', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            msSejakMulai: () => 20_000,
            onCatat,
            bacaPlatform: () => 'pwa',
        })

        env.emitBlur()
        vi.advanceTimersByTime(4000)
        env.emitFocus()

        expect(onCatat).not.toHaveBeenCalled()
        lepas()
    })

    it('6. PWA: intip cepat 3x dalam 2 menit memicu pelanggaran ke-3 dan reset setelah lewat 2 menit', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            msSejakMulai: () => 30_000,
            onCatat,
            bacaPlatform: () => 'pwa',
        })

        // Intip 1 & 2 (3 dtk tiap kali, jarak 30 dtk) -> belum dicatat
        env.emitBlur()
        vi.advanceTimersByTime(3000)
        env.emitFocus()
        expect(onCatat).toHaveBeenCalledTimes(0)

        vi.advanceTimersByTime(30_000)
        env.emitBlur()
        vi.advanceTimersByTime(3000)
        env.emitFocus()
        expect(onCatat).toHaveBeenCalledTimes(0)

        // Intip ke-3 dalam 2 menit -> dicatat
        vi.advanceTimersByTime(30_000)
        env.emitBlur()
        vi.advanceTimersByTime(3000)
        env.emitFocus()
        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledWith('pindah_tab', 30_000, 3000)

        // Lewat > 2 menit, satu kali intip 3 dtk lagi tidak memicu
        vi.advanceTimersByTime(150_000)
        env.emitBlur()
        vi.advanceTimersByTime(3000)
        env.emitFocus()
        expect(onCatat).toHaveBeenCalledTimes(1)
        lepas()
    })

    it('7. Fullscreen: keluar lalu masuk lagi dalam 3 dtk menghasilkan 0 pelanggaran', () => {
        const fsEl = {}
        const env = buatLingkunganDom({ fullscreenElement: fsEl })
        const onCatat = vi.fn()

        const lp = pasangPengawasLayarPenuh({
            msSejakMulai: () => 40_000,
            sedangPergi: () => false,
            onCatat,
        })

        env.emitFullscreen(null)
        vi.advanceTimersByTime(3000)
        env.emitFullscreen(fsEl)
        vi.advanceTimersByTime(5000)

        expect(onCatat).not.toHaveBeenCalled()
        lp.lepas()
    })

    it('8. Race condition Fullscreen + Alt+Tab singkat 4.5 dtk menghasilkan 0 keluar_layar_penuh dan 0 pindah_tab', () => {
        const fsEl = {}
        const env = buatLingkunganDom({ fullscreenElement: fsEl })
        const onCatat = vi.fn()
        let sedangPergi = false
        let lp: ReturnType<typeof pasangPengawasLayarPenuh>

        const lepasPergi = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            msSejakMulai: () => 50_000,
            onPergi: () => {
                sedangPergi = true
                lp.batal()
            },
            onKembali: () => {
                sedangPergi = false
            },
            onCatat,
            bacaPlatform: () => 'pwa',
        })
        lp = pasangPengawasLayarPenuh({
            msSejakMulai: () => 50_000,
            sedangPergi: () => sedangPergi,
            onCatat,
        })

        // Fullscreen lepas 10 ms sebelum Alt+Tab (window.blur)
        env.emitFullscreen(null)
        vi.advanceTimersByTime(10)
        env.emitBlur()
        vi.advanceTimersByTime(4500)
        env.emitFocus()
        // Tunggu lagi 5 detik setelah kembali: timer fullscreen lama sudah dibatalkan sehingga tidak meledak belakangan.
        vi.advanceTimersByTime(5000)

        expect(onCatat).not.toHaveBeenCalled()
        lp.lepas()
        lepasPergi()
    })

    it('9. Fullscreen + Alt+Tab nyata 7 dtk hanya mencatat 1 pindah_tab (bukan hukuman ganda)', () => {
        const fsEl = {}
        const env = buatLingkunganDom({ fullscreenElement: fsEl })
        const onCatat = vi.fn()
        let sedangPergi = false
        let lp: ReturnType<typeof pasangPengawasLayarPenuh>

        const lepasPergi = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            msSejakMulai: () => 60_000,
            onPergi: () => {
                sedangPergi = true
                lp.batal()
            },
            onKembali: () => {
                sedangPergi = false
            },
            onCatat,
            bacaPlatform: () => 'pwa',
        })
        lp = pasangPengawasLayarPenuh({
            msSejakMulai: () => 60_000,
            sedangPergi: () => sedangPergi,
            onCatat,
        })

        env.emitFullscreen(null)
        env.emitBlur()
        vi.advanceTimersByTime(7000)
        env.emitFocus()

        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledWith('pindah_tab', 60_000, 7000)
        lp.lepas()
        lepasPergi()
    })

    it('10. Keluar fullscreen sengaja sambil tetap fokus >= 5 dtk mencatat tepat 1 keluar_layar_penuh', () => {
        const fsEl = {}
        const env = buatLingkunganDom({ fullscreenElement: fsEl })
        const onCatat = vi.fn()

        const lp = pasangPengawasLayarPenuh({
            msSejakMulai: () => 70_000,
            sedangPergi: () => false,
            onCatat,
        })

        env.emitFullscreen(null)
        vi.advanceTimersByTime(5000)

        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledWith('keluar_layar_penuh', 70_000, 5000)
        lp.lepas()
    })

    it('11. Timeout 90 dtk bukaPengaturanWifi tidak memulihkan prematur saat app Android/Tauri masih di latar', async () => {
        // 11a. Cabang Android
        {
            vi.resetModules()
            const env = buatLingkunganDom({ visibilityState: 'visible', focused: true })
            let appStateCb: ((s: { isActive: boolean }) => void) | undefined
            vi.doMock('@capacitor/core', () => ({
                Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true, convertFileSrc: (p: string) => p },
                registerPlugin: () => ({
                    bukaPengaturanWifi: vi.fn().mockImplementation(async () => {
                        env.state.visibilityState = 'hidden'
                        appStateCb?.({ isActive: false })
                        return { mode: 'panel' }
                    }),
                }),
            }))
            vi.doMock('@capacitor/app', () => ({
                App: {
                    addListener: vi.fn().mockImplementation(async (_ev: string, cb: (s: { isActive: boolean }) => void) => {
                        appStateCb = cb
                        return { remove: vi.fn().mockResolvedValue(undefined) }
                    }),
                },
            }))

            const { bukaPengaturanWifi } = await import('./native')
            const onKembali = vi.fn()
            await bukaPengaturanWifi({ pulihkanKiosk: true, onKembali })

            vi.advanceTimersByTime(95_000)
            expect(onKembali).not.toHaveBeenCalled()

            // Saat pengawas kembali ke app -> baru onKembali terpanggil.
            env.state.visibilityState = 'visible'
            appStateCb?.({ isActive: true })
            expect(onKembali).toHaveBeenCalledTimes(1)
        }

        // 11b. Cabang Tauri
        {
            vi.resetModules()
            const env = buatLingkunganDom({ visibilityState: 'visible', focused: true })
            ;(env.winMock as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
            let tauriFocused = false
            let focusCb: ((e: { payload: boolean }) => void) | undefined

            vi.doMock('@capacitor/core', () => ({
                Capacitor: { getPlatform: () => 'web', isNativePlatform: () => false, convertFileSrc: (p: string) => p },
                registerPlugin: () => ({}),
            }))
            vi.doMock('@tauri-apps/api/window', () => ({
                getCurrentWindow: () => ({
                    isFocused: async () => tauriFocused,
                    setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
                    setFullscreen: vi.fn().mockResolvedValue(undefined),
                    onFocusChanged: vi.fn().mockImplementation(async (cb: (e: { payload: boolean }) => void) => {
                        focusCb = cb
                        return vi.fn()
                    }),
                }),
            }))
            const invokeMock = vi.fn().mockResolvedValue(undefined)
            vi.doMock('@tauri-apps/api/core', () => ({
                invoke: invokeMock,
            }))

            const { bukaPengaturanWifi } = await import('./native')
            const onKembali = vi.fn()
            await bukaPengaturanWifi({ pulihkanKiosk: true, onKembali })
            expect(invokeMock).toHaveBeenCalledWith('atur_kios_macos', { aktif: false })

            // Jendela masih tidak fokus saat 90 dtk lewat -> belum memulihkan
            focusCb?.({ payload: false })
            vi.advanceTimersByTime(95_000)
            await flushMicrotasks()
            expect(onKembali).not.toHaveBeenCalled()

            // Kembali fokus -> selesai & pulih
            tauriFocused = true
            focusCb?.({ payload: true })
            expect(invokeMock).toHaveBeenCalledWith('atur_kios_macos', { aktif: true })
            expect(onKembali).toHaveBeenCalledTimes(1)
        }
    })

    it('12. IME composition & Undo tidak diblokir, sedangkan event paste nyata tetap diblokir', () => {
        const env = buatLingkunganDom()
        const lapor = vi.fn()
        const kabari = vi.fn()
        let terakhirUndo = -Infinity
        let sedangKomposisi = false
        let terakhirKomposisi = -Infinity

        const kontrol = pasangProteksiKonten({
            lapor,
            kabari,
            soalAktif: () => 3,
            onCatatUndo: () => {
                terakhirUndo = performance.now()
            },
            onKomposisiMulai: () => {
                sedangKomposisi = true
            },
            onKomposisiSelesai: () => {
                sedangKomposisi = false
                terakhirKomposisi = performance.now()
            },
            pakaiTauri: false,
            pakaiNative: false,
        })
        const sedangAmanInput = () =>
            performance.now() - terakhirUndo < 800 ||
            sedangKomposisi ||
            performance.now() - terakhirKomposisi < 800

        expect(sedangAmanInput()).toBe(false)

        // IME composing (mis. keyboard Arab/Gboard) tidak diblokir pada beforeinput
        env.docMock.dispatchEvent(env.buatEvent('compositionstart'))
        expect(sedangAmanInput()).toBe(true)

        const imeEvent = env.buatEvent('beforeinput', {
            inputType: 'insertText',
            isComposing: true,
            data: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
        })
        env.docMock.dispatchEvent(imeEvent)
        expect(imeEvent.defaultPrevented).toBe(false)

        env.docMock.dispatchEvent(env.buatEvent('compositionend'))
        expect(sedangAmanInput()).toBe(true)
        vi.advanceTimersByTime(500)
        expect(sedangAmanInput()).toBe(true)
        vi.advanceTimersByTime(400)
        expect(sedangAmanInput()).toBe(false)

        // Ctrl+Z memberi jendela aman 800ms
        env.docMock.dispatchEvent(env.buatEvent('keydown', { key: 'z', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }))
        expect(performance.now() - terakhirUndo < 800).toBe(true)
        vi.advanceTimersByTime(900)
        expect(performance.now() - terakhirUndo < 800).toBe(false)

        // Event paste nyata tetap diblokir
        const pasteEvent = env.buatEvent('paste')
        env.docMock.dispatchEvent(pasteEvent)
        expect(pasteEvent.defaultPrevented).toBe(true)
        expect(kabari).toHaveBeenCalled()

        kontrol.lepas()
        expect(lapor).toHaveBeenCalledWith('salin_diblokir', expect.objectContaining({ aksi: 'paste', diblokir: true, soal: 3 }))
    })

    it('13. iPad PWA: Slide Over / Floating Menu (window.blur saat visibilityState tetap visible) memicu tirai fokus & mencatat pindah_tab setelah >= 5 dtk', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()
        const onFokusBerubah = vi.fn()

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            konfirmasiBlurMs: KONFIRMASI_BLUR_IOS_MS,
            intervalCekFokusMs: 500,
            msSejakMulai: () => 80_000,
            onFokusBerubah,
            onCatat,
            bacaPlatform: () => 'pwa',
        })

        // Slide Over dibuka: visibilityState tetap 'visible', hanya blur + hasFocus() === false
        env.emitBlur()
        vi.advanceTimersByTime(KONFIRMASI_BLUR_IOS_MS)
        expect(onFokusBerubah).toHaveBeenLastCalledWith(true)

        vi.advanceTimersByTime(6000)
        env.emitFocus()

        expect(onFokusBerubah).toHaveBeenLastCalledWith(false)
        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledWith('pindah_tab', 80_000, 6000 + KONFIRMASI_BLUR_IOS_MS)
        lepas()
    })

    it('14. iPad PWA: glitch blur < 250ms (mis. unmount input) menghasilkan 0 pelanggaran dan tidak memicu tirai', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()
        const onFokusBerubah = vi.fn()

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            konfirmasiBlurMs: KONFIRMASI_BLUR_IOS_MS,
            intervalCekFokusMs: 500,
            msSejakMulai: () => 85_000,
            onFokusBerubah,
            onCatat,
            bacaPlatform: () => 'pwa',
        })

        env.emitBlur()
        vi.advanceTimersByTime(100)
        env.emitFocus()
        vi.advanceTimersByTime(6000)

        expect(onFokusBerubah).not.toHaveBeenCalled()
        expect(onCatat).not.toHaveBeenCalled()
        lepas()
    })

    it('15. iPad PWA: WebKit tidak menembakkan blur/focus (hanya hasFocus() berubah) tetap tertangkap watchdog & touchstart', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()
        const onFokusBerubah = vi.fn()

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            konfirmasiBlurMs: KONFIRMASI_BLUR_IOS_MS,
            intervalCekFokusMs: 500,
            msSejakMulai: () => 90_000,
            onFokusBerubah,
            onCatat,
            bacaPlatform: () => 'pwa',
        })

        // Control Center / Floating Menu: hanya document.hasFocus() yang turun tanpa event blur
        env.state.focused = false
        vi.advanceTimersByTime(500 + KONFIRMASI_BLUR_IOS_MS)
        expect(onFokusBerubah).toHaveBeenLastCalledWith(true)

        vi.advanceTimersByTime(6000)
        // Kembali tanpa event focus: pengguna mengetuk tirai (touchstart saat hasFocus() sudah true)
        env.state.focused = true
        env.winMock.dispatchEvent(env.buatEvent('touchstart'))

        expect(onFokusBerubah).toHaveBeenLastCalledWith(false)
        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat.mock.calls[0]?.[0]).toBe('pindah_tab')
        lepas()
    })

    it('16. iPad Split View: >= 2 dtk mencatat ukuran_layar tanpa hukuman ganda pindah_tab, dan rotasi < 300ms diabaikan', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()
        const onStatusBerubah = vi.fn()
        let terbagi = false
        let sudahCatatSplit = false
        let sedangPergi = false

        const lepasPergi = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            konfirmasiBlurMs: KONFIRMASI_BLUR_IOS_MS,
            msSejakMulai: () => 100_000,
            onPergi: () => {
                sedangPergi = true
            },
            onKembali: () => {
                sedangPergi = false
            },
            abaikanCatatSekali: () => {
                if (!sudahCatatSplit) return false
                sudahCatatSplit = false
                return true
            },
            onCatat,
            bacaPlatform: () => 'pwa',
        })

        const lepasSplit = pasangPengawasLayarDibagi({
            cekLayarDibagi: () => terbagi,
            msSejakMulai: () => 100_000,
            onStatusBerubah: (aktif) => {
                onStatusBerubah(aktif)
                if (aktif || !sedangPergi) sudahCatatSplit = false
            },
            onCatat: (jenis, mulaiMs, durasiMs) => {
                sudahCatatSplit = true
                onCatat(jenis, mulaiMs, durasiMs)
            },
            debounceMasukMs: 300,
            intervalCekMs: 1000,
        })

        // Rotasi layar 150ms -> tidak memicu tirai / pelanggaran
        terbagi = true
        env.winMock.dispatchEvent(env.buatEvent('resize'))
        vi.advanceTimersByTime(150)
        terbagi = false
        env.winMock.dispatchEvent(env.buatEvent('resize'))
        vi.advanceTimersByTime(6000)
        expect(onStatusBerubah).not.toHaveBeenCalled()
        expect(onCatat).not.toHaveBeenCalled()

        // Split View nyata + tap aplikasi sebelah selama 7 detik -> ukuran_layar tercatat pada 2 dtk
        terbagi = true
        env.winMock.dispatchEvent(env.buatEvent('resize'))
        vi.advanceTimersByTime(300)
        expect(onStatusBerubah).toHaveBeenLastCalledWith(true)

        env.emitBlur()
        vi.advanceTimersByTime(2000)
        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledWith('ukuran_layar', 100_000, 2000)

        // Kembali fokus & tutup Split View -> tidak menambah pindah_tab ganda
        vi.advanceTimersByTime(5000)
        terbagi = false
        env.winMock.dispatchEvent(env.buatEvent('resize'))
        env.emitFocus()
        expect(onStatusBerubah).toHaveBeenLastCalledWith(false)
        expect(onCatat).toHaveBeenCalledTimes(1)

        lepasSplit()
        lepasPergi()
    })

    it('17. iPad Split View intip cepat 3x (< 2 dtk) dalam 2 menit memicu ukuran_layar pada kali ke-3', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()
        let terbagi = false

        const lepasSplit = pasangPengawasLayarDibagi({
            cekLayarDibagi: () => terbagi,
            msSejakMulai: () => 110_000,
            onCatat,
            debounceMasukMs: 300,
            intervalCekMs: 1000,
        })

        for (let i = 0; i < 3; i++) {
            terbagi = true
            env.winMock.dispatchEvent(env.buatEvent('resize'))
            vi.advanceTimersByTime(300 + 1200)
            terbagi = false
            env.winMock.dispatchEvent(env.buatEvent('resize'))
            vi.advanceTimersByTime(2000)
        }

        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledWith('ukuran_layar', 110_000, 1200)
        lepasSplit()
    })

    it('18. Proteksi salin-tempel berlapis: rollback input non-cancelable, insertReplacementText dataTransfer, dan selectionchange di luar isian', () => {
        const env = buatLingkunganDom()
        const lapor = vi.fn()
        const kabari = vi.fn()

        const kontrol = pasangProteksiKonten({
            lapor,
            kabari,
            soalAktif: () => 5,
            teksSoalAktif: () => 'Apa ibu kota Indonesia?',
            pakaiTauri: false,
            pakaiNative: false,
        })

        const textareaMock = {
            tagName: 'TEXTAREA',
            value: 'Jawaban awal',
            selectionStart: 12,
            selectionEnd: 12,
            setSelectionRange: vi.fn(),
            closest: (sel: string) => (sel.includes('textarea') ? textareaMock : null),
        } as unknown as HTMLTextAreaElement

        // Simulasi paste non-cancelable iOS: paste diblokir, tapi WebKit tetap mengubah value dan menembakkan input
        const pasteEv = env.buatEvent('paste', { target: textareaMock })
        env.docMock.dispatchEvent(pasteEv)
        expect(pasteEv.defaultPrevented).toBe(true)

        textareaMock.value = 'Jawaban awal tempelan rahasia dari catatan'
        const inputEv = env.buatEvent('input', { target: textareaMock, inputType: 'insertFromPaste' })
        env.docMock.dispatchEvent(inputEv)
        expect(textareaMock.value).toBe('Jawaban awal')

        // Simulasi QuickType / Scan Text (insertReplacementText) dengan data: null dan dataTransfer terisi
        const repEv = env.buatEvent('beforeinput', {
            target: textareaMock,
            inputType: 'insertReplacementText',
            isComposing: false,
            data: null,
            dataTransfer: { getData: () => 'tempelan jawaban panjang dari keyboard' },
        })
        env.docMock.dispatchEvent(repEv)
        expect(repEv.defaultPrevented).toBe(true)

        // Simulasi selectionchange saat textarea fokus, tetapi seleksi berada pada teks soal (bukan textarea)
        env.docMock.activeElement = textareaMock
        env.selectionMock.isCollapsed = false
        env.selectionMock.anchorNode = { nodeType: 3, parentElement: { closest: () => null } }
        env.selectionMock.focusNode = { nodeType: 3, parentElement: { closest: () => null } }
        env.docMock.dispatchEvent(env.buatEvent('selectionchange'))
        expect(env.selectionMock.removeAllRanges).toHaveBeenCalledTimes(1)

        kontrol.lepas()
        expect(lapor).toHaveBeenCalledWith('salin_diblokir', expect.objectContaining({ aksi: 'paste', diblokir: true, soal: 5 }))
    })

    it('19. iOS PWA App Switcher 7 dtk saat WebKit membekukan performance.now() tetap tercatat sebagai pindah_tab (bukan layar_mati)', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()
        let monoNow = 10_000
        const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => monoNow)

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            jenisPerangkat: 'ios',
            konfirmasiBlurMs: KONFIRMASI_BLUR_IOS_MS,
            intervalCekFokusMs: 500,
            msSejakMulai: () => 120_000,
            onCatat,
            bacaPlatform: () => 'pwa',
        })

        // Masuk App Switcher: visibilityState menjadi hidden, lalu iOS membekukan WebKit sehingga
        // performance.now() hanya maju 150ms sementara jam dinding maju 7 detik.
        env.emitVisibility('hidden')
        vi.setSystemTime(new Date(Date.now() + 7000))
        monoNow += 150
        env.emitVisibility('visible')

        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledWith('pindah_tab', 120_000, 7000)

        perfSpy.mockRestore()
        lepas()
    })

    it('20. iOS PWA App Switcher intip cepat 3x (masing-masing 600ms) dalam 2 menit memicu pindah_tab pada kali ke-3', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            jenisPerangkat: 'ios',
            konfirmasiBlurMs: KONFIRMASI_BLUR_IOS_MS,
            intervalCekFokusMs: 500,
            msSejakMulai: () => 130_000,
            onCatat,
            bacaPlatform: () => 'pwa',
        })

        for (let i = 0; i < 3; i++) {
            env.emitVisibility('hidden')
            vi.advanceTimersByTime(600)
            env.emitVisibility('visible')
            vi.advanceTimersByTime(2000)
        }

        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledWith('pindah_tab', 130_000, 600)
        lepas()
    })

    it('21. iPhone/iPad slide side: window.blur saat WebKit membiarkan document.hasFocus() === true tetap memicu tirai & mencatat pindah_tab', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()
        const onFokusBerubah = vi.fn()

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            jenisPerangkat: 'ios',
            konfirmasiBlurMs: KONFIRMASI_BLUR_IOS_MS,
            intervalCekFokusMs: 500,
            msSejakMulai: () => 140_000,
            onFokusBerubah,
            onCatat,
            bacaPlatform: () => 'pwa',
        })

        // WebKit menembakkan window.blur, tetapi document.hasFocus() tetap true (state.focused = true)
        env.winMock.dispatchEvent(env.buatEvent('blur'))
        vi.advanceTimersByTime(KONFIRMASI_BLUR_IOS_MS)
        expect(onFokusBerubah).toHaveBeenLastCalledWith(true)

        // Pastikan interval 500ms tidak memutus prematur walau hasFocus() true
        vi.advanceTimersByTime(6000)
        expect(onFokusBerubah).toHaveBeenLastCalledWith(true)

        // Kembali lewat window.focus
        env.winMock.dispatchEvent(env.buatEvent('focus'))
        expect(onFokusBerubah).toHaveBeenLastCalledWith(false)
        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledWith('pindah_tab', 140_000, 6000 + KONFIRMASI_BLUR_IOS_MS)
        lepas()
    })

    it('22. iPhone slide side tanpa blur/visibilitychange: pembekuan requestAnimationFrame oleh SpringBoard tertangkap (>=5 dtk & 3x intip)', () => {
        const env = buatLingkunganDom()
        const onCatat = vi.fn()
        const onJedaFrame = vi.fn()
        let nextId = 1
        const antreanRaf = new Map<number, FrameRequestCallback>()
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            const id = nextId++
            antreanRaf.set(id, cb)
            return id
        })
        vi.stubGlobal('cancelAnimationFrame', (id: number) => {
            antreanRaf.delete(id)
        })

        const jalankanSatuFrame = () => {
            const entries = [...antreanRaf.entries()]
            antreanRaf.clear()
            for (const [, cb] of entries) cb(performance.now())
        }

        const lepas = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur: true,
            jenisPerangkat: 'ios',
            konfirmasiBlurMs: KONFIRMASI_BLUR_IOS_MS,
            intervalCekFokusMs: 500,
            ambangJedaFrameMs: AMBANG_JEDA_FRAME_IOS_MS,
            msSejakMulai: () => 150_000,
            onJedaFrame,
            onCatat,
            bacaPlatform: () => 'pwa',
        })

        // Frame normal (interval 500ms + 16ms rAF) -> tidak terdeteksi jeda
        vi.advanceTimersByTime(INTERVAL_CEK_FRAME_IOS_MS + 16)
        jalankanSatuFrame()
        expect(onJedaFrame).not.toHaveBeenCalled()

        // 1) Slide side ditahan 6 detik tanpa event blur/visibilitychange
        vi.advanceTimersByTime(INTERVAL_CEK_FRAME_IOS_MS + 6000)
        jalankanSatuFrame()
        expect(onJedaFrame).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenCalledTimes(1)
        expect(onCatat).toHaveBeenLastCalledWith('pindah_tab', 150_000, 6000)

        // 2) Intip slide side cepat 3x masing-masing 1.8 detik (diselingi frame aktif normal < 1.5 dtk)
        for (let i = 0; i < 3; i++) {
            vi.advanceTimersByTime(INTERVAL_CEK_FRAME_IOS_MS + 16)
            jalankanSatuFrame()
            vi.advanceTimersByTime(INTERVAL_CEK_FRAME_IOS_MS + 1800)
            jalankanSatuFrame()
        }
        expect(onCatat).toHaveBeenCalledTimes(2)
        expect(onCatat).toHaveBeenLastCalledWith('pindah_tab', 150_000, 1800)

        expect(env.state.visibilityState).toBe('visible')
        lepas()
    })
})
