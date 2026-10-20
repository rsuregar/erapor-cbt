#!/usr/bin/env node
// Terbitkan build STAGING sebagai pra-rilis di repo rilis publik.
// Dipanggil workflow staging-*.yml (lewat build-*.yml, input terbitkan_staging).
//
// Usage: node scripts/publish-staging.mjs staging-<X.Y.Z>-b<build> <berkas...>
// Env:   GH_TOKEN, RELEASE_REPO (sama dengan publish-release.mjs)
//
// Tag staging terpisah dari release-* supaya app produksi tidak pernah menawarkannya;
// app staging hanya membaca tag staging-* (apps/ujian/src/lib/pembaruan.ts). Beberapa
// platform boleh menerbitkan ke tag yang sama (build berbeda = tag berbeda).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const [tag, ...berkas] = process.argv.slice(2);
const repo = process.env.RELEASE_REPO;
const POLA = /^staging-\d+\.\d+\.\d+-b\d+$/;

const gagal = (pesan) => {
  console.error(`[publish-staging] ${pesan}`);
  process.exit(1);
};

if (!tag || !POLA.test(tag) || berkas.length === 0) gagal('Usage: node scripts/publish-staging.mjs staging-X.Y.Z-bN <berkas...>');
if (!repo) gagal('RELEASE_REPO belum diisi (owner/repo repo rilis publik).');
if (!process.env.GH_TOKEN) gagal('GH_TOKEN kosong: isi secret RELEASE_TOKEN (izin Contents: write di repo rilis).');
for (const f of berkas) if (!existsSync(f)) gagal(`Berkas tidak ditemukan: ${f}`);

const gh = (...a) => execFileSync('gh', [...a, '--repo', repo], { stdio: 'inherit' });
const ada = () => {
  try {
    execFileSync('gh', ['release', 'view', tag, '--repo', repo], { stdio: 'ignore' });

    return true;
  } catch {
    return false;
  }
};

const commit = (process.env.GITHUB_SHA ?? '').slice(0, 7);
const sumber = process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`
  : '';
const catatan = [
  '**Build STAGING** — terhubung ke server uji `erapor.staging.alakhyar.sch.id`. Bukan untuk ujian resmi.',
  '',
  `- Branch: \`${process.env.GITHUB_REF_NAME ?? '-'}\``,
  commit ? `- Commit: [${commit}](${sumber})` : '',
  '- Dipasang berdampingan dengan versi produksi (nama "CBT Staging", ikon oranye).',
].filter(Boolean).join('\n');

if (!ada()) {
  try {
    gh('release', 'create', tag, '--prerelease', '--title', `CBT Al Akhyar ${tag.replace(/^staging-/, 'Staging ')}`, '--notes', catatan);
  } catch {
    // Platform lain pada build yang sama baru saja membuatnya: lanjut mengunggah.
    if (!ada()) gagal(`Gagal membuat rilis ${tag}.`);
  }
}
gh('release', 'upload', tag, ...berkas, '--clobber');
console.log(`[publish-staging] ${berkas.length} berkas -> ${repo}@${tag}`);
