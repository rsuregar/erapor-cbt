import { jenisPerangkat } from '@/lib/perangkat'
import { sesi } from '@/lib/sesi'
import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { NotifikasiKoneksiGlobal } from '@/komponen/IndikatorKoneksi'
import Beranda from './halaman/Beranda'
import Hasil from './halaman/Hasil'
import Kerjakan from './halaman/Kerjakan'
import Masuk from './halaman/Masuk'
import Panduan, { type UntukPanduan } from './halaman/Panduan'
import Persiapan from './halaman/Persiapan'
import { GarisStaging } from '@/komponen/PenandaStaging'

function AkarLayout() {
    return (
        <>
            <GarisStaging />
            <NotifikasiKoneksiGlobal />
            <Outlet />
        </>
    )
}

const akar = createRootRoute({ component: AkarLayout })

const masuk = createRoute({
    getParentRoute: () => akar,
    path: '/masuk',
    beforeLoad: async () => {
        await sesi.muat()
        if (sesi.token()) throw redirect({ to: '/' })
    },
    component: Masuk,
})

/** Panduan pasang aplikasi & kunci layar — terbuka tanpa login (disiapkan sebelum hari ujian). */
const panduan = createRoute({
    getParentRoute: () => akar,
    path: '/panduan',
    validateSearch: (s: Record<string, unknown>): { untuk?: UntukPanduan } =>
        s.untuk === 'ios' || s.untuk === 'android' || s.untuk === 'laptop' ? { untuk: s.untuk } : {},
    component: function HalamanPanduan() {
        const { untuk } = panduan.useSearch()
        const j = jenisPerangkat()

        return <Panduan untuk={untuk ?? (j === 'desktop' ? 'laptop' : j)} />
    },
})

/** Semua rute di bawah ini butuh login. */
const terlindungi = createRoute({
    getParentRoute: () => akar,
    id: 'terlindungi',
    beforeLoad: async () => {
        await sesi.muat()
        if (!sesi.token()) throw redirect({ to: '/masuk' })
    },
    component: Outlet,
})

const beranda = createRoute({ getParentRoute: () => terlindungi, path: '/', component: Beranda })

const persiapan = createRoute({
    getParentRoute: () => terlindungi,
    path: '/ujian/$ujianId',
    params: { parse: (p) => ({ ujianId: Number(p.ujianId) }), stringify: (p) => ({ ujianId: String(p.ujianId) }) },
    component: function HalamanPersiapan() {
        return <Persiapan ujianId={persiapan.useParams().ujianId} />
    },
})

const kerjakan = createRoute({
    getParentRoute: () => terlindungi,
    path: '/kerjakan/$attemptId',
    params: { parse: (p) => ({ attemptId: Number(p.attemptId) }), stringify: (p) => ({ attemptId: String(p.attemptId) }) },
    component: function HalamanKerjakan() {
        return <Kerjakan attemptId={kerjakan.useParams().attemptId} />
    },
})

const hasil = createRoute({
    getParentRoute: () => terlindungi,
    path: '/hasil/$attemptId',
    params: { parse: (p) => ({ attemptId: Number(p.attemptId) }), stringify: (p) => ({ attemptId: String(p.attemptId) }) },
    component: function HalamanHasil() {
        return <Hasil attemptId={hasil.useParams().attemptId} />
    },
})

export const router = createRouter({
    routeTree: akar.addChildren([masuk, panduan, terlindungi.addChildren([beranda, persiapan, kerjakan, hasil])]),
})

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
