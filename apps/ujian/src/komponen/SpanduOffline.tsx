import { Tombol } from '@/komponen/Tombol'
import { bukaPengaturanWifi, isTauri } from '@/lib/native'
import { jamMenit } from '@/lib/tanggal'
import { CloudOff, Wifi } from 'lucide-react'
import { useState } from 'react'

/** Spanduk offline di luar layar ujian: data yang tampil adalah salinan terakhir di perangkat. */
export function SpanduOffline({ pada, children }: { pada?: number; children?: React.ReactNode }) {
    const [membuka, setMembuka] = useState(false)
    const [galat, setGalat] = useState(false)

    const bukaWifi = async () => {
        setMembuka(true)
        setGalat(false)
        try {
            await bukaPengaturanWifi({ pulihkanKiosk: true })
        } catch {
            setGalat(true)
        } finally {
            setMembuka(false)
        }
    }

    return (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2.5 rounded-md bg-amber-100 px-3.5 py-3 text-sm text-amber-900">
            <div className="flex flex-1 gap-2.5">
                <CloudOff className="mt-0.5 size-4 shrink-0" />
                <div>
                    <p>
                        <b>Kamu sedang offline.</b>
                        {pada ? ` Daftar terakhir diperbarui ${jamMenit(new Date(pada).toISOString())}.` : ''} {children}
                    </p>
                    {galat && <p className="mt-1 text-xs font-semibold text-coral-700">Tidak bisa membuka pengaturan Wi-Fi.</p>}
                </div>
            </div>
            {isTauri() && (
                <Tombol
                    varian="outline"
                    ukuran="sm"
                    disabled={membuka}
                    ikonKiri={<Wifi className="size-3.5" />}
                    className="shrink-0 bg-white/90"
                    onClick={() => void bukaWifi()}
                >
                    {membuka ? 'Membuka…' : 'Ganti Wi-Fi'}
                </Tombol>
            )}
        </div>
    )
}
