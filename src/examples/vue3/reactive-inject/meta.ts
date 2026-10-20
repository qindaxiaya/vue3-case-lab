// ============================================================
// 案例元数据：响应式依赖注入
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'reactive-inject',
  title: '响应式依赖注入',
  difficulty: 'intermediate',
  tags: ['provide', 'inject', 'readonly', 'Symbol'],
  summary: '三层跨层传 ref 全局同步，Symbol key 防污染，computed/readonly 双只读边界',
  sell: '跨层传 ref 不丢响应式，Symbol 防 key 冲突',
  explain: {
    situation:
      '主题色要从顶层传到第五层组件，props 一层层传太丑。你换成 provide / inject，结果子组件改了值，顶层没反应。',
    background:
      'inject 默认传的是「值」而不是引用。想共享响应式，得把 ref 本体传下去；key 用 Symbol，避免和别人的 "theme" 撞车；不想让下层乱改，就用 computed 或 readonly 包一层。',
    action:
      '案例三层跨层传同一个 ref，底层一改顶层立即同步；用 InjectionKey 拿到类型；再演示 computed（只有 getter）和 readonly（开发模式警告）两种只读边界。',
    conclusion:
      '记住：provide / inject 传 ref 本体才响应式，key 用 Symbol；只读需求用 readonly。它是「跨层传参」，不是全局状态库。',
  },
} satisfies CaseMeta
