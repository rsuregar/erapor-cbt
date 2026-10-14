// Salin question-renderer dari e-Rapor (sumber kebenaran) ke paket ini.
// Pemakaian: ERAPOR_DIR=../erapor npm run sinkron:renderer
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const erapor = resolve(process.env.ERAPOR_DIR ?? '../erapor')
const sumber = join(erapor, 'resources/js/Cbt/question-renderer')
const tujuan = resolve('packages/question-renderer/src')

if (!existsSync(sumber)) {
    console.error(`Tidak ditemukan: ${sumber}. Setel ERAPOR_DIR ke folder repo erapor.`)
    process.exit(1)
}

for (const berkas of readdirSync(tujuan)) rmSync(join(tujuan, berkas))
for (const berkas of readdirSync(sumber)) {
    if (/\.(ts|tsx)$/.test(berkas)) cpSync(join(sumber, berkas), join(tujuan, berkas))
}
console.log(`question-renderer disalin dari ${sumber}`)
