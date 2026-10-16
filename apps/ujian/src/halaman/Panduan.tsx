import { IlustrasiPanduan, type Adegan } from '@/komponen/IlustrasiPanduan'
import { Kartu } from '@/komponen/Kartu'
import { KepalaFitur } from '@/komponen/KepalaFitur'
import { Tombol } from '@/komponen/Tombol'
import { isNative } from '@/lib/native'
import { usePasang } from '@/lib/pasang'
import { cn } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'
import { BatteryCharging, BellOff, CheckCircle2, Download, Laptop, Lock, Smartphone, Wifi } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export type UntukPanduan = 'ios' | 'android' | 'laptop'

type Langkah = { teks: ReactNode; adegan?: Adegan }

const TAB: { id: UntukPanduan; label: string; ikon: ReactNode }[] = [
    { id: 'ios', label: 'iPhone/iPad', ikon: <Smartphone className="size-4" /> },
    { id: 'android', label: 'Android', ikon: <Smartphone className="size-4" /> },
    { id: 'laptop', label: 'Laptop / PC', ikon: <Laptop className="size-4" /> },
]

const PASANG: Record<UntukPanduan, Langkah[]> = {
    ios: [
        { teks: <>Buka alamat ujian di <b>Safari</b>, lalu ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas) di bagian bawah.</>, adegan: 'ios-bagikan' },
        { teks: <>Gulir ke bawah, pilih <b>Tambahkan ke Layar Utama</b>.</>, adegan: 'ios-tambah' },
        { teks: <>Ketuk <b>Tambah</b> di pojok kanan atas.</>, adegan: 'ios-konfirmasi' },
        { teks: <>Mulai sekarang, buka ujian dari ikon <b>CBT Al Akhyar</b> di layar utama — bukan dari Safari.</>, adegan: 'layar-utama' },
    ],
    android: [
        { teks: <>Buka alamat ujian di <b>Chrome</b>, lalu ketuk menu <b>⋮</b> di kanan atas.</>, adegan: 'android-menu' },
        { teks: <>Pilih <b>Instal aplikasi</b> (di sebagian HP: <b>Tambahkan ke layar utama</b>), lalu ketuk <b>Instal</b>.</>, adegan: 'android-instal' },
        { teks: <>Buka ujian dari ikon <b>CBT Al Akhyar</b> di layar utama — bukan dari Chrome.</>, adegan: 'layar-utama' },
    ],
    laptop: [
        { teks: <>Pakai <b>Chrome</b> atau <b>Edge</b> versi terbaru. Bila ada ikon pasang di bilah alamat, pasang aplikasinya agar bisa dibuka offline.</> },
        { teks: <>Saat menekan <b>Mulai</b>, browser meminta layar penuh — <b>izinkan</b>. Ujian level Ketat tidak bisa dimulai tanpa layar penuh.</>, adegan: 'laptop-layar-penuh' },
        { teks: <>Jangan tekan <b>Esc</b> atau berpindah jendela selama ujian: keluar dari layar penuh tercatat sebagai pelanggaran.</> },
    ],
}

const KUNCI: Record<UntukPanduan, { judul: string; pengantar: ReactNode; langkah: Langkah[] }> = {
    ios: {
        judul: 'Akses Terpandu',
        pengantar: 'Mengunci iPhone/iPad di aplikasi ujian. Kode keluarnya diketik pengawas, jadi murid tidak bisa keluar sendiri.',
        langkah: [
            { teks: <>Buka <b>Pengaturan → Aksesibilitas → Akses Terpandu</b>, nyalakan. Di <b>Pengaturan Kode Sandi</b>, pengawas yang mengetik kodenya.</>, adegan: 'ios-akses-terpandu' },
            { teks: <>Buka aplikasi CBT Al Akhyar, lalu klik <b>tombol samping 3×</b> (iPhone/iPad dengan tombol Home: klik <b>Home 3×</b>).</>, adegan: 'ios-klik-tiga' },
            { teks: <>Ketuk <b>Mulai</b> di kanan atas. Setelah ujian terkumpul, pengawas klik 3× lagi dan mengetik kode untuk mengakhiri.</>, adegan: 'ios-mulai-terpandu' },
        ],
    },
    android: {
        judul: 'Sematkan Aplikasi',
        pengantar: 'Menahan layar di aplikasi ujian. Nama menunya sedikit berbeda antarmerek HP.',
        langkah: [
            {
                teks: (
                    <>
                        Buka <b>Setelan → Keamanan</b> (Samsung: <b>Keamanan dan privasi → Setelan keamanan lainnya</b>) → <b>Sematkan aplikasi</b>, nyalakan beserta <b>Minta PIN saat melepas</b>.
                    </>
                ),
                adegan: 'android-sematkan-setelan',
            },
            { teks: <>Buka aplikasi CBT Al Akhyar, buka layar <b>Ringkasan</b> (tombol kotak, atau geser ke atas lalu tahan). Ketuk ikon aplikasi di atas kartunya → <b>Sematkan</b>.</>, adegan: 'android-sematkan' },
            { teks: <>Setelah ujian terkumpul: tahan <b>Kembali</b> + <b>Ringkasan</b> bersamaan (atau geser ke atas lalu tahan), masukkan PIN.</>, adegan: 'android-lepas' },
        ],
    },
    laptop: {
        judul: 'Laptop / PC',
        pengantar: 'Browser laptop tidak bisa dikunci. Layar penuh wajib, dan setiap keluar dari layar ujian langsung tercatat — bisa mengunci ujian.',
        langkah: [{ teks: <>Tutup aplikasi lain dan matikan notifikasi sebelum menekan Mulai.</> }],
    },
}

