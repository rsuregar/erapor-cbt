// Salin question-renderer dari repo ini (sumber kebenaran) ke e-Rapor, supaya
// pratinjau guru identik dengan layar ujian murid.
// Pemakaian: ERAPOR_DIR=../erapor npm run sinkron:renderer
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const erapor = resolve(process.env.ERAPOR_DIR ?? '../erapor')
const sumber = resolve('packages/question-renderer/src')
const tujuan = join(erapor, 'resources/js/Cbt/question-renderer')

if (!existsSync(tujuan)) {
    console.error(`Tidak ditemukan: ${tujuan}. Setel ERAPOR_DIR ke folder repo erapor.`)
    process.exit(1)
}

const kode = (berkas) => /\.(ts|tsx)$/.test(berkas)
// README.md milik e-Rapor dibiarkan; hanya berkas kode yang diganti.
for (const berkas of readdirSync(tujuan).filter(kode)) rmSync(join(tujuan, berkas))
for (const berkas of readdirSync(sumber).filter(kode)) cpSync(join(sumber, berkas), join(tujuan, berkas))
console.log(`question-renderer disalin ke ${tujuan}`)
