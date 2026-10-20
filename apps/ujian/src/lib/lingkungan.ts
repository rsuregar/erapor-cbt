/**
 * Lingkungan build (VITE_LINGKUNGAN): `staging` = server uji, whitelabel oranye,
 * app id/nama terpisah sehingga bisa dipasang berdampingan dengan produksi.
 */
export const STAGING = __LINGKUNGAN__ === 'staging'

/** Host API yang dipakai build ini (untuk ditampilkan di penanda staging). */
export function hostApi(): string {
    const url = import.meta.env.VITE_API_URL
    if (!url) return 'server lokal (dev)'
    try {
        return new URL(url).host
    } catch {
        return url
    }
}
