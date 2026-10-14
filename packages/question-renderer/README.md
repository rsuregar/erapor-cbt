# question-renderer

Tampilan soal CBT yang dipakai **bersama** oleh panel guru (e-Rapor, pratinjau
bank soal) dan app ujian murid (repo terpisah). Folder ini disalin apa adanya
ke app murid; jaga supaya tetap mandiri:

- hanya bergantung pada `react`, `katex`, dan kelas Tailwind;
- tidak mengimpor apa pun dari `@/…` e-Rapor (shadcn, layout, route, dll.);
- format data mengikuti `App\Services\Cbt\StrukturSoal` — ubah `types.ts`
  bersamaan dengan kelas PHP itu.

`kunci` di `TampilanSoal` hanya untuk pratinjau guru. App murid tidak pernah
menerima kunci jawaban.
