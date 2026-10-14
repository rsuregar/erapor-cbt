import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Ukuran font brand (tailwind.config.js) harus dikenal sebagai ukuran font;
// tanpa ini `text-body-lg` dianggap warna dan `text-white` ikut dibuang.
const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            'font-size': [{ text: ['micro', 'body', 'body-lg', 'title', 'h3', 'h2', 'h1', 'display'] }],
            shadow: [{ shadow: ['ring', 'brand'] }],
        },
    },
})

export function cn(...kelas: ClassValue[]) {
    return twMerge(clsx(kelas))
}
