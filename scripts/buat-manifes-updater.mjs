#!/usr/bin/env node
// Buat manifes updater Tauri (format "static JSON") untuk satu platform desktop.
// Dibaca app lewat perintah Rust `pasang_pembaruan` (apps/ujian/src-tauri/src/pembaruan.rs);
// URL-nya ditemukan web dari aset rilis bernama *-updater.json (apps/ujian/src/lib/pembaruan.ts).
//
// Usage: node scripts/buat-manifes-updater.mjs <keluaran.json> <versi> <target-arch> <url-berkas> <berkas.sig>
//   target-arch: windows-x86_64 | darwin-aarch64 | darwin-x86_64 | ...
//                (boleh beberapa, dipisah koma, untuk satu berkas yang melayani banyak arsitektur,
//                mis. build macOS universal: darwin-aarch64,darwin-x86_64)
//   url-berkas:  URL unduhan aset pembaruan di repo rilis (pemasang .exe / .app.tar.gz)
import { readFileSync, writeFileSync } from 'node:fs';

const [keluaran, versi, target, url, sig] = process.argv.slice(2);

if (!keluaran || !versi || !target || !url || !sig) {
  console.error('Usage: node scripts/buat-manifes-updater.mjs <keluaran.json> <versi> <target-arch> <url-berkas> <berkas.sig>');
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+/.test(versi)) {
  console.error(`Versi "${versi}" bukan SemVer X.Y.Z`);
  process.exit(1);
}

const targets = target.split(',').map((t) => t.trim()).filter(Boolean);
if (targets.length === 0) {
  console.error(`target-arch "${target}" kosong`);
  process.exit(1);
}
const signature = readFileSync(sig, 'utf8').trim();

const manifes = {
  version: versi,
  pub_date: new Date().toISOString(),
  platforms: Object.fromEntries(targets.map((t) => [t, { url, signature }])),
};

writeFileSync(keluaran, JSON.stringify(manifes, null, 2) + '\n');
console.log(`[manifes-updater] ✓ ${keluaran} (${targets.join(', ')} → ${url})`);
