#!/usr/bin/env node
/**
 * Pembuat ikon aplikasi CBT Al Akhyar — satu desain, semua platform:
 *   PWA      apps/ujian/public/brand/ (+ staging/)
 *   Android  apps/ujian/android/app/src/{main,staging}/res/mipmap-*
 *   Desktop  scripts/ikon/keluaran/desktop-{production,staging}.png
 *            → `npx tauri icon` (lihat README) membuat .ico/.icns/PNG Tauri.
 *
 * Desain: ubin gradasi biru brand (#006195) + siluet kubah samar dari logo,
 * buku terbuka & bintang putih (inti logo Al Akhyar) — logo lengkap dengan
 * tulisan tidak terbaca di 48 px. Staging: gradasi kuning-oranye + pita
 * "STAGING", supaya tidak tertukar dengan produksi di layar HP/laptop.
 *
 * Jalankan: node scripts/ikon/buat-ikon.mjs
 */
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const APP = join(AKAR, 'apps', 'ujian')

const WARNA = {
    production: { atas: '#0E86C6', bawah: '#004A73', kubah: '#FFFFFF' },
    staging: { atas: '#F7B733', bawah: '#E0532F', kubah: '#FFFFFF' },
}

// ——— Bagian gambar (ruang 1024 × 1024) ——————————————————————————————

function bintang(cx, cy, luar, dalam) {
    const titik = []
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? luar : dalam
        const sudut = ((-90 + i * 36) * Math.PI) / 180
        titik.push(`${(cx + r * Math.cos(sudut)).toFixed(1)},${(cy + r * Math.sin(sudut)).toFixed(1)}`)
    }

    return `<polygon points="${titik.join(' ')}" fill="#FFFFFF"/>`
}

/** Buku terbuka + bintang, berpusat di (512, 509). */
function simbol(warnaPunggung) {
    return `
    ${bintang(512, 318, 66, 28)}
    <path d="M512 452 C452 412 360 400 262 420 L262 668 C360 650 452 660 512 702 Z" fill="#FFFFFF"/>
    <path d="M512 452 C572 412 664 400 762 420 L762 668 C664 650 572 660 512 702 Z" fill="#FFFFFF"/>
    <path d="M512 452 L512 702" stroke="${warnaPunggung}" stroke-width="16" stroke-linecap="round"/>
    <path d="M300 470 C370 458 430 466 482 490 M300 530 C370 518 430 526 482 550 M300 590 C370 578 430 586 482 610
             M724 470 C654 458 594 466 542 490 M724 530 C654 518 594 526 542 550 M724 590 C654 578 594 586 542 610"
          stroke="${warnaPunggung}" stroke-opacity="0.22" stroke-width="10" stroke-linecap="round" fill="none"/>
    <path d="M236 690 C352 668 448 678 512 726 C576 678 672 668 788 690 L788 716 C672 696 576 706 512 756 C448 706 352 696 236 716 Z" fill="#FFFFFF"/>`
}

/** Siluet kubah (gema logo) di latar. */
const KUBAH = `<path d="M512 96 C532 186 604 230 694 290 C810 368 846 470 846 566 L846 1024 L178 1024 L178 566 C178 470 214 368 330 290 C420 230 492 186 512 96 Z"`

function latar(env, id) {
    const w = WARNA[env]

    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${w.atas}"/><stop offset="1" stop-color="${w.bawah}"/></linearGradient></defs>`
}

function pita(y, tinggi) {
    return `<rect x="0" y="${y}" width="1024" height="${tinggi}" fill="#1E2A32" fill-opacity="0.9"/>
    <text x="512" y="${y + tinggi * 0.7}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
          font-weight="800" font-size="${tinggi * 0.62}" letter-spacing="${tinggi * 0.08}" fill="#FFFFFF">STAGING</text>`
}

/**
 * Varian:
 * - ubin   : ubin bersudut bulat penuh kanvas (PWA "any", favicon, Android lama)
 * - macos  : ubin bermargin + bayangan ala macOS (desktop Tauri)
 * - penuh  : persegi tanpa sudut, isi di zona aman (maskable, apple-touch)
 * - bulat  : lingkaran (Android ic_launcher_round)
 * - depan  : simbol saja, transparan (Android adaptive foreground)
 * - belakang: latar saja (Android adaptive background)
 */
