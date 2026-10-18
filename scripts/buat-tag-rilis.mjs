#!/usr/bin/env node
// Buat tag rilis beranotasi berisi catatan rilis (templat .github/catatan-rilis.md), lalu push.
// Push tag memicu workflow build-*.yml yang menerbitkan rilis dengan catatan yang sama.
//
// Pemakaian: npm run rilis -- <desktop|win|macos|mobile|android|ios> <X.Y.Z[-pra]> [--pratinjau]
//   --pratinjau: hanya tampilkan catatan, tanpa membuat/push tag.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buatCatatanRilis, uraiTag } from './catatan-rilis.mjs';

const args = process.argv.slice(2);
const pratinjau = args.includes('--pratinjau');
const [jenis, versi] = args.filter((a) => !a.startsWith('--'));
const tag = `release-${jenis}-${String(versi ?? '').replace(/^v/, '')}`;

const gagal = (pesan) => {
  console.error(`[rilis] ${pesan}`);
  process.exit(1);
};
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

if (!jenis || !versi || !uraiTag(tag)) {
  gagal('Pemakaian: npm run rilis -- <desktop|win|macos|mobile|android|ios> <X.Y.Z[-pra]> [--pratinjau]');
}
if (git('tag', '--list', tag)) gagal(`Tag ${tag} sudah ada.`);

if (!pratinjau) {
  if (git('branch', '--show-current') !== 'main') gagal('Tag rilis hanya dibuat dari branch main.');
  if (git('status', '--porcelain')) gagal('Working tree belum bersih; commit atau stash dulu.');
  git('fetch', '--quiet', '--tags', 'origin', 'main');
  if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')) gagal('main lokal belum sama dengan origin/main (pull/push dulu).');
  if (git('ls-remote', '--tags', 'origin', tag)) gagal(`Tag ${tag} sudah ada di origin.`);
}

const catatan = buatCatatanRilis(tag, 'HEAD');
console.log(`\n===== Catatan rilis ${tag} =====\n\n${catatan}`);
if (pratinjau) process.exit(0);

const berkas = join(mkdtempSync(join(tmpdir(), 'tag-rilis-')), 'catatan.md');
writeFileSync(berkas, `${tag}\n\n${catatan}`);
git('tag', '-a', tag, '-F', berkas, '--cleanup=verbatim');
git('push', 'origin', tag);
console.log(`[rilis] ${tag} dibuat & di-push. Pantau: gh run list --workflow build-*.yml`);
