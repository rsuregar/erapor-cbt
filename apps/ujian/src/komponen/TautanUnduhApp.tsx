import { isNative } from '@/lib/native'
import { cariUnduhan, type DaftarUnduhan, type PlatformRilis, type UnduhanPlatform } from '@/lib/pembaruan'
import { jenisPerangkat, standalone } from '@/lib/perangkat'
import { useOnline } from '@/lib/useOnline'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowRight, CheckCircle2, ChevronDown, Download, ExternalLink, PlusSquare, Share } from 'lucide-react'
import { useState, type ReactNode, type SVGProps } from 'react'

const REPO_RILIS = (import.meta.env.VITE_UPDATE_REPO as string | undefined) || 'rsuregar/erapor-cbt-releases'
/** Cadangan bila API GitHub gagal / kena batas: halaman semua rilis. */
const HALAMAN_RILIS = `https://github.com/${REPO_RILIS}/releases`

const ID_BAGIAN_UNDUH = 'unduh-app'

/**
 * Tombol kecil di bagian atas halaman Masuk: menggulir mulus ke kartu unduh yang ada di
 * bawah form (tidak tampil di app native, tempat kartunya juga tidak ada).
 */
export function PintasanUnduhApp({ className }: { className?: string }) {
    if (isNative()) return null

    const gulir = () => {
        const bagian = document.getElementById(ID_BAGIAN_UNDUH)
        if (!bagian) return
        const kurangiGerak = matchMedia('(prefers-reduced-motion: reduce)').matches
        bagian.scrollIntoView({ behavior: kurangiGerak ? 'auto' : 'smooth', block: 'start' })
    }

    return (
        <button
            type="button"
            onClick={gulir}
            className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/25 active:scale-[0.97]',
                className,
            )}
        >
            <Download className="size-4" />
            Unduh aplikasi ujian
            <ArrowDown className="size-3.5 opacity-80" />
        </button>
    )
}

/* ---------- Ikon platform (SVG inline, ikut warna teks lewat currentColor) ---------- */

type Ikon = (p: SVGProps<SVGSVGElement>) => ReactNode

const IkonWindows: Ikon = (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
        <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13L10.5 19.6v-7.1H3v6Zm8.5 1.2L21 21v-8.5h-9.5v7.2Zm0-15.4v7.2H21V3l-9.5 1.3Z" />
    </svg>
)

const IkonApple: Ikon = (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z" />
    </svg>
)

const IkonAndroid: Ikon = (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
        <path d="M16.61 15.15a.83.83 0 1 1 0-1.65.83.83 0 0 1 0 1.65Zm-9.2 0a.83.83 0 1 1 0-1.65.83.83 0 0 1 0 1.65Zm9.5-5.01 1.67-2.88a.35.35 0 0 0-.6-.34l-1.7 2.91A10.15 10.15 0 0 0 12 8.91c-1.53 0-3 .33-4.27.89L6 6.89a.35.35 0 0 0-.6.34l1.67 2.88C4.25 11.69 2.29 14.58 2 18h20c-.28-3.41-2.23-6.3-5.09-7.86Z" />
    </svg>
)

/* ---------- Data per platform ---------- */

type Pilihan = PlatformRilis

const INFO: Record<Pilihan, { nama: string; catatan: string; Ikon: Ikon; warna: string }> = {
    windows: { nama: 'Windows', catatan: 'Windows 10/11 · 64-bit', Ikon: IkonWindows, warna: 'bg-sky-100 text-sky-700' },
    macos: { nama: 'macOS', catatan: 'Apple Silicon (M1 ke atas) · Mac Intel belum didukung', Ikon: IkonApple, warna: 'bg-slate-200 text-slate-800' },
    android: { nama: 'Android', catatan: 'Android 8 ke atas · berkas APK', Ikon: IkonAndroid, warna: 'bg-green-100 text-green-700' },
    ios: { nama: 'iPhone / iPad', catatan: 'Pasang lewat Safari atau Chrome (tanpa App Store)', Ikon: IkonApple, warna: 'bg-slate-200 text-slate-800' },
}

const URUTAN: Pilihan[] = ['windows', 'macos', 'android', 'ios']

/** Perangkat yang sedang membuka halaman; null = tidak dikenali (mis. Linux/ChromeOS). */
function perangkatIni(): Pilihan | null {
    const j = jenisPerangkat()
    if (j === 'ios' || j === 'android') return j
    const ua = navigator.userAgent
    if (/Windows/i.test(ua)) return 'windows'
    if (/Macintosh|Mac OS X/i.test(ua)) return 'macos'

    return null
}

const mb = (byte: number) => `${(byte / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`

