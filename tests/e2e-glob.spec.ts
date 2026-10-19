import { describe, it, expect } from 'vitest'
import { allCases, getCase } from '../src/examples/registry'

describe('真实 glob 收录验证', () => {
  it('allCases 包含 perf-observer', () => {
    const ids = allCases.map(c => `${c.categoryId}/${c.meta.id}`)
    console.log('收录的案例:', ids)
    expect(ids).toContain('performance/perf-observer')
  })

  it('getCase 可查找到案例', () => {
    const item = getCase('performance', 'perf-observer')
    expect(item).toBeDefined()
    expect(item?.codeTabs.length).toBeGreaterThan(0)
  })
})
