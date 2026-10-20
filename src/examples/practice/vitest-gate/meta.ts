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
  explain: {
    situation:
      '本地测试全绿，合并到主干却挂了；覆盖率掉到 30% 也没人发现，上线全靠运气。',
    background:
      'CI 门禁就是每次提交自动跑一遍和本地一样的命令，任何一步失败就中断。光有流水线还不够，要在仓库设置里把它设成 required check，红灯才真的合不进去。',
    action:
      '案例模拟 CI 依次跑单测 → 类型检查 → Lint → 构建 → 覆盖率，任一步失败立即中断；可以手动注入失败看红灯效果，附 workflow 配置示例。',
    conclusion:
      '记住：本地命令和 CI 命令必须完全一致；覆盖率低于阈值就失败，只统计 src 业务代码。别让门禁「只是建议」。',
  },
} satisfies CaseMeta
