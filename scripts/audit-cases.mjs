#!/usr/bin/env node
/**
 * 案例质量静态体检
 *
 * 为什么要有这个脚本：
 * 81 个案例靠人一个个翻，容易漏；而「notes 数字是估算」「命令写的是旧版本」
 * 这类问题不会被类型检查或单测拦住。这个脚本只做**可机器判断**的部分，
 * 把「讲得清不清楚」留给人工走查。
 *
 * 用法：
 *   npm run audit:cases                 # 终端摘要 + 写入 node_modules/.tmp/case-audit.md
 *   npm run audit:cases -- --json       # 输出 JSON（给别的脚本用）
 *   npm run audit:cases -- --only practice   # 只看某个分类 / 案例
 *
 * 退出码：永远 0（这是体检报告，不是门禁；门禁在 tests 与 check:ui）
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const EXAMPLES_DIR = path.resolve('src/examples')
const OUTPUT_FILE = path.resolve('node_modules/.tmp/case-audit.md')

/** 读取命令行参数 */
function readArg(name) {
  const index = process.argv.indexOf(name)
  if (index > -1 && process.argv[index + 1]) return process.argv[index + 1]
  return ''
}

const ONLY = readArg('--only')
const AS_JSON = process.argv.includes('--json')

/** 递归列出案例目录：src/examples/<分类>/<案例>/meta.ts */
function listCases() {
  const cases = []
  for (const category of readdirSync(EXAMPLES_DIR)) {
    const categoryDir = path.join(EXAMPLES_DIR, category)
    if (!statSync(categoryDir).isDirectory()) continue
    for (const id of readdirSync(categoryDir)) {
      const caseDir = path.join(categoryDir, id)
      if (!statSync(caseDir).isDirectory()) continue
      if (!existsSync(path.join(caseDir, 'meta.ts'))) continue
      cases.push({ category, id, dir: caseDir, name: `${category}/${id}` })
    }
  }
  return cases.sort((a, b) => a.name.localeCompare(b.name))
}

/** 数文本长度（按 Unicode 码点，中文与英文都算一个字符） */
const charLength = (text) => [...text].length

/** 读取文件，不存在返回空串 */
function readIfExists(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

/** 从 meta.ts 里抽字段（不引入 TS 运行时，够用即可） */
function parseMeta(source) {
  const field = (key) => {
    const match = source.match(new RegExp(`${key}:\\s*'([^']*)'`))
    return match?.[1] ?? ''
  }
  const tagsBlock = source.match(/tags:\s*\[([^\]]*)\]/)?.[1] ?? ''
  const tags = tagsBlock
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)

  return {
    id: field('id'),
    title: field('title'),
    summary: field('summary'),
    sell: field('sell'),
    tags,
    hasExplain: /explain:\s*\{/.test(source),
    explainKeys: ['situation', 'background', 'action', 'conclusion'].filter((key) =>
      new RegExp(`${key}:`).test(source),
    ),
  }
}

