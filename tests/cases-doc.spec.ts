// ============================================================
// CASES.md 一致性门禁
// CASES.md 是对外索引，由 `npm run gen:cases` 从真实注册表生成。
// 这里校验它没有被手改跑偏：
// - 案例链接集合与 registry 完全一致（多、少、重复都报错）
// - 每行标题与 meta.title 一致
// - 文首总数与真实数量一致
// - 分类与案例顺序和 categories / registry 一致
// 新增 / 删除案例后忘了重新生成，CI 会直接红灯。
// ============================================================
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { allCases } from '../src/examples/registry'
import { categories } from '../src/examples/categories'

/** 仓库根目录（按测试文件位置推导，避免依赖启动目录） */
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
/** 清单文件 */
const DOC_FILE = path.join(REPO_ROOT, 'CASES.md')

/** 清单里的一行案例记录 */
interface DocRow {
  categoryId: string
  caseId: string
  title: string
}

/** 读取 CASES.md；文件不存在返回空串（由用例给出可读报错） */
const doc = existsSync(DOC_FILE) ? readFileSync(DOC_FILE, 'utf8') : ''

/** 统一用「分类/案例」作为比较键 */
const caseKey = (categoryId: string, caseId: string): string => `${categoryId}/${caseId}`

/**
 * 解析表格行：| [案例id](/cases/<分类>/<案例>) | 标题 | 难度 | 标签 | 摘要 |
 * 只取链接与紧随其后的标题单元格。
 */
function parseRows(text: string): DocRow[] {
  const rows: DocRow[] = []
  // 逐行匹配，避免跨行误吞；标题里的竖线以 \| 转义，需一并放行
  const rowPattern =
    /^\|\s*\[[^\]]*\]\(\/cases\/([^/)]+)\/([^/)]+)\)\s*\|\s*((?:\\\||[^|])*?)\s*\|/gm
  for (const match of text.matchAll(rowPattern)) {
    rows.push({
      categoryId: match[1],
      caseId: match[2],
      // 还原表格转义，才能与 meta.title 直接比较
      title: match[3].trim().replace(/\\\|/g, '|'),
    })
  }
  return rows
}

/** 解析分类小标题：## CSS 技巧（css） */
function parseCategoryOrder(text: string): string[] {
  const ids: string[] = []
  const headingPattern = /^##\s+.+?（([a-z0-9]+)）\s*$/gm
  for (const match of text.matchAll(headingPattern)) ids.push(match[1])
  return ids
}

/** 文首声明的总数 */
function parseTotals(text: string): { cases: number; categories: number } | null {
  const match = text.match(/共\s*(\d+)\s*个案例\s*[/／]\s*(\d+)\s*个分类/)
  if (!match) return null
  return { cases: Number(match[1]), categories: Number(match[2]) }
}

describe('CASES.md 案例清单', () => {
  it('文件存在', () => {
    expect(existsSync(DOC_FILE), '缺少 CASES.md，请运行 npm run gen:cases 生成').toBe(true)
  })

  it('案例链接集合与注册表完全一致（不多、不少、不重复）', () => {
    const rows = parseRows(doc)
    const expected = allCases.map((item) => caseKey(item.categoryId, item.meta.id))
    const actual = rows.map((row) => caseKey(row.categoryId, row.caseId))

    // 先查重复：重复会让下面的集合比较失真
    const seen = new Set<string>()
    const duplicates = actual.filter((key) => {
      if (seen.has(key)) return true
      seen.add(key)
      return false
    })
    expect(duplicates, `CASES.md 存在重复案例：${duplicates.join('、')}`).toEqual([])

    const actualSet = new Set(actual)
    const expectedSet = new Set(expected)
    const missing = expected.filter((key) => !actualSet.has(key))
    const extra = actual.filter((key) => !expectedSet.has(key))

    expect(missing, `CASES.md 缺少案例：${missing.join('、')}`).toEqual([])
    expect(extra, `CASES.md 多出案例：${extra.join('、')}`).toEqual([])
  })

  it('每行标题与 meta.title 一致', () => {
    const titleMap = new Map(
      allCases.map((item) => [
        caseKey(item.categoryId, item.meta.id),
        item.meta.title,
      ]),
    )

    for (const row of parseRows(doc)) {
      const key = caseKey(row.categoryId, row.caseId)
      const expectedTitle = titleMap.get(key)
      if (!expectedTitle) continue // 多出来的行由上一个用例报错
      expect(row.title, `${key} 的标题与 meta.title 不一致`).toBe(expectedTitle)
    }
  })

  it('文首总数与真实数量一致', () => {
    const totals = parseTotals(doc)
    expect(totals, 'CASES.md 文首缺少「共 N 个案例 / M 个分类」').not.toBeNull()

    const categoryCount = new Set(allCases.map((item) => item.categoryId)).size
    expect(totals?.cases, '案例总数不一致').toBe(allCases.length)
    expect(totals?.categories, '分类总数不一致').toBe(categoryCount)
  })

  it('分类顺序与案例顺序和 registry 一致', () => {
    const usedCategoryIds = categories
      .map((category) => category.id)
      .filter((id) => allCases.some((item) => item.categoryId === id))

    expect(parseCategoryOrder(doc), '分类小标题顺序与 categories.ts 不一致').toEqual(
      usedCategoryIds,
    )

    const expectedOrder = allCases.map((item) => caseKey(item.categoryId, item.meta.id))
    const actualOrder = parseRows(doc).map((row) => caseKey(row.categoryId, row.caseId))
    expect(actualOrder, '案例顺序与 registry 不一致，请重新生成').toEqual(expectedOrder)
  })
})
