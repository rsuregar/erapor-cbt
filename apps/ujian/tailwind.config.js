/**
 * Tema dari Al Akhyar Design System (organisasi, default):
 * https://claude.ai/artifact/1NGNPjebehvf5PQAcYC41Q — tokens/colors.css,
 * typography.css, layout.css. Ubah di sana dulu, lalu salin nilainya ke sini.
 */
/** @type {import('tailwindcss').Config} */
export default {
    // Renderer soal punya kelas dark:; app belum bertema gelap, jadi jangan ikut preferensi OS.
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/question-renderer/src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                // Biru tua — warna utama brand (#006195)
                primary: {
                    50: '#E6F0F6',
                    100: '#C0D9E9',
                    200: '#8FBBD6',
                    300: '#5B9CC3',
                    400: '#2E80B0',
                    500: '#006195',
                    600: '#005080',
                    700: '#004268',
                    800: '#003350',
                    900: '#00253B',
                    DEFAULT: '#006195',
                },
                // 700: teks di atas latar 100 (lencana) — kontras ≥ 4,5:1.
                sky: { 100: '#D6F0FB', 300: '#7ACFF0', 500: '#29ABE2', 600: '#1B93C6', 700: '#0D6A8F' },
                magenta: { 100: '#FCD9E6', 300: '#F583AC', 500: '#EC2A6B', 600: '#CE1D57' },
                coral: { 50: '#FDF1F0', 100: '#FBDDDA', 200: '#F6B9B3', 500: '#E8493F', 600: '#CE352C', 700: '#A92A22' },
                green: { 100: '#DCF5EA', 500: '#2FA97B', 600: '#218A62', 700: '#186A4B' },
                amber: { 100: '#FDEFCB', 500: '#F5A623', 700: '#8A6410', 900: '#5A3D00' },
                ink: '#1E2A32',
                slate: {
                    50: '#F5F8FA',
                    100: '#EEF2F6',
                    200: '#E1E7ED',
                    300: '#C6CED6',
                    400: '#94A0AB',
                    500: '#6B7683',
                    700: '#3F4B55',
                },
            },
            fontFamily: {
                sans: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
                display: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
            },
            fontSize: {
                micro: ['11px', '1.4'],
                xs: ['12px', '1.5'],
                sm: ['13px', '1.5'],
                body: ['15px', '1.5'],
                'body-lg': ['16px', '1.5'],
                title: ['18px', '1.3'],
                h3: ['21px', '1.3'],
                h2: ['26px', '1.3'],
                h1: ['32px', '1.15'],
                display: ['40px', '1.15'],
            },
            borderRadius: {
                xs: '6px',
                sm: '10px',
                md: '14px',
                lg: '18px',
                xl: '24px',
                '2xl': '28px',
            },
            boxShadow: {
                xs: '0 1px 2px rgba(0, 97, 149, 0.06)',
                sm: '0 2px 8px rgba(16, 42, 66, 0.06)',
                md: '0 6px 18px rgba(16, 42, 66, 0.08)',
                lg: '0 14px 34px rgba(16, 42, 66, 0.12)',
                brand: '0 10px 24px rgba(0, 97, 149, 0.22)',
                ring: '0 0 0 3px rgba(0, 97, 149, 0.28)',
            },
            transitionDuration: { fast: '120ms', base: '200ms', slow: '320ms' },
            transitionTimingFunction: { standard: 'cubic-bezier(0.4, 0, 0.2, 1)', out: 'cubic-bezier(0.16, 1, 0.3, 1)' },
            letterSpacing: { tight: '-0.02em', caps: '0.08em' },
            keyframes: {
                'progres-tak-tentu': { '0%': { left: '-35%' }, '100%': { left: '100%' } },
                goyang: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
                turun: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                denyut: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.35)' }, '100%': { transform: 'scale(1)' } },
            },
            animation: { goyang: 'goyang 320ms ease-in-out', turun: 'turun 220ms ease-out', denyut: 'denyut 600ms ease-out 2' },
        },
    },
    plugins: [],
}
