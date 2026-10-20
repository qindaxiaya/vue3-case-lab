// ============================================================
// 最小 PDF 生成器（仅供演示）
// 手写 PDF 1.4 结构：Catalog → Pages → Page → Content Stream
// 只用 Helvetica 内置字体，所以文本必须是 ASCII（中文需要嵌入字体）
// ============================================================

/** 转义 PDF 字符串里的特殊字符 */
function escapePdf(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

/**
 * 生成多页 PDF
 * @param pageLines 每页的文本行（ASCII）
 * @param fontSize 字号
 */
export function createPdfBlob(pageLines: string[][], fontSize = 13): Blob {
  const pageCount = pageLines.length
  // 对象编号：1 Catalog、2 Pages、3 Font，之后每页占 2 个（Page + Contents）
  const pageIds = pageLines.map((_, i) => 4 + i * 2)
  const contentIds = pageLines.map((_, i) => 5 + i * 2)

  const objects: string[] = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(' ')}] /Count ${pageCount} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'

  pageLines.forEach((lines, i) => {
    objects[pageIds[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[i]} 0 R >>`

    // BT…ET 文本块；T* 换行，TL 设置行距
    const body = lines.map((line) => `(${escapePdf(line)}) Tj T*`).join('\n')
    const stream = `BT /F1 ${fontSize} Tf 50 780 Td 18 TL\n${body}\nET`
    objects[contentIds[i]] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })

  // 拼接正文，同时记录每个对象的字节偏移（xref 必须指向真实偏移）
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pdf.length
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }

  const xrefStart = pdf.length
  const total = objects.length
  pdf += `xref\n0 ${total}\n0000000000 65535 f \n`
  for (let i = 1; i < total; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

/** 演示用：生成一份三页的英文 PDF */
export function createSamplePdf(): Blob {
  return createPdfBlob([
    [
      'Vue 3 Case Lab - PDF Preview Demo',
      '',
      'This file is generated entirely in the browser.',
      'No pdf-lib, no server, no network request.',
      '',
      'Structure:',
      '  1. Catalog object',
      '  2. Pages tree',
      '  3. Font resource (Helvetica)',
      '  4. Content streams (one per page)',
      '',
      'Every xref offset is calculated while concatenating',
      'the file, which is the part most people get wrong.',
    ],
    [
      'Page 2 - Why hand-write a PDF?',
      '',
      'A PDF is a plain text file with a binary header.',
      'You can build a tiny one by hand to understand:',
      '',
      '  - object numbering and references',
      '  - the xref table (byte offsets)',
      '  - text operators: BT / Tf / Td / Tj / ET',
      '',
      'Real projects should use pdf-lib or pdfjs-dist instead.',
    ],
    [
      'Page 3 - License note',
      '',
      'Helvetica is a standard PDF font: no embedding.',
      'That is why all text here is ASCII. Chinese text',
      'requires embedding a CJK font subset, which is',
      'much more work than this demo needs.',
    ],
  ])
}
