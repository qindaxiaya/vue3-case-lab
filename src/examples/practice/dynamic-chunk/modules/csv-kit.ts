// ============================================================
// CSV 小工具：解析带引号的逗号分隔文本
// - 演示「轻模块」：只有几 KB，按需加载时几乎瞬间就绪
// - 手写解析器只为教学，真实项目建议直接用 papaparse 之类成熟库
// ============================================================

/** 解析结果：表头 + 行数据 */
export interface CsvResult {
  header: string[]
  rows: string[][]
}

/**
 * 按 RFC 4180 的常见子集解析 CSV
 * 支持：双引号包裹、字段内逗号、字段内换行、"" 转义为一个引号
 */
export function parseCsv(text: string): CsvResult {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // 逐字符扫描：只有「不在引号里」的逗号和换行才是分隔符
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        // 连续两个引号 → 一个字面引号，否则表示引号段结束
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      // \r\n 只处理一次：跳过紧跟的 \n
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  // 收尾：最后一行可能没有换行符
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const [header = [], ...body] = rows
  return { header, rows: body.filter((item) => item.length > 1) }
}

/**
 * 生成演示用的 CSV 文本
 * 运行时拼接而不是塞一大段字符串常量：既能演示真实解析，又不给模块加体积
 */
export function buildSampleCsv(count = 400): string {
  const lines: string[] = ['城市,国家,人口(万),海拔(m)']
  const pool = ['杭州', '成都', '武汉', '西安', '南京', '苏州', '青岛', '厦门']
  for (let i = 0; i < count; i += 1) {
    const city = `${pool[i % pool.length]}-${i + 1}`
    const population = 120 + ((i * 37) % 900)
    const altitude = (i * 13) % 1200
    // 每 10 行加一个带引号且内含逗号的字段，专门考验解析器
    lines.push(i % 10 === 0 ? `${city},"备注, 采样点 ${i}",${population},${altitude}` : `${city},中国,${population},${altitude}`)
  }
  return lines.join('\n')
}
