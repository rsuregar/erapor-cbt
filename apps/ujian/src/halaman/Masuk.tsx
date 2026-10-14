import { api } from '@/lib/api'
import { sesi } from '@/lib/sesi'
import { GalatApi } from '@erapor-cbt/exam-core'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'
import { useState } from 'react'

/** Masuk dengan akun e-Rapor murid (NIS/username + kata sandi). */
export default function Masuk() {
    const navigate = useNavigate()
    const [nis, setNis] = useState('')
    const [sandi, setSandi] = useState('')
    const masuk = useMutation({
        mutationFn: () => api.masuk(nis.trim(), sandi),
        onSuccess: async ({ data }) => {
            await sesi.masuk(data.access_token, (data.user?.name as string) ?? null)
            await navigate({ to: '/' })
        },
    })
    const galat = masuk.error instanceof GalatApi ? (masuk.error.status === 401 ? 'NIS atau kata sandi salah.' : masuk.error.message) : null

    return (
        <main className="flex min-h-full items-center justify-center bg-slate-50 p-4">
            <form
                className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                onSubmit={(e) => {
                    e.preventDefault()
                    masuk.mutate()
                }}
            >
                <div>
                    <h1 className="text-xl font-semibold">Ujian Al Akhyar</h1>
                    <p className="text-sm text-slate-500">Masuk dengan akun e-Rapor.</p>
                </div>
                <label className="block space-y-1">
                    <span className="text-sm font-medium">NIS / username</span>
                    <input className="w-full rounded-lg border border-slate-300 px-3 py-2" autoComplete="username" value={nis} onChange={(e) => setNis(e.target.value)} required />
                </label>
                <label className="block space-y-1">
                    <span className="text-sm font-medium">Kata sandi</span>
                    <input type="password" className="w-full rounded-lg border border-slate-300 px-3 py-2" autoComplete="current-password" value={sandi} onChange={(e) => setSandi(e.target.value)} required />
                </label>
                {galat && <p className="text-sm text-rose-600">{galat}</p>}
                <button type="submit" disabled={masuk.isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white disabled:opacity-60">
                    <LogIn className="size-4" /> {masuk.isPending ? 'Memeriksa…' : 'Masuk'}
                </button>
            </form>
        </main>
    )
}
