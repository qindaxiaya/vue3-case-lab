// ============================================================
// 案例元数据：PerformanceObserver 性能监控面板
// default export 必须满足 CaseMeta（id 必须与目录名一致）
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'perf-observer',
  title: 'PerformanceObserver 性能监控面板',
  difficulty: 'advanced',
  tags: ['PerformanceObserver', 'LCP', 'CLS', 'INP'],
  summary: '用 PerformanceObserver 搭一个实时性能指标面板',
  notes: {
    usage: `## 适用场景

- **真实用户监控（RUM）**：把 FP/FCP/LCP/CLS 等指标上报到自家监控平台，量化线上性能
- **性能回归预警**：CI 或灰度阶段采集核心指标，超过阈值告警
- **开发期调试**：替代 Performance 面板的手动查看，实时观察代码改动对指标的影响

相比 \`performance.getEntriesByType()\` 一次性拉取，Observer 模式的优势是**实时推送**——后续产生的 entry 会持续回调，适合做动态面板。`,

    principle: `## 原理

**观察者模式 + buffered 回放**

\`observe({ type, buffered: true })\` 有两层含义：

1. \`type\` 指定要订阅的 entry 类型（paint / layout-shift / largest-contentful-paint…）
2. \`buffered: true\` 让浏览器**先回放**该类型在本次页面生命周期内已缓冲的历史 entry，再开始推送新 entry

所以组件一挂载就能立刻拿到 FP/FCP/TTFB（这些指标在页面加载早期就已产生），无需等待。

**各指标来源**

- FP/FCP：\`paint\` 类型，entry 的 \`name\` 区分（first-paint / first-contentful-paint），\`startTime\` 即时间戳
- LCP：\`largest-contentful-paint\` 类型，持续更新取最后一条；用户滚动/点击后冻结
- CLS：\`layout-shift\` 类型逐条累加 \`value\`，但必须跳过 \`hadRecentInput\` 为 true 的（规范要求排除近期输入引发的偏移）
- TTFB：\`navigation\` 类型的 \`responseStart\`（响应头到达时间）

**长任务**：\`longtask\` 类型推送超过 50ms 的主线程阻塞块，\`duration\` 为阻塞时长。`,

    caveats: `## 注意点

- **类型兼容**：\`longtask\`/\`event\` 等类型 Safari/Firefox 支持不全，\`observe({ type })\` 对不支持的 type 会抛 \`TypeError\`，必须 try/catch 降级，否则整个监控挂掉
- **CLS 不能直接看原始值**：需要排除 \`hadRecentInput\`；且真实 CLS 应按会话窗口（session window）分段取最大值，本例为演示简化为全量累加
- **INP 无法直接观察**：INP（Interaction to Next Paint）需要订阅 \`event\` 类型后自行按 interactionId 聚合计算各交互的 duration 分位数，不是单条 entry 能直接读出的，故本例不展示 INP
- **LCP 会变动**：页面渲染过程中 LCP 持续更新（取最新一条），最终在首次滚动/点击后冻结；上报通常在 \`visibilitychange\` 时进行
- **buffered 缓冲区有限**：浏览器只保留最近少量 entry，超早的事件可能已被丢弃`,
  },
} satisfies CaseMeta
