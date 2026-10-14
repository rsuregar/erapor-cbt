import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Lock, MoreVertical, Pin, Plus, Share, Square, Triangle } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Ilustrasi langkah panduan (story 7.4): layar HP/laptop mini dengan bagian
 * yang perlu diketuk disorot magenta. Dibuat dari komponen, bukan tangkapan
 * layar — ringan, ikut tersimpan offline, dan tidak usang saat OS berganti tema.
 */

export type Adegan =
    | 'ios-bagikan'
    | 'ios-tambah'
    | 'ios-konfirmasi'
    | 'layar-utama'
    | 'ios-akses-terpandu'
    | 'ios-klik-tiga'
    | 'ios-mulai-terpandu'
    | 'android-menu'
    | 'android-instal'
    | 'android-sematkan-setelan'
    | 'android-sematkan'
    | 'android-lepas'
    | 'laptop-layar-penuh'

/** Bagian yang harus diketuk. */
function Sorot({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <span className={cn('relative inline-flex rounded-[5px] ring-2 ring-magenta-500 ring-offset-1', className)}>
            {children}
            <span className="absolute -bottom-1.5 -right-1.5 size-3 animate-ping rounded-full bg-magenta-500/60" />
            <span className="absolute -bottom-1 -right-1 size-2 rounded-full bg-magenta-500" />
        </span>
    )
}

const Garis = ({ w = 'w-full', className }: { w?: string; className?: string }) => <span className={cn('block h-1.5 rounded-full bg-slate-200', w, className)} />

function HP({ children, gelap }: { children: ReactNode; gelap?: boolean }) {
    return (
        <div aria-hidden className="relative mx-auto h-[196px] w-[104px] shrink-0 rounded-[18px] border-[3px] border-ink bg-ink p-[3px] shadow-md">
            <div className={cn('relative flex h-full flex-col overflow-hidden rounded-[13px] text-[7px] leading-tight', gelap ? 'bg-slate-700 text-white' : 'bg-slate-50 text-ink')}>{children}</div>
            <span className="absolute left-1/2 top-[6px] h-1 w-6 -translate-x-1/2 rounded-full bg-ink" />
        </div>
    )
}

function HalamanUjian() {
    return (
        <div className="flex-1 space-y-1.5 p-2 pt-4">
            <div className="h-5 rounded-[4px] bg-primary" />
            <Garis />
            <Garis w="w-3/4" />
            <Garis w="w-5/6" />
            <div className="h-6 rounded-[4px] bg-white shadow-sm" />
        </div>
    )
}

function Baris({ children, sorot, ikon }: { children: ReactNode; sorot?: boolean; ikon?: ReactNode }) {
    const isi = (
        <span className="flex w-full items-center justify-between gap-1 bg-white px-1.5 py-1">
            <span className={sorot ? 'leading-[1.2]' : 'truncate'}>{children}</span>
            {ikon}
        </span>
    )

    return sorot ? <Sorot className="w-full">{isi}</Sorot> : isi
}

const Saklar = ({ nyala }: { nyala?: boolean }) => (
    <span className={cn('inline-flex h-2.5 w-4 shrink-0 items-center rounded-full p-px', nyala ? 'justify-end bg-green-500' : 'bg-slate-300')}>
        <span className="size-2 rounded-full bg-white" />
    </span>
)

const IkonApp = ({ besar }: { besar?: boolean }) => <img src="/brand/ikon-192.png" alt="" className={cn('rounded-[6px]', besar ? 'size-7' : 'size-5')} />

