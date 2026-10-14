import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...kelas: ClassValue[]) {
    return twMerge(clsx(kelas))
}
