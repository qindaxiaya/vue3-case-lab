// ============================================================
// 案例元数据：PerformanceObserver 性能监控面板
// notes 约定（2026-10-19 用户反馈「太长没兴趣看」）：
//   每段压到 3 行内，只留速查要点；重点用 callout 标出
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'perf-observer',
  title: 'PerformanceObserver 性能监控面板',
  difficulty: 'advanced',
  tags: ['PerformanceObserver', 'LCP', 'CLS', 'INP'],
  summary: '实时性能指标面板：FPS/内存流动 + Core Web Vitals + 交互实验台',
  notes: {
    usage: `## 适用场景

- 线上 RUM 上报核心指标（FP/FCP/LCP/CLS/INP），量化真实用户性能
- 开发期实时盯指标变化——本面板即是此用法，滑块一键制造卡顿/偏移`,

    principle: `## 原理

- \`observe({ type, buffered: true })\` 先回放历史 entry，再持续推送新 entry——一挂载就有早期指标
- FP/FCP 取 \`paint\`；LCP 取每批最后一条；CLS 累加 \`layout-shift.value\`（跳过 \`hadRecentInput\`）
- 交互延迟取 \`event\` 的 \`duration\`；FPS 用 rAF 逐帧计数、整秒窗口结算`,

    caveats: `## 注意点

> [!WARNING] \`observe\` 对不支持的 type 会抛 \`TypeError\`——注册必须 try/catch，否则整个面板挂掉

- CLS 是累计值，线上应按会话窗口取最大；\`performance.memory\` 仅 Chrome 有`,
  },
} satisfies CaseMeta
