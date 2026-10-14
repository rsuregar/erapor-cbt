import { KepalaFitur } from '@/komponen/KepalaFitur'
import { Kartu } from '@/komponen/Kartu'
import { KotakToken } from '@/komponen/KotakToken'
import { Lencana } from '@/komponen/Lencana'
import { Tombol } from '@/komponen/Tombol'
import { api } from '@/lib/api'
import { sesi } from '@/lib/sesi'
import { hariTanggal, jamMenit } from '@/lib/tanggal'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { BellOff, Clock, DownloadCloud, ListChecks, MapPin, ShieldCheck, Wifi } from 'lucide-react'
import { useState, type ReactNode } from 'react'

const KEAMANAN = { dasar: 'Dasar', ketat: 'Ketat', lockdown: 'Lockdown' } as const

/**
 * Konfirmasi sebelum mulai (PRD M-03): identitas, mapel, durasi, jumlah
 * soal, tata tertib, unduh paket, token. Alur unduh/mulai menyusul.
 */
export default function Persiapan({ ujianId }: { ujianId: number }) {
    const navigate = useNavigate()
    const [token, setToken] = useState('')
    const ujian = useQuery({ queryKey: ['ujian'], queryFn: () => api.daftarUjian(), select: (d) => d.find((u) => u.id === ujianId) })
    const u = ujian.data

    return (
        <div className="min-h-full pb-10">
            <KepalaFitur judul={u?.nama ?? 'Persiapan ujian'} subjudul={u?.mapel ?? undefined} onKembali={() => navigate({ to: '/' })} />

            <main className="mx-auto max-w-xl space-y-4 px-4 pt-5">
                {!u ? (
                    <p className="text-slate-500">{ujian.isPending ? 'Memuat…' : 'Ujian tidak ditemukan.'}</p>
                ) : (
                    <>
                        <Kartu className="space-y-3">
                            <div className="flex items-center gap-3">
                                <img src="/brand/logogram.png" alt="" className="size-11" />
                                <div>
                                    <p className="text-xs text-slate-500">Peserta</p>
                                    <p className="font-bold text-ink">{sesi.nama() ?? '—'}</p>
                                </div>
                            </div>
                            <dl className="grid grid-cols-2 gap-3 border-t border-dashed border-slate-200 pt-3 text-sm">
                                <Butir ikon={<Clock className="size-4" />} label="Waktu" isi={`${hariTanggal(u.dibuka_pada)}, ${jamMenit(u.dibuka_pada)}–${jamMenit(u.ditutup_pada)}`} />
                                <Butir ikon={<ListChecks className="size-4" />} label="Soal · durasi" isi={`${u.jumlah_soal} soal · ${u.durasi_menit + u.tambahan_waktu_menit} menit`} />
                                <Butir ikon={<MapPin className="size-4" />} label="Sesi" isi={u.sesi ? `${u.sesi.nama}${u.sesi.ruang ? ` · ${u.sesi.ruang}` : ''}` : '—'} />
                                <Butir ikon={<ShieldCheck className="size-4" />} label="Keamanan" isi={<Lencana nada={u.level_keamanan === 'dasar' ? 'neutral' : 'magenta'}>{KEAMANAN[u.level_keamanan]}</Lencana>} />
                            </dl>
                        </Kartu>

                        <Kartu className="space-y-2.5">
                            <h2 className="text-body-lg">Tata tertib</h2>
                            <Aturan ikon={<BellOff className="size-4" />}>Nyalakan mode Jangan Ganggu dan tutup aplikasi lain.</Aturan>
                            <Aturan ikon={<ShieldCheck className="size-4" />}>Jangan keluar dari aplikasi atau berpindah layar — tercatat sebagai pelanggaran.</Aturan>
                            <Aturan ikon={<Wifi className="size-4" />}>Jawaban tersimpan di perangkat walau internet putus, lalu terkirim otomatis.</Aturan>
                            <Aturan ikon={<Clock className="size-4" />}>Waktu mengikuti jam server; ujian terkumpul otomatis saat waktu habis.</Aturan>
                        </Kartu>

                        <Kartu className="space-y-4">
                            <div className="flex items-center gap-2 text-sm">
                                <DownloadCloud className="size-5 text-primary" />
                                <span className="mr-auto font-semibold text-ink">Paket soal</span>
                                <Lencana nada={u.bisa_unduh ? 'sky' : 'neutral'}>{u.bisa_unduh ? 'Siap diunduh' : 'Belum tersedia'}</Lencana>
                            </div>
                            <div className="space-y-2 text-center">
                                <p className="text-sm font-semibold text-ink">Masukkan token dari pengawas</p>
                                <KotakToken nilai={token} onUbah={setToken} />
                            </div>
                            <Tombol ukuran="lg" penuh disabled>
                                Mulai ujian
                            </Tombol>
                            <p className="text-center text-xs text-slate-500">Unduh paket dan layar mengerjakan sedang dibangun.</p>
                        </Kartu>
                    </>
                )}
            </main>
        </div>
    )
}

function Butir({ ikon, label, isi }: { ikon: ReactNode; label: string; isi: ReactNode }) {
    return (
        <div>
            <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                {ikon} {label}
            </dt>
            <dd className="mt-0.5 font-semibold text-ink">{isi}</dd>
        </div>
    )
}

function Aturan({ ikon, children }: { ikon: ReactNode; children: ReactNode }) {
    return (
        <p className="flex gap-2.5 text-sm">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">{ikon}</span>
            <span>{children}</span>
        </p>
    )
}

