#!/usr/bin/env node
import { mkdirSync, writeFileSync, copyFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'apps/ujian/dist');
const brandSrc = resolve(rootDir, 'apps/ujian/public/brand');
const brandDest = resolve(distDir, 'brand');

// Parse CLI flags
const args = process.argv.slice(2);
// 'maintenance' | 'web_disabled' (blokir semua) | 'web_ios_only' (hanya PWA iPhone/iPad; butuh build
// app dengan VITE_AKSES_WEB=ios_pwa di apps/ujian/dist lebih dulu)
let mode = 'web_disabled';
let customMessage = '';
let target = 'production';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mode' && args[i + 1]) {
    mode = args[++i];
  } else if (args[i] === '--message' && args[i + 1]) {
    customMessage = args[++i];
  } else if (args[i] === '--target' && args[i + 1]) {
    target = args[++i];
  }
}

const MODE = ['maintenance', 'web_disabled', 'web_ios_only'];
if (!MODE.includes(mode)) {
  console.error(`[maintenance-pwa] Mode tidak dikenal: "${mode}" (pilihan: ${MODE.join(', ')})`);
  process.exit(1);
}

console.log(`[maintenance-pwa] Generating PWA in mode: "${mode}" for target: "${target}"`);

const isIosOnly = mode === 'web_ios_only';

if (isIosOnly) {
  // App penuh tetap dilayani untuk iPhone/iPad; skrip ini hanya menambah halaman blokir.
  if (!existsSync(resolve(distDir, 'index.html'))) {
    console.error('[maintenance-pwa] apps/ujian/dist kosong: jalankan dulu `VITE_AKSES_WEB=ios_pwa npm run build`.');
    process.exit(1);
  }
} else {
  // Clean and prepare dist directory
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });
  mkdirSync(brandDest, { recursive: true });

  // Copy brand assets if available
  if (existsSync(brandSrc)) {
    const files = readdirSync(brandSrc);
    for (const file of files) {
      if (!file.startsWith('.')) {
        copyFileSync(join(brandSrc, file), join(brandDest, file));
      }
    }
    console.log(`[maintenance-pwa] ✓ Copied brand assets to ${brandDest}`);
  }
}

const isMaintenance = mode === 'maintenance';

const title = isMaintenance
  ? 'Pemeliharaan Sistem · CBT Al Akhyar'
  : 'Akses Web Dinonaktifkan · CBT Al Akhyar';

const badgeText = isMaintenance
  ? 'Sedang Dalam Pemeliharaan'
  : 'Wajib Menggunakan Aplikasi Resmi';

const badgeBg = isMaintenance
  ? 'background-color: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;'
  : 'background-color: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;';

const iconSvg = isMaintenance
  ? `<svg class="hero-icon" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>`
  : `<svg class="hero-icon" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>`;

const heading = isMaintenance
  ? 'Layanan CBT Web Sedang Dalam Pemeliharaan'
  : isIosOnly
    ? 'Akses Web Hanya untuk iPhone/iPad'
    : 'Akses Ujian via Web Browser Dinonaktifkan';

const defaultDesc = isMaintenance
  ? 'Sistem ujian online sedang dalam proses pemeliharaan rutin atau peningkatan performa server. Silakan hubungi proktor / pengawas ujian untuk informasi jadwal lebih lanjut.'
  : isIosOnly
    ? 'Demi menjaga integritas ujian, laptop dan ponsel Android wajib memakai Aplikasi Resmi CBT Al Akhyar. Peserta iPhone/iPad: buka alamat ini di Safari, ketuk Bagikan → Tambahkan ke Layar Utama, lalu buka ujian dari ikon CBT Al Akhyar.'
    : 'Demi menjaga keamanan, kestabilan, dan integritas pelaksanaan ujian, akses menggunakan peramban web (browser) saat ini dinonaktifkan. Silakan gunakan Aplikasi Resmi CBT Al Akhyar di laptop atau ponsel Anda.';

const description = customMessage && customMessage.trim().length > 0 ? customMessage.trim() : defaultDesc;

