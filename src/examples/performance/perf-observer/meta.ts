// ============================================================
// 案例元数据：PerformanceObserver 性能监控面板
// 2026-10-19 精简：说明文案区已移除，元数据只服务列表展示与搜索
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'perf-observer',
  title: 'PerformanceObserver 性能监控面板',
  difficulty: 'advanced',
  tags: ['PerformanceObserver', 'LCP', 'CLS', 'INP'],
  summary: '用性能观察器采集帧率、内存与加载体验指标，实时面板加可交互实验台',
  sell: '卡顿说不清来源：一张面板看帧率、内存与加载',
  explain: {
    situation:
      '用户反馈「页面有点卡」，你不知道卡在哪：是动画掉帧、内存涨了，还是点了半天才响应？打开开发者工具的性能面板又看不懂。',
    background:
      '浏览器会把性能数据以「条目」的形式暴露出来，PerformanceObserver 可以订阅你关心的类型：最大内容绘制、布局偏移、长任务等。帧率可以用逐帧回调数出来：一秒内回调了多少次，就是多少帧。',
    action:
      '案例创建 PerformanceObserver 订阅关键指标，buffered 为真时连页面加载初期的历史数据一起回放；帧率用逐帧回调统计，每秒结算一次；内存读 performance.memory（只有部分浏览器支持）。面板按「实时 / 加载期」分组，能现场制造长任务和布局偏移，也能一键重置实验数据；偏移块最多保留 5 个。',
    conclusion:
      '记住：卡顿先看长任务和帧率，加载看最大内容绘制，乱跳看布局偏移。真实项目要把这些指标上报到监控平台，不能只看开发机。',
  },
} satisfies CaseMeta
