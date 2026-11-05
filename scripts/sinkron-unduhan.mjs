#!/usr/bin/env node
// Sinkronkan daftar unduhan resmi terbaru (Android, macOS, Windows) dari GitHub Releases
// langsung ke apps/ujian/src/lib/dataUnduhan.ts.
//
// Dipanggil setiap kali ada rilis (semua atau sebagian), agar halaman unduh aplikasi di CBT
// selalu menampilkan tautan, versi, dan ukuran berkas terbaru secara deterministik tanpa
// tergantung pada cache browser atau rate limit GitHub API di klien.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uraiTag } from './catatan-rilis.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.RELEASE_REPO || 'rsuregar/erapor-cbt-releases';

const BERKAS_POLA = {
  windows: [/\.exe$/i, /\.msi$/i],
  macos: [/arm64\.dmg$/i, /universal\.dmg$/i, /\.dmg$/i],
  macos_intel: [/x64\.dmg$/i, /x86_64\.dmg$/i],
  android: [/\.apk$/i],
};

const JENIS_TAG = {
  windows: ['desktop', 'win', 'all', 'universal'],
  macos: ['desktop', 'macos', 'all', 'universal'],
  macos_intel: ['desktop', 'macos', 'all', 'universal'],
  android: ['mobile', 'android', 'all', 'universal'],
};

function ambilRilis() {
  // Coba pakai gh CLI dulu bila tersedia & terautentikasi
  try {
    const raw = execFileSync('gh', ['api', `repos/${REPO}/releases?per_page=30`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(raw);
  } catch {
    // Abaikan kegagalan gh, jatuh ke fetch
  }

  // Fallback: fetch via curl atau node https
  const headers = ['-H', 'Accept: application/vnd.github+json'];
  if (process.env.GH_TOKEN) {
    headers.push('-H', `Authorization: Bearer ${process.env.GH_TOKEN}`);
  }
  const raw = execFileSync('curl', ['-s', ...headers, `https://api.github.com/repos/${REPO}/releases?per_page=30`], {
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

function bandingkanVersi(a, b) {
  const urai = (v) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const x = urai(a);
  const y = urai(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}

function prosesUnduhan(daftarRilis) {
  const hasil = {};

  for (const platform of ['windows', 'macos', 'macos_intel', 'android']) {
    const targetTag = JENIS_TAG[platform];
    const polaBerkas = BERKAS_POLA[platform];
    let terbaik = null;

    for (const r of daftarRilis) {
      if (r.draft || r.prerelease) continue;
      const u = uraiTag(r.tag_name);
      if (!u || !targetTag.includes(u.jenis)) continue;

      // Lewati jika versinya lebih rendah dari rilis terbaik yang sudah ditemukan
      if (terbaik && bandingkanVersi(u.versi, terbaik.versi) <= 0) continue;

      let asetTerpilih = null;
      for (const p of polaBerkas) {
        asetTerpilih = r.assets?.find((a) => p.test(a.name));
        if (asetTerpilih) break;
      }

      if (asetTerpilih) {
        terbaik = {
          versi: u.versi,
          unduh: asetTerpilih.browser_download_url,
          halaman: r.html_url,
          ukuran: asetTerpilih.size || undefined,
        };
      }
    }

    if (terbaik) {
      hasil[platform] = terbaik;
    }
  }

  return hasil;
}
try {
  console.log(`[sinkron-unduhan] Mengambil rilis terbaru dari ${REPO}...`);
  const rilis = ambilRilis();
  if (!Array.isArray(rilis)) {
    throw new Error(`Respons rilis tidak valid: ${JSON.stringify(rilis).slice(0, 100)}`);
  }

  const unduhan = prosesUnduhan(rilis);
  console.log('[sinkron-unduhan] Hasil ekstrak:', unduhan);

  const isiBerkas = `// Berkas ini di-generate otomatis oleh scripts/sinkron-unduhan.mjs
// Jangan ubah manual. Jalankan: npm run unduh:sinkron
import type { DaftarUnduhan } from './pembaruan'

export const UNDUHAN_TERBARU: DaftarUnduhan = ${JSON.stringify(unduhan, null, 4)} as const
`;

  const outputPath = resolve(rootDir, 'apps/ujian/src/lib/dataUnduhan.ts');
  writeFileSync(outputPath, isiBerkas, 'utf8');
  console.log(`[sinkron-unduhan] ✓ Berhasil menulis ke ${outputPath}`);
} catch (e) {
  console.error('[sinkron-unduhan] Gagal:', e.message);
  process.exit(1);
}
