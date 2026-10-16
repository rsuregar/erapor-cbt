import { Tombol } from "@/komponen/Tombol";
import { api } from "@/lib/api";
import { sesi } from "@/lib/sesi";
import { hariTanggal, jamMenit } from "@/lib/tanggal";
import { cn } from "@/lib/utils";
import { RenderKonten, type TiptapNode } from "@erapor-cbt/question-renderer";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
    AlertCircle,
    Award,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    Clock,
    Info,
    Lightbulb,
    MessageSquareText,
    MinusCircle,
    Target,
    TrendingUp,
    XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

const angka = (n: number | null) =>
    n === null ? "—" : String(n).replace(".", ",");

/**
 * Halaman Nilai & Pembahasan Ujian (PRD M-12).
 * Tampilan baru terpadu dengan design system CBT Al Akhyar:
 * Hero header brand, scorecard komprehensif, filter butir soal,
 * accordion pembahasan interaktif, dan dukungan cetak hasil.
 */
export default function Hasil({ attemptId }: { attemptId: number }) {
    const navigate = useNavigate();
    const hasil = useQuery({
        queryKey: ["hasil", attemptId],
        queryFn: () => api.hasil(attemptId),
        retry: false,
    });
    const h = hasil.data;

    const [filter, setFilter] = useState<"semua" | "penuh" | "evaluasi">(
        "semua",
    );
    const [semuaBuka, setSemuaBuka] = useState(false);
    const [bukaMap, setBukaMap] = useState<Record<number, boolean>>({});

    const namaMurid = sesi.nama();
    const nisMurid = sesi.nis();

    // Hitung statistik butir soal
    const totalSoal = h?.soal.length ?? 0;
    const soalPenuh = useMemo(
        () =>
            h?.soal.filter((s) => s.skor !== null && s.skor >= s.bobot)
                .length ?? 0,
        [h?.soal],
    );
    const soalEvaluasi = useMemo(
        () =>
            h?.soal.filter(
                (s) => s.skor === null || s.skor < s.bobot || s.anulir !== null,
            ).length ?? 0,
        [h?.soal],
    );
    const selisihKktp = useMemo(() => {
        if (
            h?.kktp === null ||
            h?.kktp === undefined ||
            h?.nilai === null ||
            h?.nilai === undefined
        )
            return null;
        return Number((h.nilai - h.kktp).toFixed(1));
    }, [h?.kktp, h?.nilai]);

    const daftarTampil = useMemo(() => {
        if (!h?.soal) return [];
        if (filter === "penuh")
            return h.soal.filter((s) => s.skor !== null && s.skor >= s.bobot);
        if (filter === "evaluasi")
            return h.soal.filter(
                (s) => s.skor === null || s.skor < s.bobot || s.anulir !== null,
            );
        return h.soal;
    }, [h?.soal, filter]);

    const toggleAccordion = (id: number) => {
        setBukaMap((prev) => ({ ...prev, [id]: !(prev[id] ?? semuaBuka) }));
    };

    const toggleBukaSemua = () => {
        const target = !semuaBuka;
        setSemuaBuka(target);
        if (h?.soal) {
            const next: Record<number, boolean> = {};
            for (const s of h.soal) next[s.id] = target;
            setBukaMap(next);
        }
    };

    if (hasil.isPending) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
                <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="mt-4 text-sm font-semibold text-slate-500">
                    Memuat hasil ujian…
                </p>
            </div>
        );
    }

    if (hasil.isError || !h) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="size-12 text-coral-500" />
                <h1 className="mt-3 text-lg font-bold text-ink">
                    Hasil Ujian Tidak Ditemukan
                </h1>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                    {hasil.error?.message ??
                        "Data hasil ujian belum tersedia atau sudah diarsipkan."}
                </p>
                <Tombol
                    varian="primary"
                    className="mt-5 rounded-xl font-bold"
                    onClick={() => navigate({ to: "/" })}
                >
                    Kembali ke Beranda
                </Tombol>
            </div>
        );
    }

    const tuntas = h.tuntas === true;

    return (
        <div className="min-h-full bg-slate-50/70 pb-20">
            {/* Hero Header Section */}
            <header className="relative overflow-hidden rounded-b-[1.75rem] sm:rounded-b-[2.5rem] bg-gradient-to-br from-[#0B486F] via-[#006195] to-[#004B74] px-4 pt-4 pb-16 sm:pb-20 text-white shadow-lg sm:px-6 print:rounded-none print:bg-white print:text-black print:pb-4 print:shadow-none">
                {/* Decorative Ambient Backgrounds */}
                <div
                    className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-white/5 blur-3xl print:hidden"
                    aria-hidden="true"
                />
                <div
                    className="pointer-events-none absolute -left-16 bottom-0 size-72 rounded-full bg-sky-400/10 blur-2xl print:hidden"
                    aria-hidden="true"
                />

                <div className="relative mx-auto max-w-3xl space-y-4">
                    {/* Top Bar: Back */}
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 print:hidden">
                        <button
                            onClick={() => navigate({ to: "/" })}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
                            aria-label="Kembali ke beranda"
                        >
                            <ChevronLeft className="size-4" />
                            <span>Kembali</span>
                        </button>
                    </div>

                    {/* Title & Metadata */}
                    <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                            {h.ujian.mapel && (
                                <span className="inline-flex items-center rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-sky-100 backdrop-blur-md border border-white/15 print:border-slate-300 print:text-slate-800">
                                    {h.ujian.mapel}
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-100 backdrop-blur-md border border-white/15 print:border-slate-300 print:text-slate-800">
                                <Award className="size-3 text-sky-200" />
                                <span>Hasil Evaluasi Resmi</span>
                            </span>
                        </div>

                        <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white drop-shadow-sm print:text-ink">
                            {h.ujian.nama}
                        </h1>

                        {namaMurid && (
                            <p className="text-xs text-sky-100/90 font-medium">
                                Peserta:{" "}
                                <span className="font-bold text-white">
                                    {namaMurid}
                                </span>
                                {nisMurid ? ` · NIS: ${nisMurid}` : ""}
                            </p>
                        )}
                    </div>
                </div>
            </header>

            <main className="relative z-10 -mt-10 sm:-mt-12 mx-auto max-w-3xl space-y-5 px-3 sm:px-4">
                {/* Scorecard Hero Card */}
                <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-lg shadow-slate-200/50">
                    <div className="grid gap-5 sm:grid-cols-2 sm:items-center">
                        {/* Left Side: Score & Status */}
                        <div className="space-y-2.5 border-b sm:border-b-0 sm:border-r border-slate-100 pb-4 sm:pb-0 sm:pr-6">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Nilai Akhir Ujian
                            </p>
                            <div className="flex items-baseline gap-3">
                                <span className="font-display text-4xl sm:text-5xl font-black text-ink tracking-tight leading-none">
                                    {angka(h.nilai)}
                                </span>
                                {h.tuntas !== null && (
                                    <span
                                        className={cn(
                                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold tracking-wide border",
                                            tuntas
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-300/80 shadow-2xs"
                                                : "bg-coral-50 text-coral-700 border-coral-300/80 shadow-2xs",
                                        )}
                                    >
                                        {tuntas ? (
                                            <CheckCircle2 className="size-3.5" />
                                        ) : (
                                            <AlertCircle className="size-3.5" />
                                        )}
                                        <span>
                                            {tuntas ? "TUNTAS" : "REMEDIAL"}
                                        </span>
                                    </span>
                                )}
                            </div>

                            {/* Comparison against KKTP */}
                            {selisihKktp !== null && (
                                <p
                                    className={cn(
                                        "text-xs font-semibold",
                                        selisihKktp >= 0
                                            ? "text-emerald-600"
                                            : "text-coral-600",
                                    )}
                                >
                                    {selisihKktp > 0
                                        ? `Melampaui target KKTP (${h.kktp}) sebesar +${angka(selisihKktp)} poin`
                                        : selisihKktp < 0
                                          ? `Belum mencapai target KKTP (${h.kktp}) selisih ${angka(Math.abs(selisihKktp))} poin`
                                          : `Tepat mencapai batas KKTP (${h.kktp})`}
                                </p>
                            )}
                        </div>

                        {/* Right Side: Key Detail Metrics */}
                        <div className="grid grid-cols-2 gap-3 sm:pl-2">
                            <div className="rounded-xl bg-slate-50/80 p-3 border border-slate-100">
                                <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    <Target className="size-3 text-primary" />
                                    <span>Skor Diperoleh</span>
                                </dt>
                                <dd className="mt-1 font-extrabold text-ink text-sm sm:text-base">
                                    {angka(h.skor)}{" "}
                                    <span className="text-xs font-normal text-slate-400">
                                        / {angka(h.skor_maks)}
                                    </span>
                                </dd>
                            </div>

                            <div className="rounded-xl bg-slate-50/80 p-3 border border-slate-100">
                                <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    <Award className="size-3 text-primary" />
                                    <span>Batas KKTP</span>
                                </dt>
                                <dd className="mt-1 font-extrabold text-ink text-sm sm:text-base">
                                    {h.kktp !== null ? h.kktp : "—"}
                                </dd>
                            </div>

                            <div className="col-span-2 rounded-xl bg-slate-50/80 p-3 border border-slate-100">
                                <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    <Clock className="size-3 text-primary" />
                                    <span>Waktu Dikumpulkan (WITA)</span>
                                </dt>
                                <dd className="mt-1 font-bold text-ink text-xs sm:text-sm">
                                    {h.dikumpulkan_pada
                                        ? `${hariTanggal(h.dikumpulkan_pada)}, ${jamMenit(h.dikumpulkan_pada, true)}`
                                        : "—"}
                                </dd>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3 Quick Overview Stat Cards with Large Watermark Background */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs transition hover:shadow-md">
                        <CheckCircle2
                            aria-hidden="true"
                            className="pointer-events-none absolute -right-2 -bottom-2 size-12 sm:size-14 text-emerald-500/20 opacity-12 transition group-hover:scale-110"
                        />
                        <div className="relative z-10 space-y-1">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                Benar Penuh
                            </p>
                            <p className="font-display text-xl sm:text-2xl font-black text-emerald-600">
                                {soalPenuh}
                            </p>
                            <p className="text-[11px] text-slate-400">
                                dari {totalSoal} butir soal
                            </p>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs transition hover:shadow-md">
                        <MinusCircle
                            aria-hidden="true"
                            className="pointer-events-none absolute -right-2 -bottom-2 size-12 sm:size-14 text-amber-500/20 opacity-12 transition group-hover:scale-110"
                        />
                        <div className="relative z-10 space-y-1">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                Perlu Evaluasi
                            </p>
                            <p className="font-display text-xl sm:text-2xl font-black text-amber-600">
                                {soalEvaluasi}
                            </p>
                            <p className="text-[11px] text-slate-400">
                                skor sebagian / nol
                            </p>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs transition hover:shadow-md">
                        <TrendingUp
                            aria-hidden="true"
                            className="pointer-events-none absolute -right-2 -bottom-2 size-12 sm:size-14 text-primary/20 opacity-12 transition group-hover:scale-110"
                        />
                        <div className="relative z-10 space-y-1">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                Ketercapaian
                            </p>
                            <p className="font-display text-xl sm:text-2xl font-black text-primary">
                                {h.skor_maks
                                    ? Math.round((h.skor / h.skor_maks) * 100)
                                    : 0}
                                %
                            </p>
                            <p className="text-[11px] text-slate-400">
                                total skor diperoleh
                            </p>
                        </div>
                    </div>
                </div>

                {/* Banner info penundaan pembahasan (bila sedang berjalan) */}
                {h.pembahasan_ditunda && (
                    <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/90 p-4 text-xs text-sky-900 shadow-xs">
                        <Info className="size-4 shrink-0 text-sky-600 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="font-bold text-sm text-sky-950">
                                Jadwal Ujian Masih Berlangsung
                            </p>
                            <p className="text-sky-800 leading-relaxed">
                                Nilai akhir Anda sudah tercatat di atas. Kunci
                                jawaban dan pembahasan per butir soal akan
                                otomatis terbuka setelah seluruh jadwal ujian
                                selesai
                                {h.pembahasan_terbuka_pada
                                    ? ` (${jamMenit(h.pembahasan_terbuka_pada, true)})`
                                    : ""}
                                .
                            </p>
                        </div>
                    </div>
                )}

                {/* Filter & Toolbar Soal */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80 print:hidden">
                    <div className="flex items-center gap-1.5 rounded-xl bg-slate-200/60 p-1">
                        <button
                            type="button"
                            onClick={() => setFilter("semua")}
                            className={cn(
                                "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                                filter === "semua"
                                    ? "bg-white text-ink shadow-xs"
                                    : "text-slate-600 hover:text-ink",
                            )}
                        >
                            Semua ({totalSoal})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter("penuh")}
                            className={cn(
                                "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                                filter === "penuh"
                                    ? "bg-white text-emerald-700 shadow-xs"
                                    : "text-slate-600 hover:text-emerald-700",
                            )}
                        >
                            Benar ({soalPenuh})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter("evaluasi")}
                            className={cn(
                                "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                                filter === "evaluasi"
                                    ? "bg-white text-amber-700 shadow-xs"
                                    : "text-slate-600 hover:text-amber-700",
                            )}
                        >
                            Evaluasi ({soalEvaluasi})
                        </button>
                    </div>

                    {h.soal.some((s) => s.pembahasan) && (
                        <button
                            type="button"
                            onClick={toggleBukaSemua}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-700 transition"
                        >
                            <Lightbulb className="size-3.5 text-amber-500" />
                            <span>
                                {semuaBuka
                                    ? "Tutup Semua Pembahasan"
                                    : "Buka Semua Pembahasan"}
                            </span>
                        </button>
                    )}
                </div>

                {/* Daftar Butir Soal */}
                <div className="space-y-4">
                    {daftarTampil.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                            <p className="text-sm font-semibold">
                                Tidak ada butir soal dalam kategori ini.
                            </p>
                        </div>
                    ) : (
                        daftarTampil.map((s) => {
                            const penuh = s.skor !== null && s.skor >= s.bobot;
                            const nol = s.skor === 0;
                            const dianulir = s.anulir !== null;
                            const terbuka = bukaMap[s.id] ?? semuaBuka;

                            return (
                                <article
                                    key={s.id}
                                    className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs space-y-4 transition hover:border-slate-300"
                                >
                                    {/* Header Butir Soal */}
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex h-7 sm:h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs sm:text-sm font-extrabold text-white shadow-2xs tabular-nums">
                                                Soal {s.nomor}
                                            </span>
                                        </div>

                                        {/* Status Skor Badge */}
                                        <div>
                                            {dianulir ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600">
                                                    Dianulir
                                                </span>
                                            ) : s.skor === null ? null : (
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border",
                                                        penuh
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-300/80"
                                                            : nol
                                                              ? "bg-coral-50 text-coral-700 border-coral-300/80"
                                                              : "bg-amber-50 text-amber-700 border-amber-300/80",
                                                    )}
                                                >
                                                    {penuh ? (
                                                        <CheckCircle2 className="size-3.5" />
                                                    ) : nol ? (
                                                        <XCircle className="size-3.5" />
                                                    ) : (
                                                        <MinusCircle className="size-3.5" />
                                                    )}
                                                    <span>
                                                        Skor {angka(s.skor)} /{" "}
                                                        {angka(s.bobot)}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Wacana / Stimulus (Bila ada) */}
                                    {s.stimulus_id &&
                                        h.stimulus?.[String(s.stimulus_id)] && (
                                            <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 sm:p-4 text-xs sm:text-sm text-slate-700 space-y-2">
                                                <div className="flex items-center gap-1.5 font-bold text-sky-800">
                                                    <BookOpen className="size-3.5 text-sky-600" />
                                                    <span>
                                                        {h.stimulus[
                                                            String(
                                                                s.stimulus_id,
                                                            )
                                                        ].judul ||
                                                            "Wacana / Bahan Bacaan"}
                                                    </span>
                                                </div>
                                                <RenderKonten
                                                    doc={
                                                        h.stimulus[
                                                            String(
                                                                s.stimulus_id,
                                                            )
                                                        ].konten as TiptapNode
                                                    }
                                                />
                                            </div>
                                        )}

                                    {/* Teks Pertanyaan */}
                                    <div className="text-sm sm:text-base text-slate-800 leading-relaxed font-medium">
                                        <RenderKonten
                                            doc={s.pertanyaan as TiptapNode}
                                        />
                                    </div>

                                    {/* Catatan / Komentar Guru (Bila ada) */}
                                    {s.komentar.length > 0 && (
                                        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 p-3 text-xs sm:text-sm text-amber-900">
                                            <MessageSquareText className="size-4 shrink-0 text-amber-600 mt-0.5" />
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-amber-950 text-xs uppercase tracking-wide">
                                                    Catatan Guru:
                                                </p>
                                                <p className="leading-relaxed">
                                                    {s.komentar.join(" · ")}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Accordion Pembahasan Soal */}
                                    {s.pembahasan && (
                                        <div className="pt-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleAccordion(s.id)
                                                }
                                                className="flex w-full items-center justify-between rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 transition"
                                                aria-expanded={terbuka}
                                            >
                                                <span className="flex items-center gap-2 text-primary font-bold">
                                                    <Lightbulb className="size-4 text-amber-500" />
                                                    <span>
                                                        Kunci Jawaban &amp;
                                                        Pembahasan
                                                    </span>
                                                </span>
                                                <ChevronDown
                                                    className={cn(
                                                        "size-4 text-slate-400 transition-transform duration-200",
                                                        terbuka && "rotate-180",
                                                    )}
                                                />
                                            </button>

                                            {terbuka && (
                                                <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 text-xs sm:text-sm text-slate-800 leading-relaxed space-y-2">
                                                    <RenderKonten
                                                        doc={
                                                            s.pembahasan as TiptapNode
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })
                    )}
                </div>

            </main>
        </div>
    );
}
