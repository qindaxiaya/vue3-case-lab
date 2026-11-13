#!/usr/bin/env node
// ============================================================
// 案例清单生成器（CASES.md）
//
// 为什么要有这个脚本：
// 案例清单只存在于运行时（registry.ts 用 import.meta.glob 扫描目录），
// 仓库里没有一份可离线引用、可 diff 的索引。一百多条记录手写必然过期，
// 所以清单必须从「唯一真相」生成，不能手维护。
//
// 为什么用 Vite SSR 读 registry，而不是正则解析 meta.ts：
// meta 里有 SBAC 多行字符串与中文标点，正则一改就错位；
// ssrLoadModule 走的是页面同一套模块解析，拿到的就是真实数据结构。
// configFile: false 是为了不加载 unplugin-vue-components，
// 避免每次生成清单都去改写 src/components.d.ts。
//
// 用法：
//   npm run gen:cases           # 重新生成 CASES.md
//   npm run gen:cases -- --check # 只比对不写，文件过期时退出码 1（给 CI 用）
// ============================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

/** 仓库根目录 = 运行命令的目录（package.json scripts 都在根目录执行） */
const ROOT = process.cwd()
/** 生成目标 */
const OUTPUT_FILE = path.join(ROOT, 'CASES.md')
/** --check：只验证清单是否最新，不写文件 */
const CHECK_ONLY = process.argv.includes('--check')

/** 难度枚举 → 中文展示 */
const DIFFICULTY_LABEL = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
}

/**
 * 用 Vite 的 SSR 模块加载器读取注册表
 * 返回真实 allCases 与 categories，而不是解析源码文本。
 */
async function loadRegistry() {
  const server = await createServer({
    root: ROOT,
    // 不读 vite.config.ts：配置里的组件自动导入插件会改写 components.d.ts
    configFile: false,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })

  try {
    const registry = await server.ssrLoadModule('/src/examples/registry.ts')
    const categoriesModule = await server.ssrLoadModule('/src/examples/categories.ts')
    return {
      allCases: registry.allCases,
      categories: categoriesModule.categories,
    }
  } finally {
    // 关掉临时 dev server，避免进程挂住
    await server.close()
  }
}

/** 表格单元格转义：竖线会截断表格，换行会破坏行结构 */
function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

/**
 * 渲染整份 CASES.md
 * 输出必须稳定：分类按 categories.ts 顺序，案例沿用 registry 的排序（分类 + 案例 id）。
 */
function render(allCases, categories) {
  // 只统计真正有案例的分类，避免「声明了但还没案例」的分类虚报数字
  const usedCategories = categories.filter((category) =>
    allCases.some((item) => item.categoryId === category.id),
  )

  const lines = [
    '# 案例清单',
    '',
    '> 本文件由 `npm run gen:cases` 根据 `src/examples/registry.ts` 自动生成，请勿手动修改。',
    `> 共 ${allCases.length} 个案例 / ${usedCategories.length} 个分类。`,
    '',
  ]

  for (const category of usedCategories) {
    const items = allCases.filter((item) => item.categoryId === category.id)
    const rows = items.map((item) => {
      const { meta } = item
      const tags = meta.tags.map((tag) => `\`${tag}\``).join(' ')
      const difficulty = DIFFICULTY_LABEL[meta.difficulty] ?? meta.difficulty
      const link = `[${meta.id}](/cases/${category.id}/${meta.id})`
      return `| ${link} | ${escapeCell(meta.title)} | ${difficulty} | ${escapeCell(
        tags,
      )} | ${escapeCell(meta.summary)} |`
    })

    lines.push(`## ${category.name}（${category.id}）`, '')
    lines.push('| 案例 | 标题 | 难度 | 标签 | 摘要 |', '| --- | --- | --- | --- | --- |')
    lines.push(...rows, '')
  }

  return lines.join('\n')
}

/** 找出首个不同的行，方便 --check 报错时直接定位 */
function firstDiffLine(expected, actual) {
  const expectedLines = expected.split('\n')
  const actualLines = actual.split('\n')
  const max = Math.max(expectedLines.length, actualLines.length)
  for (let i = 0; i < max; i++) {
    if (expectedLines[i] === actualLines[i]) continue
    return {
      line: i + 1,
      expected: expectedLines[i] ?? '（文件结束）',
      actual: actualLines[i] ?? '（文件结束）',
    }
  }
  return null
}

const { allCases, categories } = await loadRegistry()
const nextContent = render(allCases, categories)

if (CHECK_ONLY) {
  // Windows 默认 core.autocrlf=true，checkout 会把仓库里的 LF 换成 CRLF；
  // 直接拿它和按 \n join 的内容比较会误报「第 1 行不一致」。
  // 比对前统一成 LF，保证各平台结论一致（生成时写出的仍是 LF）。
  const current = existsSync(OUTPUT_FILE)
    ? readFileSync(OUTPUT_FILE, 'utf8').replace(/\r\n/g, '\n')
    : ''

  if (current === nextContent) {
    console.log('[gen:cases] CASES.md 与注册表一致')
    process.exit(0)
  }

  const diff = firstDiffLine(nextContent, current)
  console.error('[gen:cases] CASES.md 已过期，请运行 npm run gen:cases')
  if (diff) {
    console.error(`  第 ${diff.line} 行`)
    console.error(`  实际：${diff.actual}`)
    console.error(`  应为：${diff.expected}`)
  }
  process.exit(1)
}

writeFileSync(OUTPUT_FILE, nextContent)
const categoryCount = new Set(allCases.map((item) => item.categoryId)).size
console.log(`[gen:cases] 已生成 CASES.md：${allCases.length} 个案例 / ${categoryCount} 个分类`)
