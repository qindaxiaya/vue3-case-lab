// ============================================================
// notes ↔ Demo 同源校验
//
// 为什么要有它：
// notes.md 里经常写「关键在 useXxx()」「看第 42 行」这类定位，
// 案例代码改名 / 重排后，notes 还停在旧名字上，读者照着找不到。
// 静态单测无法判断「讲得对不对」，但可以拦住「引用的名字已经不存在」。
//
// 校验两条：
// 1. 标识符：notes 正文（跳过代码块）反引号里的「自造名」必须能在 Demo.vue 或 code/*.txt 找到；
//    只查 6 个字符以上、形如 camelCase / kebab-case 的名字，库 API 与通用词进白名单。
// 2. 行号：`第 N 行` / `L12` 的 N 不能超过 Demo.vue 的实际行数。
// ============================================================
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { allCases } from '../src/examples/registry'
import { ALLOW_IDENTIFIERS } from './notes-source.allow'

/** src/examples 的绝对路径（按测试文件位置推导，避免依赖启动目录） */
const EXAMPLES_DIR = fileURLToPath(new URL('../src/examples', import.meta.url))

/**
 * 扫描模式：只把存量引用打印出来，不失败。
 * 白名单与 notes 修正完成后再改成 false，把断言打开。
 */
const SCAN_ONLY = false

/** camelCase 自造名：小写开头、长度 ≥6（如 useStorage） */
const CAMEL_CASE = /^[a-z][A-Za-z0-9]{5,}$/
/** kebab-case 自造名：小写 + 连字符、长度 ≥6（如 use-storage） */
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/
/** 从反引号内容里切出候选标识符（排除标点、空格、数字开头、--css-var 前缀） */
const TOKEN_PATTERN = /(?<![\w$-])[A-Za-z_$][\w$]*(?:-[\w$]+)*/g
/** 单行内联代码：`xxx`（不跨行） */
const INLINE_CODE = /`([^`\n]+)`/g
/** 行号引用：第 42 行 / L42 */
const LINE_REF = /第\s*(\d+)\s*行|\bL(\d+)\b/g
/** 围栏代码块起始行（这类内容不参与「自造名」扫描） */
const FENCE = /^\s*```/

/** notes 里的一处名字引用 */
interface NameRef {
  name: string
  line: number
}

/** Demo.vue 里的一处行号引用 */
interface LineRef {
  line: number
  target: number
}

/** 判断一个 token 是否属于要校验的「自造名」形态 */
function isSelfMadeName(token: string): boolean {
  return CAMEL_CASE.test(token) || KEBAB_CASE.test(token)
}

/**
 * 从 notes 正文提取标识符引用
 * - 跳过围栏代码块（第 3 段贴的代码与 Demo 同源，仍由人工保证一致）
 * - 同一行多个反引号片段都会扫到；行号按 1 开始
 */
function collectNameRefs(notes: string): NameRef[] {
  const refs: NameRef[] = []
  let inFence = false

  for (const [index, line] of notes.split('\n').entries()) {
    // 围栏开关：``` 开头翻转状态，围栏本身不扫描
    if (FENCE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    for (const span of line.matchAll(INLINE_CODE)) {
      for (const token of span[1].matchAll(TOKEN_PATTERN)) {
        if (!isSelfMadeName(token[0])) continue
        refs.push({ name: token[0], line: index + 1 })
      }
    }
  }

  return refs
}

/** 从 notes 提取行号引用（1 开始计行） */
function collectLineRefs(notes: string): LineRef[] {
  const refs: LineRef[] = []

  for (const [index, line] of notes.split('\n').entries()) {
    for (const match of line.matchAll(LINE_REF)) {
      // 两个分组只会命中一个：第 N 行 或 L N
      const target = Number(match[1] ?? match[2])
      if (!Number.isFinite(target)) continue
      refs.push({ line: index + 1, target })
    }
  }

  return refs
}

/** 逐个案例收集违规，返回两类可读信息 */
function collectViolations() {
  const missingNames: string[] = []
  const outOfRangeLines: string[] = []

  for (const item of allCases) {
    const caseName = `${item.categoryId}/${item.meta.id}`
    const caseDir = path.join(EXAMPLES_DIR, item.categoryId, item.meta.id)
    const notesFile = path.join(caseDir, 'notes.md')
    const demoFile = path.join(caseDir, 'Demo.vue')

    // 文件缺失由 content-quality 校验负责，这里跳过避免重复报错
    if (!existsSync(notesFile) || !existsSync(demoFile)) continue

    const notes = readFileSync(notesFile, 'utf8')
    const demo = readFileSync(demoFile, 'utf8')
    const demoLines = demo.split('\n').length

    // 教学代码片段与 Demo 同属「案例实现」：notes 第 3 段引用的名字有时
    // 只出现在 code/*.txt（Demo 为了演示做了简化命名），两边都算命中。
    const codeDir = path.join(caseDir, 'code')
    const codeText = existsSync(codeDir)
      ? readdirSync(codeDir)
          .filter((file) => file.endsWith('.txt'))
          .map((file) => readFileSync(path.join(codeDir, file), 'utf8'))
          .join('\n')
      : ''
    const implementation = `${demo}\n${codeText}`

    // ---------- 标识符：同名的多处引用只报第一条 ----------
    const reported = new Set<string>()
    for (const ref of collectNameRefs(notes)) {
      if (ALLOW_IDENTIFIERS[ref.name]) continue
      if (implementation.includes(ref.name)) continue
      if (reported.has(ref.name)) continue
      reported.add(ref.name)
      missingNames.push(
        `案例 ${caseName} · 标识符 ${ref.name} 在 Demo.vue / code/*.txt 中不存在（notes.md 第 ${ref.line} 行引用）`,
      )
    }

    // ---------- 行号：只拦越界，不校验语义 ----------
    const reportedLines = new Set<number>()
    for (const ref of collectLineRefs(notes)) {
      if (ref.target <= demoLines) continue
      if (reportedLines.has(ref.target)) continue
      reportedLines.add(ref.target)
      outOfRangeLines.push(
        `案例 ${caseName} · 引用第 ${ref.target} 行超出 Demo.vue 长度（共 ${demoLines} 行，notes.md 第 ${ref.line} 行）`,
      )
    }
  }

  return { missingNames, outOfRangeLines }
}

describe('notes 与 Demo 同源', () => {
  const { missingNames, outOfRangeLines } = collectViolations()

  if (SCAN_ONLY) {
    it('扫描模式：只输出存量引用，不失败', () => {
      console.log(
        `[notes-source] 扫描 ${allCases.length} 个案例：疑似缺失标识符 ${missingNames.length} 处、越界行号 ${outOfRangeLines.length} 处`,
      )
      for (const line of missingNames) console.log(line)
      for (const line of outOfRangeLines) console.log(line)
      expect(true).toBe(true)
    })
    return
  }

  it('notes 引用的自造名都能在案例实现里找到', () => {
    expect(missingNames, `以下引用在 Demo.vue / code/*.txt 里找不到：\n${missingNames.join('\n')}`).toEqual([])
  })

  it('notes 引用的行号不超出 Demo.vue 长度', () => {
    expect(
      outOfRangeLines,
      `以下行号引用越界：\n${outOfRangeLines.join('\n')}`,
    ).toEqual([])
  })
})
