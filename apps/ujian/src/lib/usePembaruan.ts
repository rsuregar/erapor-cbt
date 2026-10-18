import { cekPembaruan, platformRilis, type InfoPembaruan } from '@/lib/pembaruan'
import { useOnline } from '@/lib/useOnline'
import { useQuery } from '@tanstack/react-query'

const ENAM_JAM_MS = 6 * 60 * 60 * 1000

/** Pembaruan app yang tersedia di GitHub Releases; null = terbaru / belum dicek / offline / gagal cek. */
export function usePembaruan(): InfoPembaruan | null {
    const online = useOnline()
    const { data } = useQuery({
        queryKey: ['pembaruan-app'],
        queryFn: cekPembaruan,
        enabled: online && platformRilis() !== null,
        staleTime: ENAM_JAM_MS,
        retry: false,
        refetchOnWindowFocus: false,
    })

    return data ?? null
}
