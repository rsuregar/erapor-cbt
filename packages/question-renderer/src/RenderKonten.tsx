import katex from 'katex'
import 'katex/dist/katex.min.css'
import { createContext, Fragment, ReactNode, useContext } from 'react'
import { arahTeks, teksNode } from './arahTeks'
import type { TiptapMark, TiptapNode } from './types'

/**
 * Menampilkan dokumen JSON Tiptap tanpa memuat editor — ringan untuk HP
 * murid. Node yang dikenal mengikuti ekstensi editor bank soal: StarterKit,
 * Table, Image (inline), Mathematics (inlineMath/blockMath).
 *
 * Teks Arab: arah tiap paragraf ditentukan dari isinya (lihat arahTeks).
 */

/** Pengganti src media; default: src apa adanya (pratinjau guru e-Rapor tidak memasang penyedia). */
const KonteksMedia = createContext<(src: string) => string>((src) => src)

/**
 * Arahkan src media soal ke salinan lain, mis. berkas lokal hasil pra-unduh
 * di app ujian native agar gambar tetap tampil saat offline.
 */
export function PenyediaMedia({ ubahSrc, children }: { ubahSrc: (src: string) => string; children: ReactNode }) {
    return <KonteksMedia.Provider value={ubahSrc}>{children}</KonteksMedia.Provider>
}

export default function RenderKonten({
    doc,
    className = '',
}: {
    doc?: TiptapNode | null
    className?: string
}) {
    if (!doc) return null

    return (
        <div className={`konten-soal space-y-2 leading-relaxed ${className}`}>
            {renderAnak(doc.content)}
        </div>
    )
}

function renderAnak(nodes?: TiptapNode[]): ReactNode {
    return nodes?.map((n, i) => <Fragment key={i}>{renderNode(n)}</Fragment>)
}

const arah = (node: TiptapNode) => arahTeks(teksNode(node))

function renderNode(node: TiptapNode): ReactNode {
    switch (node.type) {
        case 'paragraph': {
            const dir = arah(node)
            // Harakat butuh huruf lebih besar dan baris lebih lega agar terbaca.
            return (
                <p dir={dir} className={`min-h-[1em] ${dir === 'rtl' ? 'text-[1.35em] leading-loose' : ''}`}>
                    {renderAnak(node.content)}
                </p>
            )
        }
        case 'heading': {
            const level = Math.min(Math.max(node.attrs?.level ?? 3, 1), 4)
            const ukuran = ['text-xl', 'text-lg', 'text-base', 'text-sm'][level - 1]
            return (
                <p dir={arah(node)} className={`${ukuran} font-semibold`}>
                    {renderAnak(node.content)}
                </p>
            )
        }
        case 'text':
            return renderTeks(node.text ?? '', node.marks)
        case 'hardBreak':
            return <br />
        case 'bulletList':
            return <ul className="list-disc pl-6 space-y-1">{renderAnak(node.content)}</ul>
        case 'orderedList':
            return (
                <ol start={node.attrs?.start ?? 1} className="list-decimal pl-6 space-y-1">
                    {renderAnak(node.content)}
                </ol>
            )
        case 'listItem':
            return <li dir={arah(node)}>{renderAnak(node.content)}</li>
        case 'blockquote':
            return (
                <blockquote className="border-l-4 border-slate-300 pl-3 text-slate-700 dark:text-slate-300">
                    {renderAnak(node.content)}
                </blockquote>
            )
        case 'codeBlock':
            return (
                <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-sm text-slate-100" dir="ltr">
                    <code>{node.content?.map((c) => c.text).join('')}</code>
                </pre>
            )
        case 'horizontalRule':
            return <hr className="my-2 border-slate-200" />
        case 'image':
            return node.attrs?.src ? <Gambar src={node.attrs.src} alt={node.attrs.alt ?? ''} /> : null
        case 'table':
            return (
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                        <tbody>{renderAnak(node.content)}</tbody>
                    </table>
                </div>
            )
        case 'tableRow':
            return <tr>{renderAnak(node.content)}</tr>
        case 'tableHeader':
            return (
                <th className="border border-slate-300 bg-slate-50 px-2 py-1 text-left font-semibold dark:bg-slate-800">
                    {renderAnak(node.content)}
                </th>
            )
        case 'tableCell':
            return <td className="border border-slate-300 px-2 py-1 align-top">{renderAnak(node.content)}</td>
        case 'inlineMath':
            return <Rumus latex={node.attrs?.latex ?? ''} blok={false} />
        case 'blockMath':
            return <Rumus latex={node.attrs?.latex ?? ''} blok />
        default:
            // Node tak dikenal: tampilkan isinya saja, jangan hilangkan teks.
            return renderAnak(node.content)
    }
}

function renderTeks(teks: string, marks?: TiptapMark[]): ReactNode {
    let hasil: ReactNode = teks
    for (const m of marks ?? []) {
        switch (m.type) {
            case 'bold':
                hasil = <strong>{hasil}</strong>
                break
            case 'italic':
                hasil = <em>{hasil}</em>
                break
            case 'underline':
                hasil = <u>{hasil}</u>
                break
            case 'strike':
                hasil = <s>{hasil}</s>
                break
            case 'code':
                hasil = <code className="rounded bg-slate-100 px-1 text-[0.9em] dark:bg-slate-800">{hasil}</code>
                break
            case 'superscript':
                hasil = <sup>{hasil}</sup>
                break
            case 'subscript':
                hasil = <sub>{hasil}</sub>
                break
            case 'link':
                // Tautan di soal ditampilkan sebagai teks: murid tidak boleh
                // keluar dari halaman ujian.
                hasil = <span className="underline">{hasil}</span>
                break
        }
    }
    return hasil
}

function Gambar({ src, alt }: { src: string; alt: string }) {
    const ubahSrc = useContext(KonteksMedia)
    return <img src={ubahSrc(src)} alt={alt} loading="lazy" className="my-1 inline-block max-h-80 max-w-full rounded align-middle" />
}

function Rumus({ latex, blok }: { latex: string; blok: boolean }) {
    // KaTeX meng-escape masukannya sendiri; throwOnError false supaya LaTeX
    // yang salah tampil merah, bukan membuat seluruh soal gagal dirender.
    const html = katex.renderToString(latex, { displayMode: blok, throwOnError: false, output: 'html' })
    return blok ? (
        <div className="my-2 overflow-x-auto" dir="ltr" dangerouslySetInnerHTML={{ __html: html }} />
    ) : (
        <span dir="ltr" dangerouslySetInnerHTML={{ __html: html }} />
    )
}
