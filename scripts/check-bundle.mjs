// ============================================================
// 首屏体积门禁（构建后运行：npm run check:bundle）
//
// 为什么需要它：
// 2026-10-21 之前 registry 的四个 import.meta.glob 全是 eager，
// 62 个案例的 Demo 源码与教学代码（约 750 KB 文本）被逐字内联进首屏包，
// 首屏 gzip 达到 521 KB。这类回归不会让测试变红，只能靠体积门禁兜住。
//
// 检查三项：
// 1. index.html 里首屏必载资源（entry + modulepreload + stylesheet）gzip 总和
// 2. 单个 JS chunk 原始体积（pdf/worker 除外，它们是按需加载的）
// 3. 首屏包里不得出现教学代码标记「//! 中文」，防止源码再被内联
// ============================================================
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = path.resolve('dist')

/** 首屏 gzip 预算：当前约 94 KB，留一倍余量 */
const ENTRY_GZIP_BUDGET = 180 * 1024
/** 单个 JS chunk 原始体积上限：与 vite.config.ts 的 chunkSizeWarningLimit 对齐 */
const CHUNK_RAW_BUDGET = 600 * 1024
/** 教学代码标记：//! 后紧跟中文（我们的 code/*.txt 注释约定） */
const TEACHING_MARKER = /\/\/!\s*[\u4e00-\u9fa5]/

/** 读取文件并返回原始体积与 gzip 体积 */
function measure(file) {
  const buf = readFileSync(file)
  return { raw: buf.byteLength, gzip: gzipSync(buf).byteLength, buf }
}

/** KB 展示，保留一位小数 */
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

const html = readFileSync(path.join(DIST, 'index.html'), 'utf8')

// 从 HTML 提取首屏资源：<script src>、<link rel="modulepreload">、<link rel="stylesheet">
const entryAssets = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(
      (m) => m[1].replace(/^\//, ''),
    ),
  ),
]

if (entryAssets.length === 0) {
  console.error('[bundle] 没在 dist/index.html 里找到首屏资源，构建产物异常')
  process.exit(1)
}

let entryGzip = 0
let entryRaw = 0
let entryJs = 0
const failures = []

console.log('[bundle] 首屏资源：')
for (const asset of entryAssets) {
  const { raw, gzip } = measure(path.join(DIST, asset))
  entryGzip += gzip
  entryRaw += raw
  console.log(`  ${asset.padEnd(42)} raw ${kb(raw).padStart(9)}  gzip ${kb(gzip).padStart(8)}`)

  if (asset.endsWith('.js')) {
    entryJs += gzip
    // 教学代码标记只可能在 JS 字符串里；命中即说明源码被重新内联
    if (TEACHING_MARKER.test(readFileSync(path.join(DIST, asset), 'utf8'))) {
      failures.push(
        `${asset} 里出现教学代码标记「//! 中文」：源码疑似被打进首屏包（应走懒加载）`,
      )
    }
  }
}
console.log(
  `[bundle] 首屏合计：raw ${kb(entryRaw)}  gzip ${kb(entryGzip)}（JS gzip ${kb(entryJs)}）`,
)

if (entryGzip > ENTRY_GZIP_BUDGET) {
  failures.push(
    `首屏 gzip ${kb(entryGzip)} 超出预算 ${kb(ENTRY_GZIP_BUDGET)}`,
  )
}

// 遍历全部 JS chunk，拦住「某个懒加载 chunk 悄悄变成巨无霸」
// 产物按 assets/js/{vendor,pages,cases,lib,workers} 分目录，需要递归查找
const assetsDir = path.join(DIST, 'assets')

/** 递归收集目录下的文件（返回相对 assets 的 posix 路径） */
function collectFiles(dir, prefix = '') {
  const result = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      result.push(...collectFiles(path.join(dir, entry.name), relative))
    } else {
      result.push(relative)
    }
  }
  return result
}

const jsFiles = collectFiles(assetsDir).filter((f) => f.endsWith('.js'))

for (const file of jsFiles) {
  // pdf.js 与 worker 是按需加载的独立大块，不参与单 chunk 预算
  if (file.startsWith('js/lib/') || file.includes('worker')) continue
  const { raw } = measure(path.join(assetsDir, file))
  if (raw > CHUNK_RAW_BUDGET) {
    failures.push(`${file} 原始体积 ${kb(raw)} 超出单 chunk 预算 ${kb(CHUNK_RAW_BUDGET)}`)
  }
}

console.log(`[bundle] 参与体积检查的 JS chunk：${jsFiles.length} 个`)

if (failures.length > 0) {
  console.error('\n[bundle] 体积门禁未通过：')
  for (const item of failures) console.error(`  - ${item}`)
  process.exit(1)
}

console.log('[bundle] 体积门禁通过 ✓')