export function IlustrasiPanduan({ adegan }: { adegan: Adegan }) {
    switch (adegan) {
        case 'ios-bagikan':
            return (
                <HP>
                    <HalamanUjian />
                    <div className="flex items-center justify-around border-t border-slate-200 bg-white px-1 py-1.5 text-slate-500">
                        <ChevronLeft className="size-3" />
                        <ChevronRight className="size-3" />
                        <Sorot>
                            <Share className="size-3.5 text-sky-600" />
                        </Sorot>
                        <Square className="size-3" />
                    </div>
                </HP>
            )
        case 'ios-tambah':
            return (
                <HP>
                    <div className="flex-1 bg-slate-300/60" />
                    <div className="space-y-px rounded-t-[8px] bg-slate-100 p-1.5 pb-3">
                        <Baris>Salin</Baris>
                        <Baris>Tambah ke Daftar Bacaan</Baris>
                        <Baris sorot ikon={<Plus className="size-2.5" />}>
                            Tambahkan ke Layar Utama
                        </Baris>
                        <Baris>Cetak</Baris>
                    </div>
                </HP>
            )
        case 'ios-konfirmasi':
            return (
                <HP>
                    <div className="flex items-center justify-between bg-white px-1.5 pb-1 pt-4 font-semibold">
                        <span className="text-sky-600">Batal</span>
                        <Sorot>
                            <span className="px-0.5 text-sky-600">Tambah</span>
                        </Sorot>
                    </div>
                    <div className="m-1.5 flex items-center gap-1.5 rounded-[6px] bg-white p-1.5">
                        <IkonApp besar />
                        <span className="font-semibold">Ujian</span>
                    </div>
                    <div className="flex-1" />
                </HP>
            )
        case 'layar-utama':
            return (
                <HP gelap>
                    <div className="grid grid-cols-4 gap-1.5 p-2 pt-5">
                        {Array.from({ length: 11 }, (_, i) => (
                            <span key={i} className="aspect-square rounded-[5px] bg-white/25" />
                        ))}
                        <Sorot className="rounded-[6px]">
                            <IkonApp />
                        </Sorot>
                    </div>
                    <p className="mt-auto pb-2 text-center text-[6px] opacity-80">Ketuk ikon "Ujian"</p>
                </HP>
            )
        case 'ios-akses-terpandu':
            return (
                <HP>
                    <p className="px-1.5 pb-1 pt-4 font-bold">Akses Terpandu</p>
                    <div className="space-y-px px-1.5">
                        <Baris sorot ikon={<Saklar nyala />}>
                            Akses Terpandu
                        </Baris>
                        <Baris ikon={<ChevronRight className="size-2.5" />}>Pengaturan Kode Sandi</Baris>
                        <Baris ikon={<Saklar />}>Pintasan Aksesibilitas</Baris>
                    </div>
                    <div className="flex-1" />
                </HP>
            )
        case 'ios-klik-tiga':
            return (
                <div className="relative">
                    <HP>
                        <HalamanUjian />
                    </HP>
                    <span className="absolute -right-[3px] top-12 h-8 w-1.5 rounded-r-sm bg-magenta-500 ring-2 ring-magenta-500/30" />
                    <span className="absolute -right-1 top-[88px] rounded-full bg-magenta-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">3×</span>
                </div>
            )
        case 'ios-mulai-terpandu':
            return (
                <HP>
                    <div className="flex items-center justify-between bg-white px-1.5 pb-1 pt-4 font-semibold text-sky-600">
                        <span>Pilihan</span>
                        <Sorot>
                            <span className="px-0.5">Mulai</span>
                        </Sorot>
                    </div>
                    <div className="m-1.5 flex-1 rounded-[6px] border border-dashed border-sky-500 bg-white/70 p-1">
                        <HalamanUjian />
                    </div>
                </HP>
            )
        case 'android-menu':
            return (
                <HP>
                    <div className="flex items-center gap-1 bg-white px-1.5 pb-1 pt-4">
                        <span className="flex-1 truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-500">ujian.alakhyar…</span>
                        <Sorot>
                            <MoreVertical className="size-3" />
                        </Sorot>
                    </div>
                    <div className="absolute right-1 top-10 w-[70px] space-y-px rounded-[5px] bg-slate-100 p-0.5 shadow-md">
                        <Baris>Tab baru</Baris>
                        <Baris sorot>Instal aplikasi</Baris>
                        <Baris>Setelan</Baris>
                    </div>
                    <HalamanUjian />
                </HP>
            )
        case 'android-instal':
            return (
                <HP>
                    <div className="flex-1 bg-slate-300/60" />
                    <div className="absolute inset-x-1.5 top-14 rounded-[8px] bg-white p-2 shadow-md">
                        <p className="font-bold">Instal aplikasi?</p>
                        <div className="mt-1 flex items-center gap-1">
                            <IkonApp />
                            <span>Ujian Al Akhyar</span>
                        </div>
                        <div className="mt-2 flex justify-end gap-1.5 font-semibold text-primary">
                            <span>Batal</span>
                            <Sorot>
                                <span className="px-0.5">Instal</span>
                            </Sorot>
                        </div>
                    </div>
                </HP>
            )
        case 'android-sematkan-setelan':
            return (
                <HP>
                    <p className="px-1.5 pb-1 pt-4 font-bold">Sematkan aplikasi</p>
                    <div className="space-y-px px-1.5">
                        <Baris sorot ikon={<Saklar nyala />}>
                            Sematkan aplikasi
                        </Baris>
                        <Baris ikon={<Saklar nyala />}>Minta PIN saat melepas</Baris>
                    </div>
                    <div className="flex-1" />
                </HP>
            )
        case 'android-sematkan':
            return (
                <HP gelap>
                    <div className="flex flex-1 flex-col items-center justify-center gap-1 p-2">
                        <div className="relative mr-3 w-[64px] rounded-[6px] bg-slate-50 p-1 text-ink">
                            <div className="mb-1 flex items-center gap-1">
                                <Sorot className="rounded-[6px]">
                                    <IkonApp />
                                </Sorot>
                            </div>
                            <div className="space-y-1">
                                <Garis />
                                <Garis w="w-2/3" />
                            </div>
                            <div className="absolute left-[26px] top-1 rounded-[4px] bg-white p-0.5 shadow-md">
                                <span className="flex items-center gap-0.5 font-semibold text-primary">
                                    <Pin className="size-2" /> Sematkan
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-around pb-1.5 opacity-70">
                        <Triangle className="size-2.5 -rotate-90" />
                        <span className="size-2.5 rounded-full border border-white" />
                        <Square className="size-2.5" />
                    </div>
                </HP>
            )
        case 'android-lepas':
            return (
                <HP gelap>
                    <div className="flex flex-1 flex-col items-center justify-center gap-1">
                        <Lock className="size-5" />
                        <span className="text-[6px]">PIN untuk melepas</span>
                    </div>
                    <div className="flex justify-around pb-1.5">
                        <Sorot className="rounded-full">
                            <Triangle className="size-2.5 -rotate-90" />
                        </Sorot>
                        <span className="size-2.5 rounded-full border border-white opacity-60" />
                        <Sorot className="rounded-full">
                            <Square className="size-2.5" />
                        </Sorot>
                    </div>
                </HP>
            )
        case 'laptop-layar-penuh':
            return (
                <div aria-hidden className="mx-auto w-[150px] shrink-0">
                    <div className="rounded-t-[8px] border-[3px] border-ink bg-ink">
                        <div className="flex h-[84px] flex-col overflow-hidden rounded-[4px] bg-slate-50 text-[7px]">
                            <div className="flex items-center gap-1 bg-slate-200 px-1 py-0.5">
                                <span className="size-1 rounded-full bg-coral-500" />
                                <span className="size-1 rounded-full bg-amber-500" />
                                <span className="size-1 rounded-full bg-green-500" />
                                <span className="ml-1 flex-1 rounded-full bg-white px-1 text-slate-500">ujian.alakhyar…</span>
                            </div>
                            <div className="relative flex-1">
                                <HalamanUjian />
                                <div className="absolute inset-x-2 top-1 rounded-[4px] bg-white p-1 shadow-md">
                                    <p>Tampilkan layar penuh?</p>
                                    <div className="mt-0.5 flex justify-end">
                                        <Sorot>
                                            <span className="rounded-[3px] bg-primary px-1 text-white">Izinkan</span>
                                        </Sorot>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mx-auto h-1.5 w-[170px] -translate-x-[10px] rounded-b-[6px] bg-slate-300" />
                </div>
            )
    }
}
