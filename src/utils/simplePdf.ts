/**
 * Minimal PDF writer: one page holding one JPEG image, sized to A4 width with the
 * image's aspect ratio. Enough for exporting a canvas poster without a PDF library.
 */

const A4_WIDTH_PT = 595.28;
const num = (n: number) => (Math.round(n * 100) / 100).toString();

type Bytes = Uint8Array<ArrayBuffer>;

export function jpegToPdf(jpeg: Bytes, widthPx: number, heightPx: number, title = ''): Blob {
  const pageW = A4_WIDTH_PT;
  const pageH = (A4_WIDTH_PT * heightPx) / widthPx;
  const enc = new TextEncoder();
  const parts: Bytes[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (data: Bytes | string) => {
    const bytes: Bytes = typeof data === 'string' ? enc.encode(data) : data;
    parts.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, ...body: (Bytes | string)[]) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    body.forEach(push);
    push('\nendobj\n');
  };
  // PDF strings: escape the characters with special meaning, keep it ASCII
  const pdfString = (s: string) => `(${s.replace(/[^\x20-\x7e]/g, '').replace(/([\\()])/g, '\\$1')})`;

  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pageW)} ${num(pageH)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    '\nendstream',
  );
  const content = `q ${num(pageW)} 0 0 ${num(pageH)} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, `<< /Title ${pdfString(title)} /Producer (CricScore) >>`);

  const xref = length;
  push(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
