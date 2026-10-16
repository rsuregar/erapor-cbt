export function ukuranBerkas(byte: number): string {
    if (byte < 1024) return `${byte} B`
    if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`

    return `${(byte / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** 5400 → "01:30:00", 75 → "01:15", 90000 → "1 hr 01:00:00" */
export function waktuMundur(detik: number): string {
    const d = Math.max(0, Math.floor(detik))
    const dua = (n: number) => String(n).padStart(2, '0')
    const hari = Math.floor(d / 86400)
    const j = Math.floor((d % 86400) / 3600)
    const m = Math.floor((d % 3600) / 60)
    const s = d % 60

    if (hari > 0) {
        return `${hari} hr ${dua(j)}:${dua(m)}:${dua(s)}`
    }

    return j > 0 ? `${dua(j)}:${dua(m)}:${dua(s)}` : `${dua(m)}:${dua(s)}`
}
