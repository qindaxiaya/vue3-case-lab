// ============================================================
// 案例元数据类型定义（全站核心契约）
// Task 2 注册表、Task 4 案例页均依赖此类型
// 2026-10-19 二次精简：说明文案区已移除（用户拍板），元数据只服务展示与搜索
// 2026-10-20 新增 sell：20 秒口述卖点，完成标准见 docs/case-definition-of-done.md
// ============================================================

/** 难度等级：入门 / 进阶 / 高级 */
export type CaseDifficulty = 'beginner' | 'intermediate' | 'advanced'

/** 案例说明（SBAC：场景 / 背景 / 做法 / 结论），面向刚入门的前端 */
export interface CaseExplain {
  /** Situation：新手真实会遇到的场景（口语化，先让人有共鸣） */
  situation: string
  /** Background：为什么会这样，把原理讲成大白话 */
  background: string
  /** Action：这个案例具体怎么做（可含 1/2/3 步） */
  action: string
  /** Conclusion：记住一句话 + 什么时候该用它 */
  conclusion: string
}

/** 案例元数据（每个案例目录的 meta.ts default export） */
export interface CaseMeta {
  /** 案例 id，必须与目录名一致（注册表校验） */
  id: string
  /** 标题（展示与搜索用） */
  title: string
  /** 难度等级 */
  difficulty: CaseDifficulty
  /** 标签（搜索匹配字段之一） */
  tags: string[]
  /** 一句话摘要（搜索匹配字段之一） */
  summary: string
  /** 20 秒口述卖点（≤30 字）：解决什么问题 + 为什么选它 */
  sell: string
  /** SBAC 说明（可选：未补齐时页面回退到重点行摘要） */
  explain?: CaseExplain
}