/**
 * Tautan unduh aplikasi resmi di halaman Masuk (hanya web/PWA). Platform perangkat ini
 * ditonjolkan; platform lain bisa dibuka di "Perangkat lain". Windows/macOS/Android
 * mengunduh berkas dari rilis terbaru di GitHub; iPhone/iPad memasang PWA lewat Safari atau Chrome.
 */
export function TautanUnduhApp() {
    const online = useOnline()
    const [ini] = useState(perangkatIni)
    const [bukaLain, setBukaLain] = useState(ini === null)
    const { data, isLoading, isError } = useQuery({
        queryKey: ['unduhan-app'],
        queryFn: cariUnduhan,
        enabled: online && !isNative(),
        staleTime: 60 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
    })

    if (isNative()) return null

    const lain = URUTAN.filter((p) => p !== ini)

    return (
        <section id={ID_BAGIAN_UNDUH} aria-labelledby="judul-unduh-app" className="mt-5 scroll-mt-4 rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">
                    <Download className="size-4" />
                </span>
                <div>
                    <h2 id="judul-unduh-app" className="text-sm font-bold text-ink">
                        Unduh aplikasi ujian
                    </h2>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">Ujian lebih aman & stabil memakai aplikasi resmi CBT Al Akhyar.</p>
                </div>
            </div>

            {ini && (
                <div className="mt-4">
                    <p className="mb-1.5 text-micro font-bold uppercase tracking-wider text-slate-500">Untuk perangkatmu</p>
                    {ini === 'ios' ? <KartuIos /> : <KartuUnduh platform={ini} berkas={data?.[ini]} memuat={isLoading} gagal={isError || !online} utama />}
                </div>
            )}

            <div className={cn(ini && 'mt-4')}>
                {ini && (
                    <button
                        type="button"
                        onClick={() => setBukaLain((v) => !v)}
                        aria-expanded={bukaLain}
                        className={cn(
                            'group flex min-h-14 w-full items-center gap-3 rounded-lg border-2 border-dashed px-3 py-2.5 text-left transition active:scale-[0.99]',
                            bukaLain ? 'border-primary/40 bg-primary-50/60' : 'border-primary/30 bg-primary-50/40 hover:border-primary hover:bg-primary-50',
                        )}
                    >
                        <span className="flex shrink-0 -space-x-2" aria-hidden="true">
                            {lain.map((p) => {
                                const { Ikon: I, warna } = INFO[p]
                                return (
                                    <span key={p} className={cn('inline-flex size-9 items-center justify-center rounded-full ring-2 ring-white', warna)}>
                                        <I className="size-4" />
                                    </span>
                                )
                            })}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-primary">Pakai perangkat lain?</span>
                            <span className="block truncate text-xs text-slate-600">{lain.map((p) => INFO[p].nama.split(' ')[0]).join(' · ')}</span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm transition group-hover:bg-primary/90">
                            {bukaLain ? 'Tutup' : 'Lihat'}
                            <ChevronDown className={cn('size-3.5 transition-transform', bukaLain && 'rotate-180')} />
                        </span>
                    </button>
                )}
                {bukaLain && (
                    <div className={cn('grid gap-2', ini ? 'mt-2' : 'mt-4')}>
                        {lain.map((p) =>
                            p === 'ios' ? (
                                <KartuIosRingkas key={p} />
                            ) : (
                                <KartuUnduh key={p} platform={p} berkas={data?.[p as keyof DaftarUnduhan]} memuat={isLoading} gagal={isError || !online} />
                            ),
                        )}
                    </div>
                )}
            </div>
        </section>
    )
}

function LencanaIkon({ platform, besar }: { platform: Pilihan; besar?: boolean }) {
    const { Ikon, warna } = INFO[platform]

    return (
        <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg', warna, besar ? 'size-12' : 'size-10')}>
            <Ikon className={besar ? 'size-6' : 'size-5'} />
        </span>
    )
}

function KartuUnduh({ platform, berkas, memuat, gagal, utama }: { platform: Exclude<Pilihan, 'ios'>; berkas?: UnduhanPlatform; memuat: boolean; gagal: boolean; utama?: boolean }) {
    const { nama, catatan } = INFO[platform]
    const href = berkas?.unduh ?? HALAMAN_RILIS
    const keterangan = berkas ? [`v${berkas.versi}`, berkas.ukuran ? mb(berkas.ukuran) : null].filter(Boolean).join(' · ') : memuat ? 'Memuat versi terbaru…' : gagal ? 'Buka halaman rilis' : 'Belum tersedia'

    return (
        <a
            href={href}
            {...(berkas ? { download: '' } : { target: '_blank', rel: 'noopener noreferrer' })}
            aria-label={`Unduh CBT Al Akhyar untuk ${nama}${berkas ? ` versi ${berkas.versi}` : ''}`}
            className={cn(
                'group flex min-h-14 items-center gap-3 rounded-lg border p-3 transition active:scale-[0.99]',
                utama ? 'border-primary/30 bg-primary-50/50 hover:border-primary hover:bg-primary-50' : 'border-slate-200 bg-slate-50/60 hover:border-primary/40 hover:bg-white',
            )}
        >
            <LencanaIkon platform={platform} besar={utama} />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{nama}</span>
                <span className="block truncate text-xs text-slate-600">{catatan}</span>
                <span className={cn('mt-0.5 block text-xs font-semibold', memuat && !berkas ? 'animate-pulse text-slate-400' : 'text-primary')}>{keterangan}</span>
            </span>
            {utama ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm transition group-hover:bg-primary/90">
                    {berkas ? <Download className="size-3.5" /> : <ExternalLink className="size-3.5" />}
                    Unduh
                </span>
            ) : berkas ? (
                <Download className="size-4 shrink-0 text-slate-400 transition group-hover:text-primary" />
            ) : (
                <ExternalLink className="size-4 shrink-0 text-slate-400 transition group-hover:text-primary" />
            )}
        </a>
    )
}

