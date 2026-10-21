# Kontrak BE: satu akun, satu perangkat

Tujuan: mencegah akun ujian dipakai bersama di dua perangkat. Status: **terimplementasi di BE e-Rapor** (`App\Services\SesiPerangkat`, test `SesiPerangkatTest`) dengan kebijakan **tolak login baru**.

## Yang dikirim app

| Endpoint | Tambahan |
| --- | --- |
| `POST /auth/login` | `perangkat_id` (UUID per instalasi, maks 64), `perangkat: { platform, versi_app }` (opsional di BE; aplikasi lain seperti Dinar tidak mengirimnya dan tidak dibatasi) |
| `/cbt/ujian/{id}/mulai`, `/cbt/attempt/{id}/sinkron`, `/kumpul`, `/pelanggaran` | `perangkat_id` (wajib) |

## Aturan BE

1. Login dengan `perangkat_id` berbeda saat perangkat lain masih memegang token aktif ditolak: `409 { "kode": "SESI_LAIN" }`, tidak ada token baru, dicatat di log audit (`login_ditolak_perangkat_lain`).
2. "Aktif" = token belum kedaluwarsa **dan** dipakai dalam `cbt.sesi_perangkat.aktif_jam` terakhir, jadi murid yang HP-nya hilang atau app-nya dipasang ulang tidak terkunci selamanya.
3. Login ulang dengan `perangkat_id` yang sama diizinkan; token lama perangkat itu dicabut. Refresh token tetap terikat ke perangkat yang sama.
4. Pengawas memakai aksi `reset_sesi_akun` untuk mencabut semua token perangkat ujian akun itu. Perangkat lama kemudian menerima 401 biasa (tanpa `kode`).
5. `sinkron`/`kumpul`/`pelanggaran` dari `perangkat_id` yang bukan pemegang attempt: `409 { "kode": "PERANGKAT_LAIN" }`.

## Perilaku FE per respons

| Respons | Perilaku app |
| --- | --- |
| `409 SESI_LAIN` (login) | Pesan "Akun ini sedang dipakai di perangkat lain…" di layar Masuk |
| `401` pada endpoint bertoken | Keluar paksa ke layar Masuk dengan banner "Sesimu di perangkat ini sudah berakhir…" |
| `409 PERANGKAT_LAIN` (sinkron/kumpul) | Layar ujian terkunci "Ujian dibuka di perangkat lain", kiriman jawaban berhenti; **bukan** dianggap selesai |

Catatan: `PERANGKAT_LAIN` harus tetap memakai `kode` ini; FE memperlakukan 409 tanpa kode sebagai "ujian selesai".

## Uji manual tanpa BE (mode demo, `npm run dev`)

- Login `demo` + kata sandi `sesi-lain` → `SESI_LAIN`.
- Mulai ujian 1 dengan token `000002` → sinkron berikutnya `PERANGKAT_LAIN`.
- Mulai ujian 1 dengan token `000003` → panggilan bertoken berikutnya 401 (simulasi reset pengawas).
