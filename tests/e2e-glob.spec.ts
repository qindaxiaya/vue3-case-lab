import { describe, it, expect } from 'vitest'
import {
  allCases,
  getCase,
  loadCaseSource,
} from '../src/examples/registry'

describe('真实 glob 收录验证', () => {
  it('allCases 包含 perf-observer', () => {
    const ids = allCases.map(c => `${c.categoryId}/${c.meta.id}`)
    console.log('收录的案例:', ids)
    expect(ids).toContain('performance/perf-observer')
  })

  it('getCase 可查找到案例，源码可按需加载', async () => {
    const item = getCase('performance', 'perf-observer')
    expect(item).toBeDefined()
    // meta 同步可得；源码文本走懒加载
    expect(item?.codeFileCount).toBeGreaterThan(0)

    const bundle = await loadCaseSource('performance', 'perf-observer')
    expect(bundle.codeTabs.length).toBe(item?.codeFileCount)
    expect(bundle.demoSource.length).toBeGreaterThan(0)
  })
})
