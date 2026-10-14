import { useEffect, useState } from 'react'

/** navigator.onLine + event online/offline — berubah seketika, tanpa menunggu permintaan gagal. */
export function useOnline(): boolean {
    const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
    useEffect(() => {
        const naik = () => setOnline(true)
        const turun = () => setOnline(false)
        window.addEventListener('online', naik)
        window.addEventListener('offline', turun)

        return () => {
            window.removeEventListener('online', naik)
            window.removeEventListener('offline', turun)
        }
    }, [])

    return online
}
