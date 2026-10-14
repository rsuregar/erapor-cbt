import { sesi } from '@/lib/sesi'
import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import Beranda from './halaman/Beranda'
import Hasil from './halaman/Hasil'
import Masuk from './halaman/Masuk'
import Persiapan from './halaman/Persiapan'

const akar = createRootRoute({ component: Outlet })

const masuk = createRoute({
    getParentRoute: () => akar,
    path: '/masuk',
    beforeLoad: async () => {
        await sesi.muat()
        if (sesi.token()) throw redirect({ to: '/' })
    },
    component: Masuk,
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

const hasil = createRoute({
    getParentRoute: () => terlindungi,
    path: '/hasil/$attemptId',
    params: { parse: (p) => ({ attemptId: Number(p.attemptId) }), stringify: (p) => ({ attemptId: String(p.attemptId) }) },
    component: function HalamanHasil() {
        return <Hasil attemptId={hasil.useParams().attemptId} />
    },
})

export const router = createRouter({
    routeTree: akar.addChildren([masuk, terlindungi.addChildren([beranda, persiapan, hasil])]),
})

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
