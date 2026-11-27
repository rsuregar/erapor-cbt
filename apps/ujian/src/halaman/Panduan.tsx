import { IlustrasiPanduan, type Adegan } from '@/komponen/IlustrasiPanduan'
import { Kartu } from '@/komponen/Kartu'
import { KepalaFitur } from '@/komponen/KepalaFitur'
import { UnduhDesktop } from '@/komponen/TautanUnduhApp'
import { Tombol } from '@/komponen/Tombol'
import { isNative, isTauri } from '@/lib/native'
import { usePasang } from '@/lib/pasang'
import { cn } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'
import { BatteryCharging, BellOff, CheckCircle2, Download, Laptop, Lock, Smartphone, Wifi } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export type UntukPanduan = 'ios' | 'android' | 'laptop'

type Langkah = { en: ReactNode; id: ReactNode; adegan?: Adegan }

const TAB: { id: UntukPanduan; label: string; ikon: ReactNode }[] = [
    { id: 'ios', label: 'iPhone/iPad', ikon: <Smartphone className="size-4" /> },
    { id: 'android', label: 'Android', ikon: <Smartphone className="size-4" /> },
    { id: 'laptop', label: 'Laptop / PC', ikon: <Laptop className="size-4" /> },
]

function Dwi({
    en,
    id,
    className,
    subClassName,
}: {
    en: ReactNode
    id: ReactNode
    className?: string
    subClassName?: string
}) {
    return (
        <>
            <span className={className}>{en}</span>
            <span className={cn('mt-0.5 block text-xs font-normal leading-snug text-slate-500', subClassName)}>{id}</span>
        </>
    )
}

const PASANG: Record<UntukPanduan, Langkah[]> = {
    ios: [
        {
            en: <>Open the exam URL in <b>Safari</b> or <b>Chrome</b>, then tap the <b>Share</b> button (square with an up arrow): bottom bar in Safari, top-right address bar in Chrome.</>,
            id: <>Buka alamat ujian di <b>Safari</b> atau <b>Chrome</b>, lalu ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas): di Safari ada di bilah bawah, di Chrome di bilah alamat kanan atas.</>,
            adegan: 'ios-bagikan',
        },
        {
            en: <>Scroll down and choose <b>Add to Home Screen</b>.</>,
            id: <>Gulir ke bawah, pilih <b>Tambahkan ke Layar Utama</b>.</>,
            adegan: 'ios-tambah',
        },
        {
            en: <>Tap <b>Add</b> in the top-right corner.</>,
            id: <>Ketuk <b>Tambah</b> di pojok kanan atas.</>,
            adegan: 'ios-konfirmasi',
        },
        {
            en: <>Open the exam and sign in from the <b>CBT Al Akhyar</b> icon on your home screen — do not sign in from Safari/Chrome first to avoid locking your session to another device.</>,
            id: <>Buka ujian dan masuk akun dari ikon <b>CBT Al Akhyar</b> di layar utama — jangan masuk dulu di Safari/Chrome agar tidak terkunci sesi perangkat lain.</>,
            adegan: 'layar-utama',
        },
    ],
    android: [
        {
            en: <>Open the exam URL in <b>Chrome</b>, then tap the <b>⋮</b> menu in the top-right corner.</>,
            id: <>Buka alamat ujian di <b>Chrome</b>, lalu ketuk menu <b>⋮</b> di kanan atas.</>,
            adegan: 'android-menu',
        },
        {
            en: <>Choose <b>Install app</b> (on some phones: <b>Add to Home screen</b>), then tap <b>Install</b>.</>,
            id: <>Pilih <b>Instal aplikasi</b> (di sebagian HP: <b>Tambahkan ke layar utama</b>), lalu ketuk <b>Instal</b>.</>,
            adegan: 'android-instal',
        },
        {
            en: <>Open the exam from the <b>CBT Al Akhyar</b> icon on your home screen — not from Chrome.</>,
            id: <>Buka ujian dari ikon <b>CBT Al Akhyar</b> di layar utama — bukan dari Chrome.</>,
            adegan: 'layar-utama',
        },
    ],
    laptop: [
        {
            en: <>Use the latest <b>Chrome</b> or <b>Edge</b> directly in a browser tab. Do not install the web version on a laptop — for the installed app, download <b>Exam Browser</b> in section 1.</>,
            id: <>Pakai <b>Chrome</b> atau <b>Edge</b> versi terbaru langsung di tab browser. Jangan memasang versi web di laptop — untuk aplikasi terpasang, unduh <b>Exam Browser</b> di bagian 1.</>,
        },
        {
            en: <>When you click <b>Start</b>, the browser requests full screen — <b>allow</b> it. Strict-level exams cannot start without full screen.</>,
            id: <>Saat menekan <b>Mulai</b>, browser meminta layar penuh — <b>izinkan</b>. Ujian level Ketat tidak bisa dimulai tanpa layar penuh.</>,
            adegan: 'laptop-layar-penuh',
        },
        {
            en: <>Do not press <b>Esc</b> or switch windows during the exam: leaving full screen is recorded as a violation.</>,
            id: <>Jangan tekan <b>Esc</b> atau berpindah jendela selama ujian: keluar dari layar penuh tercatat sebagai pelanggaran.</>,
        },
    ],
}

