#!/usr/bin/env node
// Buat tag rilis beranotasi berisi catatan rilis (templat .github/catatan-rilis.md), lalu push.
// Push tag memicu workflow build-*.yml yang menerbitkan rilis dengan catatan yang sama.
// Pemakaian:
//   npm run rilis -- all <X.Y.Z[-pra]> [--pratinjau]   (rilis sekaligus: desktop + android)
//   npm run rilis -- <X.Y.Z[-pra]> [--pratinjau]       (sama dengan 'all')
//   npm run rilis -- <desktop|android|win|macos|mobile|ios> <X.Y.Z[-pra]> [--pratinjau]
//   --pratinjau: hanya tampilkan catatan, tanpa membuat/push tag.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buatCatatanRilis, uraiTag } from './catatan-rilis.mjs';

const args = process.argv.slice(2);
const pratinjau = args.includes('--pratinjau');
const sisa = args.filter((a) => !a.startsWith('--'));

let jenis, versi;
let targetList = [];

if (sisa.length === 1) {
  jenis = 'all';
  versi = sisa[0];
} else if (sisa.length >= 2) {
  [jenis, versi] = sisa;
}

const versiBersih = String(versi ?? '').replace(/^v/, '');
if (jenis === 'all') {
  targetList = ['desktop', 'android'];
} else if (jenis) {
  targetList = [jenis];
}

const tags = targetList.map((t) => `release-${t}-${versiBersih}`);

const gagal = (pesan) => {
  console.error(`[rilis] ${pesan}`);
  process.exit(1);
};
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

if (targetList.length === 0 || !versi || tags.some((t) => !uraiTag(t))) {
  gagal('Pemakaian: npm run rilis -- [all|desktop|android|win|macos|mobile|ios] <X.Y.Z[-pra]> [--pratinjau]');
}

for (const tag of tags) {
  if (git('tag', '--list', tag)) gagal(`Tag ${tag} sudah ada.`);
}
if (!pratinjau) {
  if (git('branch', '--show-current') !== 'main') gagal('Tag rilis hanya dibuat dari branch main.');
  if (git('status', '--porcelain')) gagal('Working tree belum bersih; commit atau stash dulu.');
  git('fetch', '--quiet', '--tags', 'origin', 'main');
  if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')) gagal('main lokal belum sama dengan origin/main (pull/push dulu).');
  for (const tag of tags) {
    if (git('ls-remote', '--tags', 'origin', tag)) gagal(`Tag ${tag} sudah ada di origin.`);
  }
}

for (const tag of tags) {
  const catatan = buatCatatanRilis(tag, 'HEAD');
  console.log(`\n===== Catatan rilis ${tag} =====\n\n${catatan}`);
}
if (pratinjau) process.exit(0);

const sampleTag = tags[0];
const u = uraiTag(sampleTag);


// Versi di repo (web PWA dari main, build lokal, dev) mengikuti rilis stabil terbaru.
const kini = JSON.parse(readFileSync('apps/ujian/package.json', 'utf8')).version.split('.').map(Number);
const selisih = u.angka.map((n, i) => n - kini[i]).find((d) => d !== 0) ?? 0;
if (!u.praRilis && selisih > 0) {
  execFileSync('node', ['scripts/set-version.mjs', u.versi], { stdio: 'inherit' });
  git('add', 'apps/ujian/package.json', 'package-lock.json', 'apps/ujian/src-tauri/tauri.conf.json', 'apps/ujian/src-tauri/Cargo.toml', 'apps/ujian/src-tauri/Cargo.lock', 'apps/ujian/android/app/build.gradle');
  git('commit', '-m', `chore(rilis): versi ${u.versi}`);
  git('push', 'origin', 'main');
}

for (const tag of tags) {
  const catatan = buatCatatanRilis(tag, 'HEAD');
  const berkas = join(mkdtempSync(join(tmpdir(), 'tag-rilis-')), 'catatan.md');
  writeFileSync(berkas, `${tag}\n\n${catatan}`);
  git('tag', '-a', tag, '-F', berkas, '--cleanup=verbatim');
  git('push', 'origin', tag);
  console.log(`[rilis] ✓ ${tag} dibuat & di-push.`);
}
console.log(`[rilis] Semua tag berhasil diterbitkan (${tags.join(', ')}). Pantau: gh run list --workflow build-*.yml`);