function svg(varian, env) {
    const w = WARNA[env]
    const staging = env === 'staging'
    const g = `g-${varian}`
    const isi = (skala, dy = 0) =>
        `<g transform="translate(512 ${509 + dy}) scale(${skala}) translate(-512 -509)">${simbol(w.bawah)}</g>`
    const kubah = `${KUBAH} fill="${w.kubah}" fill-opacity="0.09"/>`

    switch (varian) {
        case 'ubin':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${latar(env, g)}
                <clipPath id="k"><rect width="1024" height="1024" rx="228"/></clipPath>
                <g clip-path="url(#k)"><rect width="1024" height="1024" fill="url(#${g})"/>${kubah}
                ${staging ? isi(0.9, -46) + pita(800, 170) : isi(1.06)}</g></svg>`
        case 'macos':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${latar(env, g)}
                <filter id="b" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.28"/></filter>
                <clipPath id="k"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>
                <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#${g})" filter="url(#b)"/>
                <g clip-path="url(#k)">${kubah}
                <g transform="translate(512 512) scale(0.805) translate(-512 -512)">${staging ? isi(0.9, -46) + pita(800, 170) : isi(1.06)}</g></g></svg>`
        case 'penuh':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${latar(env, g)}
                <rect width="1024" height="1024" fill="url(#${g})"/>${kubah}${isi(0.92)}</svg>`
        case 'bulat':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${latar(env, g)}
                <clipPath id="k"><circle cx="512" cy="512" r="512"/></clipPath>
                <g clip-path="url(#k)"><rect width="1024" height="1024" fill="url(#${g})"/>${kubah}${isi(0.86)}</g></svg>`
        case 'depan':
            // Zona aman adaptive icon: lingkaran 66/108 kanvas → simbol diperkecil.
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${isi(0.78)}</svg>`
        case 'belakang':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${latar(env, g)}
                <rect width="1024" height="1024" fill="url(#${g})"/>${kubah}</svg>`
    }
    throw new Error(`varian tidak dikenal: ${varian}`)
}

function tulis(berkas, svgTeks, ukuran) {
    mkdirSync(dirname(berkas), { recursive: true })
    const png = new Resvg(svgTeks, { fitTo: { mode: 'width', value: ukuran }, font: { loadSystemFonts: true } }).render().asPng()
    writeFileSync(berkas, png)
}

const KERAPATAN = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

for (const env of ['production', 'staging']) {
    const staging = env === 'staging'

    // PWA
    const pwa = join(APP, 'public', 'brand', staging ? 'staging' : '')
    tulis(join(pwa, 'ikon-192.png'), svg('ubin', env), 192)
    tulis(join(pwa, 'ikon-512.png'), svg('ubin', env), 512)
    tulis(join(pwa, 'ikon-maskable-512.png'), svg('penuh', env), 512)
    tulis(join(pwa, 'apple-touch-icon.png'), svg('penuh', env), 180)
    tulis(join(pwa, 'favicon-32.png'), svg('ubin', env), 32)
    writeFileSync(join(pwa, 'favicon.svg'), svg('ubin', env).replace(/\s+/g, ' '))

    // Android (staging = source set app/src/staging, lihat build.gradle)
    const res = join(APP, 'android', 'app', 'src', staging ? 'staging' : 'main', 'res')
    for (const [d, k] of Object.entries(KERAPATAN)) {
        tulis(join(res, `mipmap-${d}`, 'ic_launcher.png'), svg('ubin', env), 48 * k)
        tulis(join(res, `mipmap-${d}`, 'ic_launcher_round.png'), svg('bulat', env), 48 * k)
        tulis(join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'), svg('depan', env), 108 * k)
        tulis(join(res, `mipmap-${d}`, 'ic_launcher_background.png'), svg('belakang', env), 108 * k)
    }

    // Desktop: sumber 1024 untuk `npx tauri icon`.
    tulis(join(AKAR, 'scripts', 'ikon', 'keluaran', `desktop-${env}.png`), svg('macos', env), 1024)
    // Pratinjau (README / tinjauan desain).
    tulis(join(AKAR, 'scripts', 'ikon', 'keluaran', `pratinjau-ubin-${env}.png`), svg('ubin', env), 512)
}

console.log('Ikon dibuat: PWA, Android (main + staging), sumber desktop di scripts/ikon/keluaran/.')