const KUNCI: Record<UntukPanduan, { judulEn: string; judulId: string; pengantarEn: string; pengantarId: string; langkah: Langkah[] }> = {
    ios: {
        judulEn: 'Guided Access',
        judulId: 'Akses Terpandu',
        pengantarEn: 'Locks your iPhone/iPad inside the exam app. The exit passcode is entered by the proctor so students cannot leave on their own.',
        pengantarId: 'Mengunci iPhone/iPad di aplikasi ujian. Kode keluarnya diketik pengawas, jadi murid tidak bisa keluar sendiri.',
        langkah: [
            {
                en: <>Go to <b>Settings → Accessibility → Guided Access</b> and turn it on. Under <b>Passcode Settings</b>, the proctor sets the passcode.</>,
                id: <>Buka <b>Pengaturan → Aksesibilitas → Akses Terpandu</b>, nyalakan. Di <b>Pengaturan Kode Sandi</b>, pengawas yang mengetik kodenya.</>,
                adegan: 'ios-akses-terpandu',
            },
            {
                en: <>Open the CBT Al Akhyar app, then triple-click the <b>Side button</b> (on iPhone/iPad with a Home button: triple-click <b>Home</b>).</>,
                id: <>Buka aplikasi CBT Al Akhyar, lalu klik <b>tombol samping 3×</b> (iPhone/iPad dengan tombol Home: klik <b>Home 3×</b>).</>,
                adegan: 'ios-klik-tiga',
            },
            {
                en: <>Tap <b>Start</b> in the top right. After submitting the exam, the proctor triple-clicks again and enters the passcode to end.</>,
                id: <>Ketuk <b>Mulai</b> di kanan atas. Setelah ujian terkumpul, pengawas klik 3× lagi dan mengetik kode untuk mengakhiri.</>,
                adegan: 'ios-mulai-terpandu',
            },
        ],
    },
    android: {
        judulEn: 'App Pinning',
        judulId: 'Sematkan Aplikasi',
        pengantarEn: 'Keeps the screen locked to the exam app. Menu names vary slightly by phone brand.',
        pengantarId: 'Menahan layar di aplikasi ujian. Nama menunya sedikit berbeda antarmerek HP.',
        langkah: [
            {
                en: <>Open <b>Settings → Security</b> (Samsung: <b>Security and privacy → Other security settings</b>) → <b>App pinning</b>, turn it on along with <b>Ask for PIN before unpinning</b>.</>,
                id: <>Buka <b>Setelan → Keamanan</b> (Samsung: <b>Keamanan dan privasi → Setelan keamanan lainnya</b>) → <b>Sematkan aplikasi</b>, nyalakan beserta <b>Minta PIN saat melepas</b>.</>,
                adegan: 'android-sematkan-setelan',
            },
            {
                en: <>Open the CBT Al Akhyar app, open <b>Overview</b> (square button, or swipe up and hold). Tap the app icon above its card → <b>Pin</b>.</>,
                id: <>Buka aplikasi CBT Al Akhyar, buka layar <b>Ringkasan</b> (tombol kotak, atau geser ke atas lalu tahan). Ketuk ikon aplikasi di atas kartunya → <b>Sematkan</b>.</>,
                adegan: 'android-sematkan',
            },
            {
                en: <>After submitting the exam: press and hold <b>Back</b> + <b>Overview</b> together (or swipe up and hold), then enter the PIN.</>,
                id: <>Setelah ujian terkumpul: tahan <b>Kembali</b> + <b>Ringkasan</b> bersamaan (atau geser ke atas lalu tahan), masukkan PIN.</>,
                adegan: 'android-lepas',
            },
        ],
    },
    laptop: {
        judulEn: 'Laptop / PC',
        judulId: 'Laptop / PC',
        pengantarEn: 'Laptop browsers cannot be locked. Full screen is mandatory, and any exit from the exam screen is logged immediately — and may lock your exam.',
        pengantarId: 'Browser laptop tidak bisa dikunci. Layar penuh wajib, dan setiap keluar dari layar ujian langsung tercatat — bisa mengunci ujian.',
        langkah: [
            {
                en: <>Close other apps and turn off notifications before clicking Start.</>,
                id: <>Tutup aplikasi lain dan matikan notifikasi sebelum menekan Mulai.</>,
            },
        ],
    },
}

