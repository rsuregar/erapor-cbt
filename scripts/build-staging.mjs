#!/usr/bin/env node
// Build STAGING di komputer lokal (Mac/Windows/Linux) — sama dengan workflow staging-*.yml:
// whitelabel "CBT Staging" (ikon & warna oranye), API erapor.staging, app id/identifier
// terpisah sehingga bisa dipasang berdampingan dengan versi produksi.
//
// Pemakaian: npm run staging:<pwa|android|desktop> [-- --release]
//   pwa      → apps/ujian/dist
//   android  → apps/ujian/android/app/build/outputs/apk/<debug|release>/  (butuh JDK 21 + Android SDK)
//   desktop  → apps/ujian/src-tauri/target/release/bundle/                (butuh Rust; .dmg di Mac, .exe/.msi di Windows)
// Env opsional: VITE_API_URL (bawaan server uji), VITE_APP_BUILD (nomor build, bawaan 0).
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(AKAR, 'apps', 'ujian');
const WINDOWS = process.platform === 'win32';
const [target] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const release = process.argv.includes('--release');

const env = {
  ...process.env,
  VITE_LINGKUNGAN: 'staging',
  VITE_API_URL: process.env.VITE_API_URL || 'https://erapor.staging.alakhyar.sch.id/api',
};

function jalankan(perintah, args, cwd = AKAR) {
  console.log(`\n[staging] ${perintah} ${args.join(' ')}`);
  const r = spawnSync(perintah, args, { cwd, env, stdio: 'inherit', shell: WINDOWS });
  if (r.status !== 0) {
    console.error(`[staging] gagal: ${perintah} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
}

const npx = WINDOWS ? 'npx.cmd' : 'npx';
const npm = WINDOWS ? 'npm.cmd' : 'npm';

console.log(`[staging] API: ${env.VITE_API_URL}`);
switch (target) {
  case 'pwa':
    jalankan(npm, ['run', 'build', '-w', '@erapor-cbt/ujian']);
    console.log(`\n[staging] PWA staging siap di ${join(APP, 'dist')}`);
    break;
  case 'android': {
    jalankan(npm, ['run', 'build', '-w', '@erapor-cbt/ujian']);
    jalankan(npx, ['cap', 'sync', 'android'], APP);
    const gradlew = WINDOWS ? 'gradlew.bat' : './gradlew';
    jalankan(gradlew, [release ? 'assembleRelease' : 'assembleDebug', '-Plingkungan=staging'], join(APP, 'android'));
    console.log(`\n[staging] APK: ${join(APP, 'android', 'app', 'build', 'outputs', 'apk', release ? 'release' : 'debug')}`);
    console.log('[staging] App id sch.alakhyar.ujian.staging — nama "CBT Staging".');
    break;
  }
  case 'desktop':
    // beforeBuildCommand Tauri menjalankan `npm run build` dengan env staging ini.
    jalankan(npx, ['tauri', 'build', '--config', 'src-tauri/tauri.staging.conf.json'], APP);
    console.log(`\n[staging] Installer: ${join(APP, 'src-tauri', 'target', 'release', 'bundle')}`);
    break;
  default:
    console.error('Pemakaian: npm run staging:<pwa|android|desktop> [-- --release]');
    process.exit(1);
}
