#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

let versionName = process.argv[2];
let buildNumber = process.argv[3];

if (!versionName) {
  console.error('Usage: node scripts/set-version.mjs <version_name> [build_number]');
  process.exit(1);
}

// Strip leading 'v'
versionName = versionName.replace(/^v/, '').trim();

// Normalize to semver
if (/^\d+$/.test(versionName)) {
  versionName = `${versionName}.0.0`;
} else if (/^\d+\.\d+$/.test(versionName)) {
  versionName = `${versionName}.0`;
}

if (buildNumber) {
  buildNumber = String(buildNumber).replace(/\D/g, '').trim();
}

console.log(`[set-version] Setting version: ${versionName}${buildNumber ? ` (build ${buildNumber})` : ''}`);

// 1. Update apps/ujian/package.json
const pkgPath = resolve(rootDir, 'apps/ujian/package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.version = versionName;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`[set-version] ✓ Updated ${pkgPath} -> version: ${versionName}`);
}

// 2. Update apps/ujian/src-tauri/tauri.conf.json
const tauriPath = resolve(rootDir, 'apps/ujian/src-tauri/tauri.conf.json');
if (existsSync(tauriPath)) {
  const tauri = JSON.parse(readFileSync(tauriPath, 'utf8'));
  tauri.version = versionName;
  writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n');
  console.log(`[set-version] ✓ Updated ${tauriPath} -> version: ${versionName}`);
}

// 3. Update apps/ujian/src-tauri/Cargo.toml
const cargoPath = resolve(rootDir, 'apps/ujian/src-tauri/Cargo.toml');
if (existsSync(cargoPath)) {
  let cargo = readFileSync(cargoPath, 'utf8');
  cargo = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${versionName}"`);
  writeFileSync(cargoPath, cargo);
  console.log(`[set-version] ✓ Updated ${cargoPath} -> version: ${versionName}`);
}

// 4. Update apps/ujian/android/app/build.gradle
const gradlePath = resolve(rootDir, 'apps/ujian/android/app/build.gradle');
if (existsSync(gradlePath)) {
  let gradle = readFileSync(gradlePath, 'utf8');
  // Update versionName fallback or direct value
  gradle = gradle.replace(/(versionName(?:\s*project\.hasProperty\('versionName'\)[^:]*:\s*|\s+))["'][^"']+["']/g, `$1"${versionName}"`);
  if (buildNumber) {
    gradle = gradle.replace(/(versionCode(?:\s*project\.hasProperty\('versionCode'\)[^:]*:\s*|\s+))\d+/g, `$1${buildNumber}`);
  }
  writeFileSync(gradlePath, gradle);
  console.log(`[set-version] ✓ Updated ${gradlePath} -> versionName: "${versionName}"${buildNumber ? `, versionCode: ${buildNumber}` : ''}`);
}

console.log('[set-version] Done!');
