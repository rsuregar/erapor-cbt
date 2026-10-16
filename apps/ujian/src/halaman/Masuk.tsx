import { IndikatorKoneksi } from "@/komponen/IndikatorKoneksi";
import { Masukan } from "@/komponen/Masukan";
import { Tombol } from "@/komponen/Tombol";
import { api, aturDemo } from "@/lib/api";
import { sesi } from "@/lib/sesi";
import { useOnline } from "@/lib/useOnline";
import { GalatApi } from "@erapor-cbt/exam-core";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, IdCard, LockKeyhole, WifiOff } from "lucide-react";
import { useState } from "react";

/** Masuk dengan akun e-Rapor murid (NIS/username + kata sandi). PRD M-01. */
export default function Masuk() {
    const navigate = useNavigate();
    const online = useOnline();
    const [nis, setNis] = useState("");
    const [sandi, setSandi] = useState("");
    const [lihat, setLihat] = useState(false);
    const masuk = useMutation({
        mutationFn: () => {
            aturDemo(nis.trim() === "demo");

            return api.masuk(nis.trim(), sandi);
        },
        onSuccess: async ({ data }) => {
            await sesi.masuk(
                data.access_token,
                (data.user?.name as string) ?? null,
                data.uuid,
                nis.trim(),
            );
            await navigate({ to: "/" });
        },
    });
    const galat =
        masuk.error instanceof GalatApi
            ? masuk.error.status === 401
                ? "NIS atau kata sandi salah."
                : masuk.error.status === 429
                  ? "Terlalu banyak percobaan masuk. Tunggu sekitar 1 menit lalu coba lagi."
                  : masuk.error.kode === "JARINGAN"
                    ? "Tidak tersambung ke server. Periksa koneksi internet."
                    : masuk.error.message
            : null;

    return (
        <main className="flex min-h-full flex-col">
            <section className="rounded-b-2xl bg-primary px-6 pb-24 pt-10 text-white">
                <div className="mx-auto max-w-md">
                    <div className="flex items-center justify-between">
                        <img
                            src="/brand/lockup-putih.png"
                            alt="Sekolah Islam Al Akhyar"
                            className="h-12 w-auto"
                        />
                        <IndikatorKoneksi online={online} tema="gelap" />
                    </div>
                    <p className="mt-8 text-sm font-medium opacity-85">
                        Assalamu&apos;alaikum
                    </p>
                    <h1 className="mt-1 font-display text-h2 font-semibold leading-tight text-white">
                        CBT Al Akhyar
                    </h1>
                    <p className="mt-1 text-body opacity-85">
                        Masuk dengan akun e-Rapor untuk mulai ujian.
                    </p>
                </div>
            </section>

            <div className="-mt-16 flex-1 px-4 pb-8">
                <form
                    className="mx-auto max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-md"
                    onSubmit={(e) => {
                        e.preventDefault();
                        masuk.mutate();
                    }}
                >
                    <Masukan
                        label="NIS / username"
                        ikonKiri={<IdCard className="size-5" />}
                        autoComplete="username"
                        inputMode="text"
                        autoCapitalize="none"
                        value={nis}
                        onChange={(e) => setNis(e.target.value)}
                        required
                    />
                    <Masukan
                        label="Kata sandi"
                        type={lihat ? "text" : "password"}
                        ikonKiri={<LockKeyhole className="size-5" />}
                        autoComplete="current-password"
                        value={sandi}
                        onChange={(e) => setSandi(e.target.value)}
                        required
                        akhiran={
                            <button
                                type="button"
                                onClick={() => setLihat((v) => !v)}
                                className="-mr-1 rounded-xs p-1.5 text-slate-500"
                                aria-label={
                                    lihat
                                        ? "Sembunyikan kata sandi"
                                        : "Tampilkan kata sandi"
                                }
                            >
                                {lihat ? (
                                    <EyeOff className="size-5" />
                                ) : (
                                    <Eye className="size-5" />
                                )}
                            </button>
                        }
                    />
                    {!online && (
                        <div
                            role="status"
                            className="flex items-start gap-2.5 rounded-sm border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800"
                        >
                            <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-600" />
                            <div>
                                <p className="font-semibold">Kamu sedang offline</p>
                                <p className="mt-0.5 text-amber-700">
                                    Sambungkan perangkat ke internet untuk masuk ke akun CBT.
                                </p>
                            </div>
                        </div>
                    )}
                    {galat && (
                        <p
                            role="alert"
                            className="rounded-sm bg-coral-100 px-3 py-2.5 text-sm font-medium text-coral-600"
                        >
                            {galat}
                        </p>
                    )}
                    <Tombol
                        type="submit"
                        ukuran="lg"
                        penuh
                        disabled={masuk.isPending || !online}
                    >
                        {masuk.isPending ? "Memeriksa…" : !online ? "Offline — Butuh Internet" : "Masuk"}
                    </Tombol>
                    <p className="text-center text-xs text-slate-500">
                        Lupa kata sandi? Hubungi wali kelas atau admin sekolah.
                    </p>
                    <Link
                        to="/panduan"
                        className="block text-center text-sm font-semibold text-primary"
                    >
                        Cara memasang aplikasi ujian →
                    </Link>
                    {(import.meta.env.DEV ||
                        import.meta.env.VITE_DEMO === "1") && (
                        <p className="text-center text-micro text-slate-400">
                            Dev: username &quot;demo&quot; (sandi bebas) memakai
                            data contoh.
                        </p>
                    )}
                </form>

                <footer className="mx-auto mt-8 max-w-md text-center text-xs text-slate-500">
                    Yayasan Pendidikan Islam Al Akhyar ·{" "}
                    <span className="font-semibold text-primary">
                        Unggul &amp; Berakhlak
                    </span>
                </footer>
            </div>
        </main>
    );
}
