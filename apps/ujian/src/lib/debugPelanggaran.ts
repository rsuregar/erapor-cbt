export type KunciCeklisDebug =
    | 'split_view'
    | 'slide_over_floating'
    | 'pindah_tab'
    | 'layar_penuh'
    | 'blokir_copy_cut'
    | 'blokir_paste'
    | 'blokir_klik_kanan'
    | 'blokir_seleksi_seret'
    | 'blokir_pintasan'

export type StatusCeklisDebug = 'belum' | 'sinyal' | 'tercatat'

export type ItemCeklisDebug = {
    kunci: KunciCeklisDebug
    label: string
    deskripsi: string
    status: StatusCeklisDebug
    jumlah: number
    detail?: string
    waktu?: string
}

export type EntriLogDebug = {
    id: number
    waktu: string
    kategori: string
    pesan: string
}

export const TEKS_CONTOH_SOAL_DEBUG =
    'Jelaskan mengapa peristiwa Rengasdengklok terjadi sebelum proklamasi kemerdekaan Indonesia!'

const PRIORITAS_STATUS: Record<StatusCeklisDebug, number> = {
    belum: 0,
    sinyal: 1,
    tercatat: 2,
}

/** Panel debug hanya boleh muncul di build PWA staging, tidak pernah di produksi maupun app native. */
export function bolehTampilDebugStaging(params: { staging: boolean; native: boolean }): boolean {
    return params.staging && !params.native
}

export function buatCeklisAwal(): ItemCeklisDebug[] {
    return [
        {
            kunci: 'split_view',
            label: 'Split View / Stage Manager',
            deskripsi: 'Bagi layar atau ubah ukuran jendela (tahan ≥ 5 dtk untuk ukuran_layar)',
            status: 'belum',
            jumlah: 0,
        },
        {
            kunci: 'slide_over_floating',
            label: 'Slide Over / Floating Menu',
            deskripsi: 'Buka Slide Over, menu …, Control Center, atau Quick Note (blur saat visible)',
            status: 'belum',
            jumlah: 0,
        },
        {
            kunci: 'pindah_tab',
            label: 'Pindah Tab / App Switcher',
            deskripsi: 'Pindah tab, tekan Home, atau buka app lain (visibility: hidden ≥ 5 dtk)',
            status: 'belum',
            jumlah: 0,
        },
        {
            kunci: 'layar_penuh',
            label: 'Keluar Layar Penuh',
            deskripsi: 'Masuk lalu keluar fullscreen (desktop/browser yang mendukung)',
            status: 'belum',
            jumlah: 0,
        },
        {
            kunci: 'blokir_copy_cut',
            label: 'Blokir Copy & Cut',
            deskripsi: 'Coba salin/potong teks contoh soal atau isi kolom jawaban',
            status: 'belum',
            jumlah: 0,
        },
        {
            kunci: 'blokir_paste',
            label: 'Blokir Paste / Tempel',
            deskripsi: 'Coba tempel ke kolom uji (menu iOS, 3 jari, Cmd+V, QuickType)',
            status: 'belum',
            jumlah: 0,
        },
        {
            kunci: 'blokir_klik_kanan',
            label: 'Blokir Klik Kanan / Tekan Lama',
            deskripsi: 'Coba klik kanan atau tekan lama konteks menu',
            status: 'belum',
            jumlah: 0,
        },
        {
            kunci: 'blokir_seleksi_seret',
            label: 'Blokir Seleksi & Seret',
            deskripsi: 'Coba seleksi teks contoh soal atau seret gambar',
            status: 'belum',
            jumlah: 0,
        },
        {
            kunci: 'blokir_pintasan',
            label: 'Blokir Pintasan Keyboard',
            deskripsi: 'Coba Cmd/Ctrl+C/V/X/P/S/U/R atau F12',
            status: 'belum',
            jumlah: 0,
        },
    ]
}

export function perbaruiCeklis(
    daftar: ItemCeklisDebug[],
    kunci: KunciCeklisDebug,
    statusBaru: Exclude<StatusCeklisDebug, 'belum'>,
    detail: string,
    waktu: string,
): ItemCeklisDebug[] {
    return daftar.map((item) => {
        if (item.kunci !== kunci) return item
        const status =
            PRIORITAS_STATUS[statusBaru] >= PRIORITAS_STATUS[item.status] ? statusBaru : item.status
        return {
            ...item,
            status,
            jumlah: item.jumlah + 1,
            detail,
            waktu,
        }
    })
}

export function tambahLogDebug(
    log: EntriLogDebug[],
    kategori: string,
    pesan: string,
    waktu: string,
    id: number,
    maks = 30,
): EntriLogDebug[] {
    return [{ id, waktu, kategori, pesan }, ...log].slice(0, maks)
}

export function formatWaktuDebug(date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
