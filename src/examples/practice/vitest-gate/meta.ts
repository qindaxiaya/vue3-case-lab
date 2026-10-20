// ============================================================
// 案例元数据：测试门禁
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'vitest-gate',
  title: '测试门禁（CI）',
  difficulty: 'intermediate',
  tags: ['Vitest', 'CI', '类型检查', '覆盖率'],
  summary: '模拟 CI 依次跑单测/类型/Lint/构建/覆盖率，任一步失败即中断；附 workflow 配置示例',
  sell: '五道 CI 门禁串起来，失败即中断',
} satisfies CaseMeta