/** 统计 notes 的段落与问题数 */
function parseNotes(source) {
  const sections = source.split(/^## /m).slice(1)
  const section = (index) => sections.find((item) => item.startsWith(`${index}`)) ?? ''
  const s4 = section(4)
  const s5 = section(5)

  return {
    sectionCount: sections.length,
    s4HasTable: /\|\s*-{2,}/.test(s4),
    s4Approximate:
      /约|大约|估计|\d[\d.]*\s*(?:行|次|ms|毫秒|秒|s|像素|px|张|个|倍|%|％|帧|条|处|人|天|年)?\s*左右/.test(
        s4,
      ),
    s4MentionsMethod: /测量|实测|采集|统计/.test(s4),
    qaCount: source
      .split('\n')
      .filter((line) => /Q\s*[：:]/.test(line))
      .length,
    hasBoundary: /边界|不适用|局限/.test(s5),
  }
}

/** 静态检查 Demo 的稳定性与可访问性 */
function parseDemo(source) {
  const flags = []
  const usesTimer = /setInterval/.test(source)
  const usesObserver = /new (?:Resize|Intersection|Mutation)Observer|\.observe\(/.test(source)
  const usesListener = /addEventListener/.test(source)
  const usesWorker = /new Worker/.test(source)
  const hasUnmount = /onUnmounted|onBeforeUnmount/.test(source)

  if (usesTimer && !/clearInterval/.test(source)) flags.push('setInterval 没有 clearInterval')
  if (usesObserver && !/disconnect\(\)/.test(source)) flags.push('Observer 没有 disconnect')
  if (usesListener && !/removeEventListener|useEventListener/.test(source)) {
    flags.push('addEventListener 没有移除')
  }
  if (usesWorker && !/terminate\(\)/.test(source)) flags.push('Worker 没有 terminate')
  if (/document\.body\.style\.overflow/.test(source) && !hasUnmount) {
    flags.push('锁页面滚动但没有卸载还原')
  }
  if (/document\.getElementById/.test(source)) flags.push('用 document.getElementById 找容器')
  const hasModeSwitch = /const mode\s*=\s*ref|type Mode/.test(source)
  const hasPressedSemantics = /aria-pressed/.test(source)
  const hasRadioSemantics = /role="radio"/.test(source) && /aria-checked/.test(source)
  // 共享分段组件内部已经渲染 role="radio" + aria-checked，案例里只写 <DemoSegmented> 也算有语义
  const hasSharedSegmented = /<DemoSegmented/.test(source)
  if (hasModeSwitch && !hasPressedSemantics && !hasRadioSemantics && !hasSharedSegmented) {
    flags.push('有模式切换但缺 aria-pressed / radio 语义')
  }

  return {
    hasOpeningComment: /^\s*\/\/ ={5,}/.test(source.slice(0, 400)),
    hasTemplate: /<template>/.test(source),
    hasStyle: /<style scoped/.test(source),
    flags,
    lines: source.split('\n').length,
  }
}

/** 检查 notes / code 里与仓库现状冲突的写法 */
function parseStaleFacts(notes, codeText) {
  const text = `${notes}\n${codeText}`
  const hits = []
  if (/vue-tsc --noEmit/.test(text)) hits.push('notes/code 仍写 vue-tsc --noEmit（本项目用 -b）')
  if (/npx vitest run --coverage|coverage:\s*\{/.test(text)) {
    hits.push('notes/code 提到覆盖率门禁（本项目未配置 coverage）')
  }
  if (/manualChunks/.test(text) && !/codeSplitting\.groups/.test(text)) {
    hits.push('notes/code 只写 manualChunks（Vite 8 用 codeSplitting.groups）')
  }
  if (/18\s*个测试|18\s*\/\s*18/.test(text)) hits.push('测试数量 18 已过时')
  if (/(?:54|55|56|62)\s*个(?:案例|meta|篇)/.test(text)) hits.push('案例数量描述可能已过时')
  return hits
}

/** 单案例体检 */
function auditCase(item) {
  const issues = []
  const add = (level, message) => issues.push({ level, message })

  const metaSource = readIfExists(path.join(item.dir, 'meta.ts'))
  const notes = readIfExists(path.join(item.dir, 'notes.md'))
  const demo = readIfExists(path.join(item.dir, 'Demo.vue'))
  const codeDir = path.join(item.dir, 'code')
  const codeFiles = existsSync(codeDir)
    ? readdirSync(codeDir).filter((file) => file.endsWith('.txt'))
    : []
  const codeText = codeFiles
    .map((file) => readIfExists(path.join(codeDir, file)))
    .join('\n')

  // ---------- 文件结构 ----------
  if (!demo) add('P0', '缺少 Demo.vue')
  if (!notes) add('P0', '缺少 notes.md')
  if (codeFiles.length === 0) add('P0', '缺少 code/*.txt')

  // ---------- meta ----------
  const meta = parseMeta(metaSource)
  if (meta.id !== item.id) add('P1', `meta.id（${meta.id}）与目录名不一致`)
  if (!meta.title) add('P1', 'meta 缺少 title')
  if (charLength(meta.summary) > 40) add('P1', `summary ${charLength(meta.summary)} 字（>40）`)
  if (!meta.sell) add('P1', 'meta 缺少 sell')
  if (charLength(meta.sell) > 30) add('P1', `sell ${charLength(meta.sell)} 字（>30）`)
  if (meta.tags.length < 3 || meta.tags.length > 5) {
    add('P2', `tags ${meta.tags.length} 个（要求 3~5）`)
  }
  if (!meta.hasExplain || meta.explainKeys.length < 4) add('P1', 'meta.explain 四段不齐')

  // ---------- notes ----------
  const noteInfo = parseNotes(notes)
  if (noteInfo.sectionCount < 5) add('P1', `notes 只有 ${noteInfo.sectionCount} 段`)
  if (!noteInfo.s4HasTable) add('P1', 'notes 第 4 段没有表格')
  if (!noteInfo.s4MentionsMethod) add('P2', 'notes 第 4 段没写测量方式')
  if (noteInfo.s4Approximate) add('P2', 'notes 第 4 段出现估算词（约/大约/估计，或数字 + 左右），确认不是拿估算当实测')
  if (noteInfo.qaCount < 3) add('P2', `notes 第 5 段 Q&A 只有 ${noteInfo.qaCount} 条`)
  if (!noteInfo.hasBoundary) add('P2', 'notes 第 5 段没写适用边界')

  // ---------- 过时事实 ----------
  for (const hit of parseStaleFacts(notes, codeText)) add('P1', hit)

  // ---------- Demo ----------
  const demoInfo = parseDemo(demo)
  if (!demoInfo.hasOpeningComment) add('P2', 'Demo 顶部没有案例说明注释')
  if (!demoInfo.hasTemplate) add('P0', 'Demo 没有 template')
  if (!demoInfo.hasStyle) add('P2', 'Demo 没有 scoped 样式')
  for (const flag of demoInfo.flags) {
    add(flag.includes('aria') || flag.includes('getElementById') ? 'P2' : 'P1', flag)
  }

  // ---------- 教学代码 ----------
  const codeLines = codeText.split('\n').filter((line) => line.trim()).length
  if (codeLines < 15) add('P2', `code 只有 ${codeLines} 行有效内容，可能过薄`)

  return {
    name: item.name,
    category: item.category,
    lines: demoInfo.lines,
    codeLines,
    issues,
  }
}

const allCases = listCases().filter((item) => !ONLY || item.name.includes(ONLY))
const reports = allCases.map(auditCase)
const withIssues = reports.filter((item) => item.issues.length > 0)
const count = (level) =>
  reports.reduce(
    (sum, item) => sum + item.issues.filter((issue) => issue.level === level).length,
    0,
  )

if (AS_JSON) {
  console.log(JSON.stringify({ total: reports.length, reports }, null, 2))
  process.exit(0)
}

// ---------- 终端摘要 ----------
console.log(`\n[audit] 体检 ${reports.length} 个案例${ONLY ? `（过滤：${ONLY}）` : ''}`)
console.log(`[audit] 有问题 ${withIssues.length} 个 · P0 ${count('P0')} / P1 ${count('P1')} / P2 ${count('P2')}\n`)

for (const report of withIssues) {
  const levels = report.issues.map((issue) => issue.level).join('/')
  console.log(`- ${report.name} [${levels}]`)
  for (const issue of report.issues) {
    console.log(`    ${issue.level}  ${issue.message}`)
  }
}

// ---------- 写入 Markdown ----------
const lines = [
  '# 案例质量体检报告',
  '',
  `- 生成时间：${new Date().toLocaleString('zh-CN')}`,
  `- 范围：${reports.length} 个案例${ONLY ? `（过滤：${ONLY}）` : ''}`,
  `- 有问题：${withIssues.length} 个 · P0 ${count('P0')} / P1 ${count('P1')} / P2 ${count('P2')}`,
  '',
  '> 这是静态体检，只覆盖可机器判断的项；「讲得清不清楚」仍需人工走查。',
  '',
  '| 案例 | 级别 | 问题 |',
  '| --- | --- | --- |',
  ...withIssues.flatMap((report) =>
    report.issues.map(
      (issue) => `| ${report.name} | ${issue.level} | ${issue.message} |`,
    ),
  ),
  '',
]

mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8')
console.log(`\n[audit] 报告已写入 ${path.relative(process.cwd(), OUTPUT_FILE)}`)
