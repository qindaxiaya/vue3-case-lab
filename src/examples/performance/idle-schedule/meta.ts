// ============================================================
// 案例元数据：requestIdleCallback 空闲调度
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'idle-schedule',
  title: 'requestIdleCallback 空闲调度',
  difficulty: 'intermediate',
  tags: ['requestIdleCallback', '空闲调度', '分片'],
  summary: '同步阻塞 vs 空闲分片对比：timeRemaining 预算内干活，timeout 兜底防饿死',
  sell: '重活拆进空闲帧，预算内干活、超时兜底',
  explain: {
    situation:
      '页面打开后要预解析一堆数据、算统计，不着急但要花几百毫秒。你直接同步跑，用户点按钮没反应，以为页面卡死了。',
    background:
      '浏览器主线程既要渲染又要响应点击。requestIdleCallback 会在它空闲时叫你，并告诉你「这一小段还能用几毫秒」（timeRemaining）；timeout 则保证再忙也会在限定时间内轮到你，不会饿死。',
    action:
      '案例对比同步阻塞和空闲分片：每次只干预算内的活，剩余时间不足 2ms 就主动让出，下一段空闲再继续；还能看到任务进度和主线程响应。',
    conclusion:
      '记住：不着急的活拆进空闲帧，预算内干、超时兜底。真正的长列表渲染优先虚拟滚动，而不是靠空闲调度硬扛。',
  },
} satisfies CaseMeta
