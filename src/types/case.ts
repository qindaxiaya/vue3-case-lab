// ============================================================
// 案例元数据类型定义（全站核心契约）
// Task 2 注册表、Task 4 案例页均依赖此类型
// 2026-10-19 二次精简：说明文案区已移除（用户拍板），元数据只服务展示与搜索
// ============================================================

/** 难度等级：入门 / 进阶 / 高级 */
export type CaseDifficulty = 'beginner' | 'intermediate' | 'advanced'

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
}
