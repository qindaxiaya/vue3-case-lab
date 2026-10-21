// ============================================================
// 浏览记录 / 收藏纯逻辑单元测试
// 只测不碰 DOM 的部分（列表去重、上限、切换、键解析）
// ============================================================
import { describe, expect, it } from 'vitest'
import {
  caseKey,
  parseCaseKey,
  pushRecent,
  RECENT_LIMIT,
  toggleFavorite,
} from '../src/composables/useCaseHistory'

describe('caseKey / parseCaseKey', () => {
  it('拼接后能原样拆回分类与案例', () => {
    const key = caseKey('performance', 'raf-loop')
    expect(key).toBe('performance/raf-loop')
    expect(parseCaseKey(key)).toEqual(['performance', 'raf-loop'])
  })

  it('缺少分段时返回 null', () => {
    expect(parseCaseKey('only-category')).toBeNull()
    expect(parseCaseKey('')).toBeNull()
  })
})

describe('pushRecent', () => {
  it('新案例插到最前面', () => {
    expect(pushRecent(['a/b'], 'c/d')).toEqual(['c/d', 'a/b'])
  })

  it('重复打开只提升位置，不产生重复项', () => {
    expect(pushRecent(['a/b', 'c/d', 'e/f'], 'c/d')).toEqual([
      'c/d',
      'a/b',
      'e/f',
    ])
  })

  it('超过上限时丢掉最旧的一条', () => {
    const list = Array.from({ length: RECENT_LIMIT }, (_, i) => `c/${i}`)
    const next = pushRecent(list, 'c/new')

    expect(next).toHaveLength(RECENT_LIMIT)
    expect(next[0]).toBe('c/new')
    // 最旧的一条被挤出
    expect(next).not.toContain(`c/${RECENT_LIMIT - 1}`)
  })

  it('不修改入参数组', () => {
    const list = ['a/b']
    pushRecent(list, 'c/d')
    expect(list).toEqual(['a/b'])
  })
})

describe('toggleFavorite', () => {
  it('未收藏时加入，已收藏时移除', () => {
    expect(toggleFavorite([], 'a/b')).toEqual(['a/b'])
    expect(toggleFavorite(['a/b', 'c/d'], 'a/b')).toEqual(['c/d'])
  })

  it('不修改入参数组', () => {
    const list = ['a/b']
    toggleFavorite(list, 'a/b')
    expect(list).toEqual(['a/b'])
  })
})