/** Catatan jalur utama per perangkat: app/Exam Browser sekolah dulu, versi web hanya cadangan. */
const CATATAN_PASANG: Partial<Record<UntukPanduan, { en: string; id: string }>> = {
    android: {
        en: 'If the school already installed the CBT Al Akhyar app on your phone, use that app. The steps below install the web version as a backup.',
        id: 'Bila sekolah sudah memasang aplikasi CBT Al Akhyar di HP-mu, pakai aplikasi itu. Langkah di bawah memasang versi web sebagai cadangan.',
    },
    laptop: {
        en: 'School lab computers use CBT Al Akhyar Exam Browser. The steps below are for personal laptops that do not have it installed yet.',
        id: 'Komputer lab sekolah memakai Exam Browser CBT Al Akhyar. Langkah di bawah untuk laptop pribadi yang belum memakainya.',
    },
}

/**
 * App native mengunci layar sendiri (Android: sematkan otomatis saat Mulai, dilepas setelah
 * dikumpulkan; Exam Browser desktop: selalu kiosk) — langkah manual tidak berlaku di sana.
 */
function KunciOtomatis() {
    const desktop = isTauri()
    return (
        <Bagian nomor={1} judul="Automatic screen lock" subjudul="Kunci layar otomatis" ikon={<Lock className="size-4" />}>
            <p className="text-sm text-slate-700">
                {desktop ? (
                    <Dwi
                        en="Exam Browser always stays in full screen and cannot be closed or left without a proctor PIN. No manual setup is needed."
                        id="Exam Browser selalu tampil layar penuh dan tidak bisa ditutup atau ditinggalkan tanpa PIN pengawas. Kamu tidak perlu mengatur apa pun."
                    />
                ) : (
                    <Dwi
                        en="The app automatically locks the screen when you press Start on a Strict or Lockdown exam, and unlocks after submission."
                        id="Aplikasi mengunci layar sendiri saat kamu menekan Mulai pada ujian Ketat atau Lockdown, lalu melepasnya setelah ujian dikumpulkan."
                    />
                )}
            </p>
            {!desktop && (
                <p className="rounded-lg bg-sky-100 px-3 py-2.5 text-sm font-semibold text-sky-700">
                    <Dwi
                        en={<>If a &ldquo;Pin app?&rdquo; prompt appears, tap <b>Got it</b> or <b>Pin</b>.</>}
                        id={<>Bila muncul pesan &ldquo;Sematkan aplikasi?&rdquo;, ketuk <b>Mengerti</b> atau <b>Sematkan</b>.</>}
                        subClassName="text-slate-600"
                    />
                </p>
            )}
        </Bagian>
    )
}

