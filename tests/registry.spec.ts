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
    codeFileCount: 0,
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

// ============================================================
// 真实 glob 集成测试
// 这组测试是「案例自动收录链路」的回归防线：
// import.meta.glob → parseIdsFromPath → allCases → getCase → 懒加载 loader
// 曾因 glob key 格式（'./x/y/' 而非 '../examples/x/y/'）解析错误
// 导致全部案例被静默跳过、侧边栏空白——本组测试防止复发。
// 每新增一个案例目录，此链路测试自动扩展验证（allCases 增量）。
// ============================================================
import {
  allCases,
  getCase,
  loadCaseSource,
  loadDemoComponent,
} from '../src/examples/registry'

describe('真实 glob 收录链路（集成）', () => {
  it('allCases 非空（glob 至少收录了已存在的案例）', () => {
    // 此断言失败 = glob 路径或 parseIdsFromPath 再次出错
    expect(allCases.length).toBeGreaterThan(0)
  })

  it('perf-observer 的元数据同步可得（列表/搜索不等待网络）', () => {
    const item = getCase('performance', 'perf-observer')
    expect(item, 'getCase 应找到 perf-observer').toBeDefined()
    expect(item!.meta.title.length).toBeGreaterThan(0)
    // 片段数量来自构建期 glob key 统计，不含正文
    expect(item!.codeFileCount).toBeGreaterThan(0)
  })

  // 这一条要现编译一个 SFC + 把 naive-ui 的按需组件一起拉进来，机器忙（同时在跑 build / dev）时
  // 默认 5s 会偶发超时；给足 20s，避免假红灯
  it('演示组件按需加载成功', { timeout: 20_000 }, async () => {
    const component = await loadDemoComponent('performance', 'perf-observer')
    // Vue SFC 编译后的组件对象非空
    expect(component).toBeTruthy()
  })

  it('源码包按需加载（Demo 全文 + 教学代码齐全）', async () => {
    const item = getCase('performance', 'perf-observer')
    const bundle = await loadCaseSource('performance', 'perf-observer')

    // Demo.vue 完整源码含核心 API
    expect(bundle.demoSource).toContain('PerformanceObserver')
    // 片段数量与构建期统计一致，且带语言标记 + 正文
    expect(bundle.codeTabs.length).toBe(item!.codeFileCount)
    expect(bundle.codeTabs[0].lang).toBe('typescript')
    expect(bundle.codeTabs[0].content.length).toBeGreaterThan(0)
  })

  it('raf-loop 的源码包可加载（rAF 调用在 Demo 全文里）', async () => {
    const bundle = await loadCaseSource('performance', 'raf-loop')
    expect(bundle.demoSource).toContain('requestAnimationFrame')
    expect(bundle.codeTabs.length).toBeGreaterThan(0)
  })

  it('重复加载复用缓存（并发调用拿到同一个结果对象）', async () => {
    const [a, b] = await Promise.all([
      loadCaseSource('performance', 'idle-schedule'),
      loadCaseSource('performance', 'idle-schedule'),
    ])
    expect(a).toBe(b)
  })

  it('不存在的案例加载时明确报错（不会静默返回空）', async () => {
    await expect(loadDemoComponent('performance', 'not-exist')).rejects.toThrow(
      '不存在',
    )
    await expect(loadCaseSource('performance', 'not-exist')).rejects.toThrow(
      '不存在',
    )
  })

  it('收录案例的 meta.id 与目录名全部一致（防止路由错乱）', () => {
    for (const item of allCases) {
      expect(item.meta.id, `${item.categoryId} 下 id 不匹配`).toMatch(
        /^[a-z0-9-]+$/,
      )
      // meta.id 必须能在 getCase 中按 categoryId+id 查回（自洽性）
      expect(getCase(item.categoryId, item.meta.id)).toBe(item)
    }
  })

  it('每个案例都有代码片段与源码加载入口', () => {
    for (const item of allCases) {
      const name = `${item.categoryId}/${item.meta.id}`
      // 0 个片段的案例会在源码区只剩 demo 源码，视为内容缺失
      expect(item.codeFileCount, `${name} 没有 code/*.txt`).toBeGreaterThan(0)
    }
  })
})
