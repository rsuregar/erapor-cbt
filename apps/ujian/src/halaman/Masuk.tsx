import { IndikatorKoneksi } from "@/komponen/IndikatorKoneksi";
import { Masukan } from "@/komponen/Masukan";
import { Tombol } from "@/komponen/Tombol";
import { api, aturDemo } from "@/lib/api";
import { sesi } from "@/lib/sesi";
import { useOnline } from "@/lib/useOnline";
import { GalatApi } from "@erapor-cbt/exam-core";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
    AlertCircle,
    ArrowRight,
    BookOpen,
    Eye,
    EyeOff,
    HelpCircle,
    IdCard,
    LockKeyhole,
    ShieldCheck,
    Sparkles,
    WifiOff,
} from "lucide-react";
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
                ? "NIS atau kata sandi tidak cocok. Periksa kembali penulisan Anda."
                : masuk.error.status === 429
                  ? "Terlalu banyak percobaan masuk. Tunggu sekitar 1 menit lalu coba lagi."
                  : masuk.error.kode === "JARINGAN"
                    ? "Tidak tersambung ke server e-Rapor. Periksa koneksi internet Anda."
                    : masuk.error.message
            : null;

    return (
        <main className="flex min-h-full flex-col bg-slate-50/70">
            {/* Header / Hero Section */}
            <section className="relative overflow-hidden rounded-b-[2rem] sm:rounded-b-[2.5rem] bg-gradient-to-br from-[#0B486F] via-[#006195] to-[#004B74] px-6 pb-24 pt-8 text-white shadow-lg">
                {/* Subtle Decorative Ambient Background */}
                <div
                    className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-white/5 blur-3xl"
                    aria-hidden="true"
                />
                <div
                    className="pointer-events-none absolute -left-12 bottom-0 size-60 rounded-full bg-sky-400/10 blur-2xl"
                    aria-hidden="true"
                />

                <div className="relative mx-auto max-w-md">
                    {/* Top Bar: Brand Logo & Connection Badge */}
                    <div className="flex items-center justify-between gap-3">
                        <img
                            src="/brand/lockup-putih.png"
                            alt="Sekolah Islam Al Akhyar"
                            className="h-10 sm:h-11 w-auto drop-shadow-sm"
                        />
                        <IndikatorKoneksi online={online} tema="gelap" />
                    </div>

                    {/* Greeting Chip */}
                    <div className="mt-8 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-100 backdrop-blur-md border border-white/15">
                            <Sparkles className="size-3.5 text-amber-300" />
                            Assalamu&apos;alaikum
                        </span>
                    </div>

                    {/* Bold Brand Title */}
                    <h1 className="mt-2.5 font-display text-[32px] sm:text-[36px] font-extrabold tracking-tight leading-tight text-white drop-shadow-sm">
                        CBT Al Akhyar
                    </h1>

                    {/* Subtitle */}
                    <p className="mt-1.5 text-sm sm:text-body text-sky-100/90 leading-relaxed">
                        Masuk dengan akun e-Rapor untuk mulai ujian.
                    </p>
                </div>
            </section>

            {/* Login Card Form */}
            <div className="relative z-10 -mt-12 sm:-mt-14 flex-1 px-4 pb-10">
                <div className="mx-auto max-w-md">
                    <form
                        className="relative space-y-5 rounded-lg border border-slate-100/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-900/10 ring-1 ring-black/5 transition-all"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (online) masuk.mutate();
                        }}
                    >
                        {/* Form Title Header */}
                        <div className="border-b border-slate-100 pb-4">
                            <h2 className="text-base font-bold text-ink">
                                Masuk Akun Murid
                            </h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                Gunakan NIS dan kata sandi yang terdaftar di e-Rapor
                            </p>
                        </div>

                        {/* Offline Warning Alert */}
                        {!online && (
                            <div
                                role="status"
                                className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-900 animate-in fade-in"
                            >
                                <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                <div className="space-y-0.5">
                                    <p className="font-bold text-amber-950">
                                        Perangkat sedang offline
                                    </p>
                                    <p className="text-amber-800 leading-normal">
                                        Sambungkan perangkat ke Wi-Fi atau data seluler untuk masuk ke akun CBT.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Input Fields */}
                        <div className="space-y-4">
                            <Masukan
                                label="NIS / Username"
                                placeholder="Masukkan NIS atau username"
                                ikonKiri={<IdCard className="size-5 text-slate-400" />}
                                autoComplete="username"
                                inputMode="text"
                                autoCapitalize="none"
                                value={nis}
                                onChange={(e) => setNis(e.target.value)}
                                required
                            />

                            <Masukan
                                label="Kata Sandi"
                                placeholder="Masukkan kata sandi"
                                type={lihat ? "text" : "password"}
                                ikonKiri={<LockKeyhole className="size-5 text-slate-400" />}
                                autoComplete="current-password"
                                value={sandi}
                                onChange={(e) => setSandi(e.target.value)}
                                required
                                akhiran={
                                    <button
                                        type="button"
                                        onClick={() => setLihat((v) => !v)}
                                        className="-mr-1 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-95"
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
                        </div>

                        {/* Error Alert Box */}
                        {galat && (
                            <div
                                role="alert"
                                className="flex items-start gap-2.5 rounded-lg border border-coral-200 bg-coral-50 p-3.5 text-xs text-coral-700 animate-in fade-in"
                            >
                                <AlertCircle className="mt-0.5 size-4 shrink-0 text-coral-500" />
                                <span className="font-medium leading-normal">{galat}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <Tombol
                            type="submit"
                            ukuran="lg"
                            penuh
                            disabled={masuk.isPending || !online}
                            className="h-12 shadow-md transition-all active:scale-[0.98]"
                        >
                            {masuk.isPending ? (
                                "Memeriksa kredensial…"
                            ) : !online ? (
                                "Offline — Butuh Internet"
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <span>Masuk Ujian</span>
                                    <ArrowRight className="size-4 opacity-75" />
                                </span>
                            )}
                        </Tombol>

                        {/* Helper Notes */}
                        <div className="pt-1 text-center">
                            <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                                <HelpCircle className="size-3.5 text-slate-400 shrink-0" />
                                <span>Lupa kata sandi? Hubungi wali kelas atau proktor sekolah.</span>
                            </p>
                        </div>

                        {/* Panduan Link Card */}
                        <div className="border-t border-slate-100 pt-4">
                            <Link
                                to="/panduan"
                                className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 text-xs font-semibold text-primary transition hover:border-primary/40 hover:bg-primary-50/40"
                            >
                                <span className="flex items-center gap-2">
                                    <BookOpen className="size-4 text-primary" />
                                    <span>Petunjuk &amp; Cara Memasang Aplikasi</span>
                                </span>
                                <ArrowRight className="size-3.5 opacity-60" />
                            </Link>
                        </div>

                        {/* Dev Demo Mode Helper */}
                        {(import.meta.env.DEV || import.meta.env.VITE_DEMO === "1") && (
                            <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50/60 p-2.5 text-center text-micro text-sky-800">
                                <span className="font-semibold">Mode Demo Dev:</span> Isi username{" "}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNis("demo");
                                        setSandi("demo123");
                                    }}
                                    className="font-bold underline hover:text-sky-950"
                                >
                                    &quot;demo&quot;
                                </button>{" "}
                                (sandi bebas) untuk mencoba langsung.
                            </div>
                        )}
                    </form>

                    {/* Modern Security & School Trust Footer */}
                    <footer className="mt-8 space-y-2 text-center text-xs text-slate-500">
                        <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
                            <ShieldCheck className="size-3.5 text-emerald-600" />
                            <span>Koneksi aman e-Rapor &bull; Platform Ujian Resmi</span>
                        </div>
                        <p>
                            Yayasan Pendidikan Islam Al Akhyar &bull;{" "}
                            <span className="font-semibold text-primary">
                                Unggul &amp; Berakhlak
                            </span>
                        </p>
                    </footer>
                </div>
            </div>
        </main>
    );
}
