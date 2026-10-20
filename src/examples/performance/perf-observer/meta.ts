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
  summary: '实时性能指标面板：FPS/内存流动 + Core Web Vitals + 交互实验台',
  sell: '一张面板看清 FPS、内存与 Core Web Vitals',
  explain: {
    situation:
      '用户反馈「页面有点卡」，你不知道卡在哪：是动画掉帧、内存涨了，还是点了半天才响应？打开 DevTools 的 Performance 面板又看不懂。',
    background:
      '浏览器会把性能数据以「条目」的形式暴露出来：PerformanceObserver 可以订阅 LCP（最大内容绘制）、CLS（布局偏移）、longtask（长任务）等；再用 requestAnimationFrame 数每秒帧数，就能拼出一张实时面板。',
    action:
      '案例做一个实时监控面板：FPS 曲线、内存占用、Core Web Vitals，还能现场制造长任务/布局偏移，观察指标怎么变，并讲清 CLS 为什么要跳过「用户输入引起的偏移」。',
    conclusion:
      '记住：卡顿先看长任务和 FPS，加载看 LCP，乱跳看 CLS。真实项目把这些指标上报到监控平台（RUM），别只看开发机。',
  },
} satisfies CaseMeta
