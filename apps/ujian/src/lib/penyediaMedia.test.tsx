import { PenyediaMedia, RenderKonten, type TiptapNode } from '@erapor-cbt/question-renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

const doc: TiptapNode = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'https://erapor.test/storage/a.png', alt: 'Grafik' } }] }],
}

describe('PenyediaMedia (question-renderer)', () => {
    it('tanpa penyedia: src asli dipakai (pratinjau guru e-Rapor tidak berubah)', () => {
        expect(renderToStaticMarkup(<RenderKonten doc={doc} />)).toContain('src="https://erapor.test/storage/a.png"')
    })

    it('dengan penyedia: src gambar diarahkan ke berkas lokal', () => {
        const html = renderToStaticMarkup(
            <PenyediaMedia ubahSrc={(src) => (src.endsWith('a.png') ? 'asset://localhost/media/abc.png' : src)}>
                <RenderKonten doc={doc} />
            </PenyediaMedia>,
        )
        expect(html).toContain('src="asset://localhost/media/abc.png"')
        expect(html).toContain('alt="Grafik"')
    })
})
