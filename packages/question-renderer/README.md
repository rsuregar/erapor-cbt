# question-renderer

Tampilan soal CBT yang dipakai **bersama** oleh panel guru (e-Rapor, pratinjau
bank soal) dan app ujian murid. **Sumber kebenarannya folder ini** (repo
erapor-cbt); ubah di sini lalu salin ke e-Rapor dengan
`ERAPOR_DIR=../erapor npm run sinkron:renderer` (berkas `.ts/.tsx` di
`erapor/resources/js/Cbt/question-renderer` ditimpa). Jaga supaya tetap mandiri:

- hanya bergantung pada `react`, `katex`, dan kelas Tailwind;
- tidak mengimpor apa pun dari `@/…` e-Rapor (shadcn, layout, route, dll.);
- format data mengikuti `App\Services\Cbt\StrukturSoal` — ubah `types.ts`
  bersamaan dengan kelas PHP itu.

`kunci` di `TampilanSoal` hanya untuk pratinjau guru. App murid tidak pernah
menerima kunci jawaban.
