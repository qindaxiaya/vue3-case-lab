// ============================================================
// 案例元数据：异步组件加载与重试
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'async-suspense',
  title: '异步组件加载与重试',
  difficulty: 'intermediate',
  tags: ['defineAsyncComponent', '代码分割', 'Suspense'],
  summary: 'loader/delay/timeout/loading/error 配置全家桶，失败换 key 重试的标准姿势',
  sell: '异步组件全家桶，加载、超时、错误、重试',
  explain: {
    situation:
      '路由懒加载的组件，网慢时页面一片空白；加载失败只在控制台报错，用户完全不知道发生了什么。',
    background:
      'defineAsyncComponent 可以配置 loading 组件、超时、错误组件和延迟；Suspense 则统一处理「等待中」的占位。加载失败没有内置 retry API，社区做法是换 key 重建组件，让它重新走一遍 loader。',
    action:
      '案例演示 loader / delay / timeout / loading / error 全家桶，失败后点「重试」用 key 强制重建，成功和失败状态都清清楚楚。',
    conclusion:
      '记住：异步组件必须配 loading 和 error，别让用户看白屏；重试用换 key。Suspense 目前仍标 experimental，生产慎用。',
  },
} satisfies CaseMeta
