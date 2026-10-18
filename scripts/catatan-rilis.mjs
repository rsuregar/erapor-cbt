#!/usr/bin/env node
// Catatan rilis untuk tag release-*: commit sejak rilis sebelumnya untuk platform
// yang sama, dikelompokkan per jenis Conventional Commit, diisi ke templat
// .github/catatan-rilis.md. Dipakai publish-release.mjs (CI) dan buat-tag-rilis.mjs.
//
// Pemakaian: node scripts/catatan-rilis.mjs <tag> [--ref <commit>]
//   --ref: commit yang akan diberi tag (default: tag itu sendiri) — untuk pratinjau sebelum tag dibuat.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const POLA_TAG = /^release-(desktop|win|macos|mobile|android|ios)-v?(\d+(?:\.\d+){0,2})(-.+)?$/;

/** Platform yang dibangun setiap jenis tag (lihat workflow build-*.yml). */
const PLATFORM = {
  desktop: ['windows', 'macos'],
  win: ['windows'],
  macos: ['macos'],
  mobile: ['android', 'ios'],
  android: ['android'],
  ios: ['ios'],
};

const PRODUK = {
  desktop: 'CBT Al Akhyar Desktop (Windows & macOS)',
  win: 'CBT Al Akhyar Windows',
  macos: 'CBT Al Akhyar macOS',
  mobile: 'CBT Al Akhyar Mobile (Android & iOS)',
  android: 'CBT Al Akhyar Android',
  ios: 'CBT Al Akhyar iOS',
};

/** Jenis Conventional Commit → bagian templat. Jenis lain masuk "lainnya". */
const BAGIAN = {
  feat: 'baru',
  fix: 'perbaikan',
  perf: 'perubahan',
  refactor: 'perubahan',
  style: 'perubahan',
  sec: 'perubahan',
};

export function uraiTag(tag) {
  const m = POLA_TAG.exec(tag);
  if (!m) return null;
  const angka = m[2].split('.').map(Number);
  while (angka.length < 3) angka.push(0);

  return { jenis: m[1], versi: angka.join('.') + (m[3] ?? ''), angka, praRilis: !!m[3] };
}

function banding(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];

  return 0;
}

const git = (...args) => execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim();

function adalahLeluhur(a, b) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: rootDir, stdio: 'ignore' });

    return true;
  } catch {
    return false;
  }
}

/** URL repo kode untuk tautan commit/perbandingan (CI: GITHUB_REPOSITORY; lokal: remote origin). */
function urlRepo() {
  if (process.env.GITHUB_REPOSITORY) {
    return `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}`;
  }
  const origin = git('remote', 'get-url', 'origin');

  return origin.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
}

/**
 * Tag rilis sebelumnya untuk platform yang beririsan: versi lebih rendah, berada
 * di riwayat `ref`, dan stabil (kecuali tag sekarang pra-rilis). Versi sama
 * terbesar → yang commit-nya paling baru.
 */
export function tagSebelumnya(tag, ref) {
  const kini = uraiTag(tag);
  const platform = PLATFORM[kini.jenis];
  let terbaik = null;

  for (const t of git('tag', '--list', 'release-*').split('\n').filter(Boolean)) {
    const u = t !== tag && uraiTag(t);
    if (!u || (u.praRilis && !kini.praRilis)) continue;
    if (!PLATFORM[u.jenis].some((p) => platform.includes(p))) continue;
    if (banding(u.angka, kini.angka) >= 0 || !adalahLeluhur(t, ref)) continue;
    const waktu = Number(git('log', '-1', '--format=%ct', t));
    const lebihBaik =
      !terbaik || banding(u.angka, terbaik.angka) > 0 || (banding(u.angka, terbaik.angka) === 0 && waktu > terbaik.waktu);
    if (lebihBaik) terbaik = { tag: t, angka: u.angka, waktu };
  }

  return terbaik?.tag ?? null;
}

const POLA_COMMIT = /^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/;

function daftarCommit(dari, ke) {
  const keluaran = git('log', '--no-merges', '--reverse', '--format=%H%x1f%s%x1f%b%x1e', dari ? `${dari}..${ke}` : ke);

  return keluaran
    .split('\x1e')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [sha, subjek, badan = ''] = r.split('\x1f');

      return { sha, subjek: subjek.replace(/\s*\[skip ci\]/gi, '').trim(), badan };
    });
}

/** Isi templat; bagian "## …" yang kosong dibuang. */
function isiTemplat(templat, nilai) {
  const tanpaKomentar = templat.replace(/<!--[\s\S]*?-->\n?/g, '');
  const terisi = tanpaKomentar.replace(/\{\{(\w+)\}\}/g, (_, k) => nilai[k] ?? '');
  const blok = terisi.split(/^(?=## )/m);

  return blok
    .filter((b) => !b.startsWith('## ') || b.split('\n').slice(1).some((baris) => baris.trim() !== ''))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

export function buatCatatanRilis(tag, ref = tag) {
  const u = uraiTag(tag);
  if (!u) throw new Error(`Tag "${tag}" bukan format release-<desktop|win|macos|mobile|android|ios>-X.Y.Z`);

  const repo = urlRepo();
  const sebelum = tagSebelumnya(tag, ref);
  const bagian = { penting: [], baru: [], perbaikan: [], perubahan: [], lainnya: [] };

  for (const c of sebelum ? daftarCommit(sebelum, ref) : []) {
    const m = POLA_COMMIT.exec(c.subjek);
    const jenis = m?.[1].toLowerCase();
    const kelompok = BAGIAN[jenis] ?? 'lainnya';
    // "Lainnya" campuran ci/docs/chore: tampilkan jenisnya bila tanpa cakupan.
    const label = m?.[2] ?? (kelompok === 'lainnya' ? jenis : null);
    // Subjek seperti "cbt-al-akhyar-<platform>" tidak boleh terbaca sebagai tag HTML.
    const judul = (m ? m[4] : c.subjek).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const baris = `- ${label ? `**${label}:** ` : ''}${judul} ([\`${c.sha.slice(0, 7)}\`](${repo}/commit/${c.sha}))`;
    bagian[kelompok].push(baris);
    if (m?.[3] || /^BREAKING CHANGE:/m.test(c.badan)) bagian.penting.push(baris);
  }

  const tanggal = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Makassar' }).format(
    new Date(Number(git('log', '-1', '--format=%ct', ref)) * 1000),
  );
  const jumlah = Object.values(bagian).reduce((n, b) => n + b.length, 0) - bagian.penting.length;

  return isiTemplat(readFileSync(resolve(rootDir, '.github/catatan-rilis.md'), 'utf8'), {
    produk: PRODUK[u.jenis],
    versi: u.versi,
    tanggal,
    tag_sebelumnya: sebelum ?? '',
    penting: bagian.penting.join('\n'),
    baru: bagian.baru.join('\n'),
    perbaikan: bagian.perbaikan.join('\n'),
    perubahan: bagian.perubahan.join('\n'),
    lainnya: bagian.lainnya.join('\n'),
    banding: sebelum
      ? `**Perbandingan lengkap** (${jumlah} commit, khusus tim pengembang): [\`${sebelum}...${tag}\`](${repo}/compare/${sebelum}...${tag})`
      : 'Rilis pertama untuk platform ini.',
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [tag, ...sisa] = process.argv.slice(2);
  const i = sisa.indexOf('--ref');
  if (!tag) {
    console.error('Usage: node scripts/catatan-rilis.mjs <tag> [--ref <commit>]');
    process.exit(1);
  }
  process.stdout.write(buatCatatanRilis(tag, i >= 0 ? sisa[i + 1] : tag));
}
