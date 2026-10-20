// ============================================================
// 内容质量门禁
// - meta.explain 四段齐全（场景 / 背景 / 做法 / 结论）
// - 卖点与摘要长度受控，且不含未解释的技术缩写（面向新手）
// - notes.md 五段齐全（私人资料，不参与页面渲染，但要求可追溯）
// 新增案例自动纳入校验，不需要单独注册。
// ============================================================
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { allCases, filterCases } from '../src/examples/registry'

/** src/examples 的绝对路径（按测试文件位置推导，避免依赖启动目录） */
const EXAMPLES_DIR = fileURLToPath(new URL('../src/examples', import.meta.url))

/**
 * 说明区禁止出现的未解释缩写
 * 只查这些「中文读者未必认识」的缩写；Vue API 名、文件名、单位不在此列
 */
const ABBR = /\b(SSE|rAF|DOM|FPS|LCP|CLS|WAAPI|LRU|IO|MIME|SHA-256|XHR|FLIP|CI)\b/

describe('案例内容质量', () => {
  it('每个案例都有完整的 SBAC 四段说明', () => {
    for (const item of allCases) {
      const name = `${item.categoryId}/${item.meta.id}`
      const explain = item.meta.explain

      expect(explain, `${name} 缺少 explain`).toBeDefined()

      // 四段都必须是非空的成句说明，避免「有字段没内容」蒙混过关
      const blocks = {
        场景: explain?.situation ?? '',
        背景: explain?.background ?? '',
        做法: explain?.action ?? '',
        结论: explain?.conclusion ?? '',
      }
      for (const [label, text] of Object.entries(blocks)) {
        expect(text.trim().length, `${name} 的「${label}」过短`).toBeGreaterThan(15)
      }
    }
  })

  it('卖点不超过 30 字，摘要不超过 40 字', () => {
    for (const item of allCases) {
      const name = `${item.categoryId}/${item.meta.id}`
      expect(item.meta.sell.trim(), `${name} 缺少 sell`).not.toBe('')
      expect(item.meta.sell.length, `${name} 的 sell 过长`).toBeLessThanOrEqual(30)
      expect(item.meta.summary.length, `${name} 的 summary 过长`).toBeLessThanOrEqual(40)
    }
  })

  it('说明区不使用未解释的技术缩写', () => {
    for (const item of allCases) {
      const name = `${item.categoryId}/${item.meta.id}`
      const texts = [
        item.meta.summary,
        item.meta.sell,
        item.meta.explain?.situation ?? '',
        item.meta.explain?.background ?? '',
        item.meta.explain?.action ?? '',
        item.meta.explain?.conclusion ?? '',
      ]
      for (const text of texts) {
        const hit = text.match(ABBR)
        expect(hit, `${name} 含未解释缩写「${hit?.[0] ?? ''}」: ${text}`).toBeNull()
      }
    }
  })

  it('每个案例的标题都能被搜索命中', () => {
    for (const item of allCases) {
      const name = `${item.categoryId}/${item.meta.id}`
      const hits = filterCases(allCases, item.meta.title)
      const self = hits.some(
        (h) => h.categoryId === item.categoryId && h.meta.id === item.meta.id,
      )
      expect(self, `${name} 用标题搜索不到自己`).toBe(true)
    }
  })

  it('每个案例的 notes.md 五段齐全', () => {
    for (const item of allCases) {
      const name = `${item.categoryId}/${item.meta.id}`
      const file = path.join(EXAMPLES_DIR, item.categoryId, item.meta.id, 'notes.md')

      expect(existsSync(file), `${name} 缺少 notes.md`).toBe(true)

      const content = readFileSync(file, 'utf8')
      for (let i = 1; i <= 5; i++) {
        expect(content, `${name} 的 notes.md 缺少第 ${i} 段`).toContain(`## ${i}.`)
      }
    }
  })
})
