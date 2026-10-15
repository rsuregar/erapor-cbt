/**
 * Bandingkan versi semver per bagian angka (kontrak § Versi aplikasi):
 * "1.10.0" > "1.9.0", akhiran pra-rilis diabaikan, awalan "v" diterima.
 * null bila salah satu bukan semver (tidak dicek, sama seperti server).
 */
export function bandingkanVersi(a: string, b: string): number | null {
    const urai = (v: string) => {
        const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim())

        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
    }
    const x = urai(a)
    const y = urai(b)
    if (!x || !y) return null
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1

    return 0
}

/** Versi app ini lebih lama dari minimum? null minimum = tidak dicek. */
export function versiUsang(versiApp: string, minimum: string | null | undefined): boolean {
    return !!minimum && (bandingkanVersi(versiApp, minimum) ?? 0) < 0
}
