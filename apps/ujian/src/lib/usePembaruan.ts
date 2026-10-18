import { cekPembaruan, platformRilis, TTL_CEK_PEMBARUAN_MS, type InfoPembaruan } from '@/lib/pembaruan'
import { useOnline } from '@/lib/useOnline'
import { useQuery } from '@tanstack/react-query'

/** Pembaruan app yang tersedia di GitHub Releases; null = terbaru / belum dicek / offline / gagal cek. */
export function usePembaruan(): InfoPembaruan | null {
    const online = useOnline()
    const { data } = useQuery({
        queryKey: ['pembaruan-app'],
        queryFn: cekPembaruan,
        enabled: online && platformRilis() !== null,
        // App dibiarkan terbuka berjam-jam di lab: cek ulang setelah jeda yang sama dengan cache.
        staleTime: TTL_CEK_PEMBARUAN_MS,
        refetchInterval: TTL_CEK_PEMBARUAN_MS,
        retry: false,
        refetchOnWindowFocus: false,
    })

    return data ?? null
}
