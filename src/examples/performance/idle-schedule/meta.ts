// ============================================================
// 案例元数据：requestIdleCallback 空闲调度
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'idle-schedule',
  title: 'requestIdleCallback 空闲调度',
  difficulty: 'intermediate',
  tags: ['requestIdleCallback', '空闲调度', '分片'],
  summary: '把重活拆进浏览器空闲时段，剩余时间预算内执行，超时兜底避免任务饿死',
  sell: '重活卡住交互：拆进空闲帧，预算内做、超时让路',
  explain: {
    situation:
      '页面打开后要预解析一批数据、算统计，不着急但要花几百毫秒。你直接同步跑，用户点按钮没反应，以为页面卡死了。',
    background:
      '浏览器的主线程既要画页面又要响应点击。requestIdleCallback 会在浏览器空闲时叫你，并告诉你「这一小段还能用几毫秒」；timeout 参数保证再忙也会在限定时间内轮到你，不会一直排不上队。',
    action:
      '案例对比两种做法：同步一次跑完，和每次只干一小段。代码里每次进入回调先看 timeRemaining() 还剩多少时间，剩余不足 2 毫秒就主动停下，用 requestIdleCallback 预约下一次继续；如果回调参数 didTimeout 为真，说明是超时兜底触发，不是真空闲。组件卸载时 cancelIdleCallback。',
    conclusion:
      '记住：不着急的活拆进空闲时间，预算内干、超时兜底。真正的长列表渲染优先虚拟滚动，而不是靠空闲调度硬扛。',
  },
} satisfies CaseMeta
