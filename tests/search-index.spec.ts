// ============================================================
// 正文字索引纯逻辑单元测试（TDD 红灯先行）
// 覆盖：Markdown 去标记 → 建文档 → 片段截取 → 正文检索排序 →
//       关键词高亮切分 → 元数据结果与正文结果合并
// 注意：全部用内联数据，不依赖 import.meta.glob 与浏览器环境
// ============================================================
import { describe, expect, it } from 'vitest'
import {
  buildNotesDoc,
  findSnippet,
  highlightParts,
  mergeSearchHits,
  searchNotes,
  toPlainText,
} from '../src/utils/search-index'

/** 一段带各种 Markdown 标记的示例正文 */
const SAMPLE = [
  '# 长动画帧',
  '',
  '## 1. 现象与场景',
  '',
  '滚动时**明显掉帧**，但 `PerformanceObserver` 只告诉你「多慢」。',
  '',
  '- 列表项 1',
  '- 列表项 2',
  '',
  '> 引用：长动画帧（LoAF）能定位到具体脚本。',
  '',
  '```ts',
  'const observer = new PerformanceObserver(callback)',
  '```',
  '',
  '| 指标 | 含义 |',
  '| --- | --- |',
  '| 长帧数 | 超过 50ms 的帧 |',
  '',
  '参考 [MDN 文档](https://example.com/loaf) 与 ![示意图](https://example.com/a.png)。',
].join('\n')

describe('toPlainText：去掉 Markdown 标记但保留内容', () => {
  it('标题、粗体、行内代码的标记被移除，文字保留', () => {
    const text = toPlainText(SAMPLE)

    expect(text).toContain('长动画帧')
    expect(text).toContain('明显掉帧')
    expect(text).toContain('PerformanceObserver')
    // 标记本身不应出现在纯文本里
    expect(text).not.toContain('#')
    expect(text).not.toContain('**')
    expect(text).not.toContain('`')
  })

  it('列表、引用、表格、链接、图片、代码围栏都变成可读文本', () => {
    const text = toPlainText(SAMPLE)

    expect(text).toContain('列表项 1')
    expect(text).toContain('引用：长动画帧')
    expect(text).toContain('长帧数')
    expect(text).toContain('MDN 文档')
    expect(text).toContain('示意图')
    // 代码块内容仍可被搜索到（很多 API 名只出现在代码里）
    expect(text).toContain('new PerformanceObserver(callback)')
    // 围栏与分隔行不应留下
    expect(text).not.toContain('```')
    expect(text).not.toMatch(/^\s*\|?\s*-{3,}/m)
  })

  it('正文中的换行被保留，便于截取片段', () => {
    expect(toPlainText(SAMPLE)).toContain('\n')
  })
})

describe('buildNotesDoc：建索引文档', () => {
  it('同时保留原文与用于匹配的小写文本', () => {
    const doc = buildNotesDoc('performance', 'loaf', SAMPLE)

    expect(doc.categoryId).toBe('performance')
    expect(doc.caseId).toBe('loaf')
    // 原文保留大小写，片段按原文展示
    expect(doc.plain).toContain('PerformanceObserver')
    // 匹配用文本统一小写
    expect(doc.haystack).toBe(doc.plain.toLowerCase())
  })
})

describe('findSnippet：截取命中前后文', () => {
  const doc = buildNotesDoc('performance', 'loaf', SAMPLE)

  it('大小写不敏感，且返回原文大小写', () => {
    const snippet = findSnippet(doc, 'performanceobserver')

    expect(snippet).not.toBeNull()
    expect(snippet).toContain('PerformanceObserver')
  })

  it('未命中返回 null', () => {
    expect(findSnippet(doc, '不存在的关键词')).toBeNull()
    expect(findSnippet(doc, '   ')).toBeNull()
  })

  it('命中在正文中间时前后都加省略号，并把换行压成空格', () => {
    const snippet = findSnippet(doc, '长帧数', 4)

    expect(snippet?.startsWith('…')).toBe(true)
    expect(snippet?.endsWith('…')).toBe(true)
    expect(snippet).not.toContain('\n')
    // 片段要比全文短得多
    expect(snippet!.length).toBeLessThan(60)
  })

  it('命中在开头时不加前省略号', () => {
    const snippet = findSnippet(doc, '长动画帧', 8)

    expect(snippet?.startsWith('…')).toBe(false)
    expect(snippet).toContain('长动画帧')
  })
})

describe('searchNotes：正文检索', () => {
  const docs = [
    // a：命中 1 次
    buildNotesDoc('vue3', 'watch', '# watch\n\nwatch 的 flush 时机。'),
    // b：命中 3 次，应排在前面
    buildNotesDoc(
      'vue3',
      'watch-traps',
      '# watch 陷阱\n\nwatch 深度侦听。\n\nwatchEffect 与 watch 的区别。',
    ),
    // c：不命中
    buildNotesDoc('css', 'grid', '# 网格\n\nauto-fit 自适应。'),
  ]

  it('只返回命中的案例，并按命中次数从多到少排序', () => {
    const hits = searchNotes(docs, 'watch')

    expect(hits.map((h) => h.caseId)).toEqual(['watch-traps', 'watch'])
    expect(hits[0]?.count).toBeGreaterThan(hits[1]?.count ?? 0)
    expect(hits[0]?.snippet.toLowerCase()).toContain('watch')
  })

  it('空查询返回空数组', () => {
    expect(searchNotes(docs, '   ')).toEqual([])
  })

  it('支持 limit 截断', () => {
    expect(searchNotes(docs, 'watch', 1)).toHaveLength(1)
  })
})

describe('highlightParts：关键词切分用于高亮', () => {
  it('按命中位置切成 hit / 非 hit 片段，保留原文大小写', () => {
    const parts = highlightParts('用 watch 监听，watchEffect 也会跑', 'WATCH')

    expect(parts.map((p) => p.text).join('')).toBe('用 watch 监听，watchEffect 也会跑')
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual([
      'watch',
      'watch',
    ])
  })

  it('空查询与未命中都返回单个非高亮片段', () => {
    expect(highlightParts('abc', '')).toEqual([{ text: 'abc', hit: false }])
    expect(highlightParts('abc', 'zzz')).toEqual([{ text: 'abc', hit: false }])
  })
})

describe('mergeSearchHits：元数据结果与正文结果合并', () => {
  const metaCases = [
    { categoryId: 'vue3', meta: { id: 'watch' } },
    { categoryId: 'vue3', meta: { id: 'watch-traps' } },
  ]

  it('元数据命中排前面，正文独有结果追加在后并标记来源', () => {
    const merged = mergeSearchHits(metaCases, [
      { categoryId: 'vue3', caseId: 'watch-traps', snippet: '深度侦听', count: 2 },
      { categoryId: 'performance', caseId: 'loaf', snippet: '长动画帧', count: 1 },
    ])

    expect(merged.map((r) => r.caseId)).toEqual(['watch', 'watch-traps', 'loaf'])
    // 已在元数据里的案例：正文片段补上，但不重复出现
    expect(merged[1]).toMatchObject({ snippet: '深度侦听', viaNotes: true })
    // 仅正文命中的案例
    expect(merged[2]).toMatchObject({ viaNotes: true, snippet: '长动画帧' })
  })

  it('元数据命中但没有正文片段时 viaNotes 为 false', () => {
    const merged = mergeSearchHits(metaCases, [])

    expect(merged[0]).toMatchObject({ caseId: 'watch', viaNotes: false, snippet: '' })
  })

  it('支持 limit 截断', () => {
    expect(mergeSearchHits(metaCases, [], 1)).toHaveLength(1)
  })
})
