// ============================================================
// 注册表纯逻辑单元测试（TDD 红灯先行）
// 覆盖：resolveCodeLang 文件名→语言映射、filterCases 搜索过滤
// 注：用内联构造数据，不依赖 import.meta.glob
// ============================================================
import { describe, it, expect } from 'vitest'
import { resolveCodeLang, filterCases } from '../src/examples/registry'
import type { RegisteredCase } from '../src/examples/registry'

/** 构造最小可用的 RegisteredCase 测试夹具 */
function makeCase(
  overrides: Partial<RegisteredCase> & { meta: RegisteredCase['meta'] },
): RegisteredCase {
  return {
    categoryId: 'performance',
    demoComponent: {} as RegisteredCase['demoComponent'],
    demoSource: '<template><div /></template>',
    codeTabs: [],
    ...overrides,
  }
}

/** 快捷构造 meta */
function makeMeta(
  overrides: Partial<RegisteredCase['meta']> = {},
): RegisteredCase['meta'] {
  return {
    id: 'demo-case',
    title: '演示案例',
    difficulty: 'beginner',
    tags: ['Demo'],
    summary: '这是一个演示摘要',
    notes: { usage: '', principle: '', caveats: '' },
    ...overrides,
  }
}

describe('resolveCodeLang — 从文件名推断代码语言', () => {
  it('usage.vue.txt → vue', () => {
    expect(resolveCodeLang('usage.vue.txt')).toBe('vue')
  })

  it('composable.ts.txt → typescript', () => {
    expect(resolveCodeLang('composable.ts.txt')).toBe('typescript')
  })

  it('snippet.js.txt → javascript', () => {
    expect(resolveCodeLang('snippet.js.txt')).toBe('javascript')
  })

  it('style.css.txt → css', () => {
    expect(resolveCodeLang('style.css.txt')).toBe('css')
  })

  it('data.json.txt → json', () => {
    expect(resolveCodeLang('data.json.txt')).toBe('json')
  })

  it('未知扩展名回退为纯文本', () => {
    expect(resolveCodeLang('readme.md.txt')).toBe('plaintext')
  })
})

describe('filterCases — 搜索过滤（大小写不敏感子串匹配）', () => {
  const cases: RegisteredCase[] = [
    makeCase({
      meta: makeMeta({
        id: 'perf-observer',
        title: 'PerformanceObserver 面板',
        tags: ['LCP', 'CLS'],
        summary: '实时性能指标监控',
      }),
    }),
    makeCase({
      meta: makeMeta({
        id: 'watch-traps',
        title: 'watch 陷阱',
        tags: ['watch', 'watchEffect'],
        summary: '深度侦听与副作用清理',
      }),
    }),
  ]

  it('空字符串返回全部案例', () => {
    expect(filterCases(cases, '')).toHaveLength(2)
    expect(filterCases(cases, '   ')).toHaveLength(2) // 纯空白视为空
  })

  it('按标题匹配（大小写不敏感）', () => {
    const result = filterCases(cases, 'performance')
    expect(result).toHaveLength(1)
    expect(result[0].meta.id).toBe('perf-observer')
  })

  it('按标签匹配', () => {
    const result = filterCases(cases, 'CLS')
    expect(result).toHaveLength(1)
    expect(result[0].meta.id).toBe('perf-observer')
  })

  it('按摘要中文匹配', () => {
    const result = filterCases(cases, '副作用')
    expect(result).toHaveLength(1)
    expect(result[0].meta.id).toBe('watch-traps')
  })

  it('无命中返回空数组', () => {
    expect(filterCases(cases, '不存在的关键词')).toHaveLength(0)
  })
})