/** Panduan memasang aplikasi ujian (PWA) dan mengunci layar (story 7.4, PRD M-14). Bisa dibuka tanpa login. */
export default function Panduan({ untuk: awal }: { untuk: UntukPanduan }) {
    const navigate = useNavigate()
    const [untuk, setUntuk] = useState<UntukPanduan>(awal)
    const pasang = usePasang()
    const kunci = KUNCI[untuk]

    return (
        <div className="min-h-full pb-10">
            <KepalaFitur
                judul="Panduan perangkat"
                subjudul="Siapkan sehari sebelum ujian"
                onKembali={() => (history.length > 1 ? history.back() : navigate({ to: '/' }))}
            >
                <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-white/15 p-1">
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
                                'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition active:scale-[0.97] sm:text-sm',
                                untuk === t.id ? 'bg-white text-primary shadow-sm' : 'text-white',
                            )}
                        >
                            <span className="hidden sm:inline">{t.ikon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>
            </KepalaFitur>

            <main className="mx-auto max-w-2xl space-y-5 px-4 pt-5">
                {!isNative() ? (
                    <Bagian nomor={1} judul={untuk === 'laptop' ? 'Siapkan browser' : 'Pasang aplikasi ujian'}>
                        {pasang.terpasang ? (
                            <p className="flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2.5 text-sm font-semibold text-green-600">
                                <CheckCircle2 className="size-4" /> Aplikasi sudah terpasang dan dibuka dari layar utama.
                            </p>
                        ) : (
                            pasang.bisaPasang &&
                            untuk !== 'ios' && (
                                <Tombol penuh ikonKiri={<Download className="size-4" />} onClick={() => void pasang.pasang()}>
                                    Pasang sekarang
                                </Tombol>
                            )
                        )}
                        <DaftarLangkah langkah={PASANG[untuk]} />
                    </Bagian>
                ) : (
                    <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                        <span>Aplikasi resmi CBT Al Akhyar (v{__VERSI_APP__}) sudah terpasang secara native pada perangkat ini.</span>
                    </div>
                )}

                <Bagian nomor={isNative() ? 1 : 2} judul={untuk === 'laptop' ? 'Saat ujian' : `Kunci layar: ${kunci.judul}`} ikon={<Lock className="size-4" />}>
                    <p className="text-sm text-slate-700">{kunci.pengantar}</p>
                    {untuk !== 'laptop' && <p className="rounded-lg bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-600">Dinyalakan bersama pengawas di ruang ujian, sebelum token diberikan.</p>}
                    <DaftarLangkah langkah={kunci.langkah} />
                </Bagian>

                <Bagian nomor={isNative() ? 2 : 3} judul="Sebelum hari ujian">
                    <ul className="space-y-2.5 text-sm">
                        <Tip ikon={<BatteryCharging className="size-4" />}>Isi daya baterai penuh dan bawa charger.</Tip>
                        <Tip ikon={<BellOff className="size-4" />}>Nyalakan mode Jangan Ganggu agar notifikasi tidak muncul.</Tip>
                        <Tip ikon={<Wifi className="size-4" />}>Masuk ke aplikasi sekali dengan internet. Soal diunduh otomatis menjelang ujian dan tetap bisa dikerjakan bila internet putus.</Tip>
                    </ul>
                </Bagian>

                {/* Footer Informasi Versi Aplikasi */}
                <footer className="pt-6 pb-2 text-center text-xs text-slate-400">
                    CBT Al Akhyar &bull; v{__VERSI_APP__}
                </footer>
            </main>
        </div>
    )
}

function Bagian({ nomor, judul, ikon, children }: { nomor: number; judul: string; ikon?: ReactNode; children: ReactNode }) {
    return (
        <Kartu className="space-y-4">
            <h2 className="flex items-center gap-2.5 text-body-lg">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-semibold text-white">{nomor}</span>
                {judul}
                {ikon && <span className="text-slate-400">{ikon}</span>}
            </h2>
            {children}
        </Kartu>
    )
}

function DaftarLangkah({ langkah }: { langkah: Langkah[] }) {
    return (
        <ol className="space-y-3">
            {langkah.map((l, i) => (
                <li key={i} className="flex items-center gap-4 rounded-lg bg-slate-50 p-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-micro font-bold uppercase tracking-caps text-primary">Langkah {i + 1}</p>
                        <p className="mt-1 text-sm leading-relaxed text-ink">{l.teks}</p>
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
