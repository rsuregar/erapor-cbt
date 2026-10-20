#!/usr/bin/env node
// Terbitkan berkas build ke GitHub Release di repo rilis PUBLIK.
// Dipanggil CI pada tag release-*; dibaca app lewat API GitHub (apps/ujian/src/lib/pembaruan.ts).
//
// Usage: node scripts/publish-release.mjs <tag> <berkas...>
// Env:   GH_TOKEN      token dengan izin Contents: write di repo rilis (secret RELEASE_TOKEN)
//        RELEASE_REPO  owner/repo tujuan (repository variable RELEASE_REPO)
//
// Beberapa workflow (mis. macOS + Windows untuk release-desktop-*) memakai tag yang sama:
// pembuatan rilis aman terhadap balapan, unggahan memakai --clobber sehingga re-run idempoten.
// Catatan rilis wajib: dibuat dari templat .github/catatan-rilis.md (scripts/catatan-rilis.mjs);
// gagal membuat catatan = rilis tidak diterbitkan. Butuh riwayat git + tag lengkap (fetch-depth: 0).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buatCatatanRilis, uraiTag } from './catatan-rilis.mjs';

const [tag, ...berkas] = process.argv.slice(2);
const repo = process.env.RELEASE_REPO;

if (!tag || berkas.length === 0) {
  console.error('Usage: node scripts/publish-release.mjs <tag> <berkas...>');
  process.exit(1);
}
if (!repo) {
  console.error('RELEASE_REPO belum diisi (owner/repo repo rilis publik).');
  process.exit(1);
}
if (!process.env.GH_TOKEN) {
  console.error('GH_TOKEN kosong: isi secret RELEASE_TOKEN (izin Contents: write di repo rilis).');
  process.exit(1);
}

const u = uraiTag(tag);
if (!u) {
  console.error(`Tag "${tag}" bukan format release-<desktop|win|macos|mobile|android|ios>-X.Y.Z`);
  process.exit(1);
}
const { jenis, versi, praRilis } = u;

for (const f of berkas) {
  if (!existsSync(f)) {
    console.error(`Berkas tidak ditemukan: ${f}`);
    process.exit(1);
  }
}

const NAMA = {
  desktop: 'Desktop (Windows & macOS)',
  win: 'Windows',
  macos: 'macOS',
  mobile: 'Mobile (Android & iOS)',
  android: 'Android',
  ios: 'iOS',
};

/** "v0.3.0 · CBT Al Akhyar Android" — versi dulu, lalu nama app & platform. */
const judulRilis = (v, j) => `v${v} · CBT Al Akhyar ${NAMA[j]}`;

const catatan = join(mkdtempSync(join(tmpdir(), 'catatan-rilis-')), 'catatan.md');
writeFileSync(catatan, buatCatatanRilis(tag));

const gh = (...args) => execFileSync('gh', [...args, '--repo', repo], { stdio: 'inherit' });
const ghDiam = (...args) => execFileSync('gh', [...args, '--repo', repo], { stdio: 'ignore' });

let ada = true;
try {
  ghDiam('release', 'view', tag);
} catch {
  ada = false;
}

if (!ada) {
  try {
    gh(
      'release', 'create', tag,
      // Versi di depan supaya daftar rilis terbaca berurutan per versi.
      '--title', judulRilis(versi, jenis),
      '--notes-file', catatan,
      ...(praRilis ? ['--prerelease'] : []),
    );
  } catch (e) {
    // Workflow lain pada tag yang sama baru saja membuatnya: lanjut mengunggah.
    try {
      ghDiam('release', 'view', tag);
    } catch {
      throw e;
    }
  }
}

gh('release', 'upload', tag, ...berkas, '--clobber');
console.log(`[publish-release] ${berkas.length} berkas -> ${repo}@${tag}`);
