// 临时文件：用于验证规则集会拦截红灯 PR，验证完立即删除
import { describe, expect, it } from 'vitest'

describe('规则集红灯验证', () => {
  it('故意失败，确认 CI 红灯时无法合并', () => {
    expect(1).toBe(2)
  })
})