/** iPhone/iPad: tidak ada berkas unduhan; pasang PWA lewat Safari/Chrome → Bagikan → Tambahkan ke Layar Utama. */
function KartuIos() {
    if (standalone()) {
        return (
            <p className="flex items-center gap-2.5 rounded-lg bg-green-100 p-3 text-sm font-semibold text-green-700">
                <CheckCircle2 className="size-4 shrink-0" />
                Aplikasi sudah terpasang di layar utama.
            </p>
        )
    }

    return (
        <div className="rounded-lg border border-primary/30 bg-primary-50/50 p-3">
            <div className="flex items-center gap-3">
                <LencanaIkon platform="ios" besar />
                <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">iPhone / iPad</p>
                    <p className="text-xs text-slate-600">{INFO.ios.catatan}</p>
                </div>
            </div>
            <ol className="mt-3 space-y-2 text-sm text-slate-700">
                <Langkah n={1}>
                    Ketuk <b>Bagikan</b> <Share className="inline size-4 -translate-y-0.5 text-primary" aria-label="ikon Bagikan" /> di bilah Safari (bawah layar) atau di bilah alamat Chrome (kanan atas).
                </Langkah>
                <Langkah n={2}>
                    Pilih <b>Tambahkan ke Layar Utama</b> <PlusSquare className="inline size-4 -translate-y-0.5 text-primary" aria-hidden="true" />.
                </Langkah>
                <Langkah n={3}>
                    Ketuk <b>Tambah</b>, lalu buka CBT dari ikon di layar utama.
                </Langkah>
            </ol>
            <Link
                to="/panduan"
                search={{ untuk: 'ios' }}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
                Lihat panduan bergambar <ArrowRight className="size-3.5" />
            </Link>
        </div>
    )
}

function KartuIosRingkas() {
    return (
        <Link
            to="/panduan"
            search={{ untuk: 'ios' }}
            className="group flex min-h-14 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 transition hover:border-primary/40 hover:bg-white active:scale-[0.99]"
        >
            <LencanaIkon platform="ios" />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">iPhone / iPad</span>
                <span className="block truncate text-xs text-slate-600">{INFO.ios.catatan}</span>
                <span className="mt-0.5 block text-xs font-semibold text-primary">Lihat cara pasang</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-slate-400 transition group-hover:text-primary" />
        </Link>
    )
}

function Langkah({ n, children }: { n: number; children: ReactNode }) {
    return (
        <li className="flex gap-2.5">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-micro font-bold text-white">{n}</span>
            <span className="leading-snug">{children}</span>
        </li>
    )
}

/**
 * Unduhan langsung untuk laptop/PC (halaman Panduan): kartu OS perangkat ini ditonjolkan,
 * OS desktop lainnya di bawahnya. Berkas diambil dari rilis terbaru yang sama dengan halaman Masuk.
 */
export function UnduhDesktop() {
    const online = useOnline()
    const [ini] = useState(perangkatIni)
    const { data, isLoading, isError } = useQuery({
        queryKey: ['unduhan-app'],
        queryFn: cariUnduhan,
        enabled: online && !isNative(),
        staleTime: 60 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
    })
    if (isNative()) return null

    const urutan: ('windows' | 'macos')[] = ini === 'macos' ? ['macos', 'windows'] : ['windows', 'macos']

    return (
        <div className="space-y-2.5">
            {urutan.map((p, i) => (
                <KartuUnduh key={p} platform={p} berkas={data?.[p]} memuat={isLoading} gagal={isError || !online} utama={i === 0 && (ini === p || ini === null)} />
            ))}
            {(ini === 'android' || ini === 'ios') && (
                <p className="text-xs text-slate-600">Kamu membuka halaman ini dari HP/tablet. Pilih tab Android atau iPhone/iPad di atas untuk panduan perangkatmu.</p>
            )}
        </div>
    )
}