/** Panduan memasang aplikasi ujian (PWA) dan mengunci layar (story 7.4, PRD M-14). Bisa dibuka tanpa login. */
export default function Panduan({ untuk: awal }: { untuk: UntukPanduan }) {
    const navigate = useNavigate()
    const [untuk, setUntuk] = useState<UntukPanduan>(awal)
    const pasang = usePasang()
    const kunci = KUNCI[untuk]
    // Tab laptop (web): bagian "Unduh aplikasi" jadi langkah 1, bagian lain bergeser.
    const unduh = untuk === 'laptop' && !isNative()
    const geser = unduh ? 1 : 0

    return (
        <div className="min-h-full pb-10">
            <KepalaFitur
                judul="Device Guide"
                subjudul={
                    <>
                        Prepare a day before the exam
                        <span className="block text-[11px] opacity-80">Siapkan sehari sebelum ujian</span>
                    </>
                }
                onKembali={() => (history.length > 1 ? history.back() : navigate({ to: '/' }))}
            >
                {!isNative() && (
                    <div role="tablist" aria-label="Choose device" className="grid grid-cols-3 gap-1 rounded-lg bg-white/15 p-1">
                        {TAB.map((t) => (
                            <button
                                key={t.id}
                                role="tab"
                                aria-selected={untuk === t.id}
                                onClick={() => {
                                    setUntuk(t.id)
                                    void navigate({ to: '/panduan', search: { untuk: t.id }, replace: true })
                                }}
                                className={cn(
                                    'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-bold transition active:scale-[0.97]',
                                    untuk === t.id ? 'bg-white text-primary shadow-sm' : 'text-white',
                                )}
                            >
                                <span className="hidden sm:inline">{t.ikon}</span>
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
            </KepalaFitur>

            <main className="mx-auto max-w-2xl space-y-5 px-4 pt-5">
                {isNative() ? (
                    <>
                        <p className="flex items-start gap-2.5 rounded-lg bg-green-100 p-3 text-sm font-semibold text-green-700">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                            <span>
                                <Dwi
                                    en={`Official CBT Al Akhyar v${__VERSI_APP__} app is installed on this device.`}
                                    id={`Aplikasi resmi CBT Al Akhyar v${__VERSI_APP__} sudah terpasang di perangkat ini.`}
                                    subClassName="text-slate-600"
                                />
                            </span>
                        </p>
                        <KunciOtomatis />
                    </>
                ) : (
                    <>
                        {unduh && (
                            <Bagian nomor={1} judul="Download the exam app" subjudul="Unduh aplikasi ujian" ikon={<Download className="size-4" />}>
                                <p className="text-sm text-slate-700">
                                    <Dwi
                                        en="Use the official CBT Al Akhyar (Exam Browser) app: the screen locks automatically during the exam. Choose your laptop's OS."
                                        id="Pakai aplikasi resmi CBT Al Akhyar (Exam Browser): layar otomatis terkunci saat ujian. Pilih sesuai sistem operasi laptopmu."
                                    />
                                </p>
                                <UnduhDesktop />
                            </Bagian>
                        )}
                        <Bagian
                            nomor={1 + geser}
                            judul={untuk === 'laptop' ? 'Backup: use a browser' : 'Install the exam app'}
                            subjudul={untuk === 'laptop' ? 'Cadangan: pakai browser' : 'Pasang aplikasi ujian'}
                        >
                            {CATATAN_PASANG[untuk] && !pasang.terpasang && (
                                <p className="text-sm text-slate-700">
                                    <Dwi en={CATATAN_PASANG[untuk].en} id={CATATAN_PASANG[untuk].id} />
                                </p>
                            )}
                            {pasang.terpasang ? (
                                <p className="flex items-start gap-2 rounded-lg bg-green-100 px-3 py-2.5 text-sm font-semibold text-green-700">
                                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                                    <span>
                                        <Dwi
                                            en="The app is installed and opened from the home screen."
                                            id="Aplikasi sudah terpasang dan dibuka dari layar utama."
                                            subClassName="text-slate-600"
                                        />
                                    </span>
                                </p>
                            ) : (
                                pasang.bisaPasang &&
                                untuk === 'android' && (
                                    <Tombol penuh ikonKiri={<Download className="size-4" />} onClick={() => void pasang.pasang()}>
                                        Install now · Pasang sekarang
                                    </Tombol>
                                )
                            )}
                            <DaftarLangkah langkah={PASANG[untuk]} />
                        </Bagian>
                    </>
                )}

                {!isNative() && (
                    <Bagian
                        nomor={2 + geser}
                        judul={untuk === 'laptop' ? 'During the exam' : `Screen lock: ${kunci.judulEn}`}
                        subjudul={untuk === 'laptop' ? 'Saat ujian' : `Kunci layar: ${kunci.judulId}`}
                        ikon={<Lock className="size-4" />}
                    >
                        <p className="text-sm text-slate-700">
                            <Dwi en={kunci.pengantarEn} id={kunci.pengantarId} />
                        </p>
                        {untuk !== 'laptop' && (
                            <p className="rounded-lg bg-sky-100 px-3 py-2.5 text-sm font-semibold text-sky-700">
                                <Dwi
                                    en="Enabled together with the proctor in the exam room before the token is given."
                                    id="Dinyalakan bersama pengawas di ruang ujian, sebelum token diberikan."
                                    subClassName="text-slate-600"
                                />
                            </p>
                        )}
                        <DaftarLangkah langkah={kunci.langkah} />
                    </Bagian>
                )}

                <Bagian nomor={isNative() ? 2 : 3 + geser} judul="Before exam day" subjudul="Sebelum hari ujian">
                    <ul className="space-y-2.5 text-sm">
                        <Tip ikon={<BatteryCharging className="size-4" />}>
                            <Dwi en="Charge your battery to 100% and bring your charger." id="Isi daya baterai penuh dan bawa charger." />
                        </Tip>
                        <Tip ikon={<BellOff className="size-4" />}>
                            <Dwi en="Turn on Do Not Disturb so notifications do not pop up." id="Nyalakan mode Jangan Ganggu agar notifikasi tidak muncul." />
                        </Tip>
                        <Tip ikon={<Wifi className="size-4" />}>
                            <Dwi
                                en="Sign in to the app once while connected to the internet. Questions are downloaded automatically before the exam and still work if the connection drops."
                                id="Masuk ke aplikasi sekali dengan internet. Soal diunduh otomatis menjelang ujian dan tetap bisa dikerjakan bila internet putus."
                            />
                        </Tip>
                    </ul>
                </Bagian>

                {/* Footer Informasi Versi Aplikasi */}
                <footer className="pt-6 pb-2 text-center text-xs text-slate-600">
                    CBT Al Akhyar &bull; v{__VERSI_APP__}
                </footer>
            </main>
        </div>
    )
}

function Bagian({
    nomor,
    judul,
    subjudul,
    ikon,
    children,
}: {
    nomor: number
    judul: string
    subjudul?: string
    ikon?: ReactNode
    children: ReactNode
}) {
    return (
        <Kartu className="space-y-4">
            <h2 className="flex items-start gap-2.5 text-body-lg">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-semibold text-white">{nomor}</span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span>{judul}</span>
                        {ikon && <span className="text-slate-500">{ikon}</span>}
                    </span>
                    {subjudul && <span className="block text-xs font-normal text-slate-500">{subjudul}</span>}
                </span>
            </h2>
            {children}
        </Kartu>
    )
}

function DaftarLangkah({ langkah }: { langkah: Langkah[] }) {
    return (
        <ol className="space-y-3">
            {langkah.map((l, i) => (
                // Ilustrasi laptop lebar: di HP taruh di bawah teks agar teks tidak terjepit jadi kolom sempit.
                <li key={i} className={cn('flex items-start gap-4 rounded-lg bg-slate-50 p-3', l.adegan?.startsWith('laptop') && 'flex-col sm:flex-row')}>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-caps text-primary">
                            Step {i + 1} <span className="font-normal normal-case tracking-normal text-slate-500">· Langkah {i + 1}</span>
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-ink">
                            <Dwi en={l.en} id={l.id} />
                        </p>
                    </div>
                    {l.adegan && <IlustrasiPanduan adegan={l.adegan} />}
                </li>
            ))}
        </ol>
    )
}

function Tip({ ikon, children }: { ikon: ReactNode; children: ReactNode }) {
    return (
        <li className="flex gap-2.5">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">{ikon}</span>
            <span>{children}</span>
        </li>
    )
}
