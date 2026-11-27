import { describe, expect, it } from 'vitest';
import { jpegToPdf } from '@/utils/simplePdf';

describe('jpegToPdf', () => {
  it('writes a valid single-page PDF with a correct cross-reference table', async () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const blob = jpegToPdf(fakeJpeg, 1080, 2160, 'Season 1 (Week 2) Awards 🏆');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);

    expect(blob.type).toBe('application/pdf');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 595.28 1190.56]'); // A4 width, 1:2 aspect
    expect(text).toContain('/Title (Season 1 \\(Week 2\\) Awards )');

    // Every xref offset must point at its "n 0 obj" header
    const xrefAt = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const offsets = [...text.slice(xrefAt).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(6);
    offsets.forEach((o, i) => expect(text.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));

    // Image stream length matches the JPEG bytes
    expect(text).toContain(`/Length ${fakeJpeg.length}`);
  });
});
