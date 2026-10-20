/**
 * Kunci zoom manual di PWA/HP. Meta viewport (maximum-scale=1, user-scalable=no)
 * cukup untuk Android/Chrome, tapi Safari iOS mengabaikannya sejak iOS 10 —
 * cubit dan ketuk-dua-kali ditahan lewat event gesture/touch. Ukuran teks soal
 * tetap bisa diatur lewat A-/A+ di layar ujian.
 */
if (typeof document !== 'undefined') {
    const tahan = (e: Event) => e.preventDefault()
    // Safari: cubit-zoom.
    document.addEventListener('gesturestart', tahan, { passive: false })
    document.addEventListener('gesturechange', tahan, { passive: false })
    document.addEventListener('gestureend', tahan, { passive: false })
    // Dua jari di atas layar (browser lain yang mengabaikan meta viewport).
    document.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false })
}