const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <meta name="description" content="${heading}">
  <meta name="theme-color" content="#006195">
  <link rel="icon" type="image/png" href="brand/ikon-192.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background-color: #F5F8FA;
      color: #1E2A32;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem 1rem;
      line-height: 1.5;
    }
    .container {
      width: 100%;
      max-width: 580px;
      background: #FFFFFF;
      border-radius: 24px;
      box-shadow: 0 14px 34px rgba(16, 42, 66, 0.08), 0 2px 6px rgba(16, 42, 66, 0.04);
      border: 1px solid #E1E7ED;
      overflow: hidden;
      animation: fadeIn 350ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(14px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .header-bar {
      background: linear-gradient(135deg, #006195 0%, #004268 100%);
      padding: 1.75rem 2rem 1.5rem;
      text-align: center;
      color: #FFFFFF;
      position: relative;
    }
    .logo {
      height: 48px;
      width: auto;
      margin: 0 auto 0.75rem;
      display: block;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
    }
    .header-title {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      opacity: 0.95;
    }
    .card-body {
      padding: 2.25rem 2rem;
      text-align: center;
    }
    .icon-wrapper {
      width: 68px;
      height: 68px;
      border-radius: 20px;
      background: ${isMaintenance ? '#FFFBEB' : '#FEF2F2'};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;
      border: 1px solid ${isMaintenance ? '#FDE68A' : '#FECACA'};
    }
    .hero-icon {
      width: 34px;
      height: 34px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      margin-bottom: 1rem;
      ${badgeBg}
    }
    .badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: currentColor;
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
    h1 {
      font-size: 1.45rem;
      font-weight: 800;
      color: #1E2A32;
      letter-spacing: -0.02em;
      margin-bottom: 0.85rem;
      line-height: 1.3;
    }
    p.desc {
      font-size: 0.95rem;
      color: #6B7683;
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    .app-options {
      background: #F8FAFC;
      border: 1px solid #EEF2F6;
      border-radius: 16px;
      padding: 1.25rem;
      text-align: left;
      margin-bottom: 1.75rem;
    }
    .app-options-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #006195;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .app-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.65rem;
    }
    @media (max-width: 480px) {
      .app-grid {
        grid-template-columns: 1fr;
      }
    }
    .app-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.65rem 0.85rem;
      background: #FFFFFF;
      border: 1px solid #E1E7ED;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #3F4B55;
      text-decoration: none;
      transition: all 180ms ease;
    }
    .app-item:hover {
      border-color: #006195;
      background: #E6F0F6;
      color: #006195;
      transform: translateY(-1px);
    }
    .app-item svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: #006195;
    }
    .btn-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      background-color: #006195;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 0.95rem;
      padding: 0.85rem 1.25rem;
      border-radius: 14px;
      border: none;
      cursor: pointer;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(0, 97, 149, 0.22);
      transition: all 200ms ease;
    }
    .btn-action:hover {
      background-color: #005080;
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(0, 97, 149, 0.28);
    }
    .footer-note {
      margin-top: 1.5rem;
      font-size: 0.82rem;
      color: #94A0AB;
      text-align: center;
    }
    .footer-note strong {
      color: #6B7683;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <img src="brand/lockup-putih.png" alt="Al Akhyar Islamic School" class="logo" onerror="this.style.display='none'">
      <div class="header-title">CBT Al Akhyar · Exam Portal</div>
    </div>
    <div class="card-body">
      <div class="icon-wrapper">
        ${iconSvg}
      </div>
      <div class="badge">
        <span class="badge-dot"></span>
        <span>${badgeText}</span>
      </div>
      <h1>${heading}</h1>
      <p class="desc">${description}</p>

      <div class="app-options">
        <div class="app-options-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Gunakan Aplikasi Resmi Berikut:
        </div>
        <div class="app-grid">
          <div class="app-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
            <span>Windows (Exam Browser)</span>
          </div>
          <div class="app-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/></svg>
            <span>macOS (Exam Browser)</span>
          </div>
          <div class="app-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>
            <span>Android (APK Resmi)</span>
          </div>
          ${mode === 'web_disabled' ? '' : `<div class="app-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>
            <span>iPhone/iPad (Pasang dari Safari)</span>
          </div>`}
        </div>
      </div>

      <button onclick="location.reload()" class="btn-action">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
        <span>Periksa Status / Muat Ulang</span>
      </button>

      <div class="footer-note">
        Butuh bantuan atau informasi ujian? Hubungi <strong>Pengawas Ujian</strong> atau <strong>Tim IT Al Akhyar</strong>.
      </div>
    </div>
  </div>

  <script>
    // Clean up any stale service workers or exam caches immediately
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        for (var r of regs) {
          r.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (var name of names) {
          caches.delete(name);
        }
      });
    }
  </script>
</body>
</html>
`;

if (isIosOnly) {
  // Tujuan pengalihan app (apps/ujian/src/lib/aksesWeb.ts); index.html, sw.js & manifest tetap milik app.
  writeFileSync(resolve(distDir, 'web-nonaktif.html'), htmlContent, 'utf8');
  console.log(`[maintenance-pwa] ✓ Created ${resolve(distDir, 'web-nonaktif.html')}`);
  console.log('[maintenance-pwa] Done!');
  process.exit(0);
}

writeFileSync(resolve(distDir, 'index.html'), htmlContent, 'utf8');
writeFileSync(resolve(distDir, '404.html'), htmlContent, 'utf8');
console.log(`[maintenance-pwa] ✓ Created ${resolve(distDir, 'index.html')} and 404.html`);

// Self-unregistering Service Worker so clients polling sw.js immediately clean up
const unregisterSw = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      return self.clients.matchAll({ type: 'window' });
    }).then((clients) => {
      for (const client of clients) {
        client.navigate(client.url);
      }
    })
  );
});
`;
writeFileSync(resolve(distDir, 'sw.js'), unregisterSw.trim(), 'utf8');
console.log(`[maintenance-pwa] ✓ Created ${resolve(distDir, 'sw.js')} (self-unregistering)`);

// Valid minimal manifest
const minimalManifest = JSON.stringify({
  name: "CBT Al Akhyar",
  short_name: "CBT",
  start_url: "/",
  display: "standalone",
  background_color: "#006195",
  theme_color: "#006195",
  icons: [
    {
      src: "brand/ikon-192.png",
      sizes: "192x192",
      type: "image/png"
    }
  ]
}, null, 2);
writeFileSync(resolve(distDir, 'manifest.webmanifest'), minimalManifest, 'utf8');
console.log(`[maintenance-pwa] ✓ Created ${resolve(distDir, 'manifest.webmanifest')}`);

console.log('[maintenance-pwa] Done!');
