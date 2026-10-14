import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import 'katex/dist/katex.min.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { router } from './router'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Galat aturan (4xx) tidak perlu dicoba ulang; jaringan ya.
            retry: (n, e) => n < 2 && !(e as { status?: number }).status,
            refetchOnWindowFocus: true,
        },
    },
})

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    </StrictMode>,
)
