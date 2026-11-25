import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Galat aturan (4xx) tidak perlu dicoba ulang; jaringan ya.
            retry: (n, e) => n < 2 && !(e as { status?: number }).status,
            // Cache data tetap segar selama 1 menit agar tidak refetch berulang saat berpindah ke/dari dashboard
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
        },
    },
})
