// ============================================================
// 案例元数据：响应式依赖注入
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'reactive-inject',
  title: '响应式依赖注入',
  difficulty: 'intermediate',
  tags: ['provide', 'inject', 'readonly', 'Symbol'],
  summary: '跨三层传递响应式数据并保持同步，用唯一值避免键冲突，演示两种只读边界',
  sell: '跨层传数据要一层层转手：依赖注入直达且同步',
  explain: {
    situation:
      '主题色要从顶层传到第五层组件，参数一层层传太丑。你换成「提供与注入」，结果子组件改了值，顶层没反应。',
    background:
      '注入默认传的是「值」而不是引用。想共享响应式，得把 ref 本体传下去；key 用 Symbol（唯一值），避免和别人的 theme 撞车；不想让下层乱改，就用 computed 或 readonly 包一层。',
    action:
      '案例在顶层用 provide 提供一个 ref，key 用 Symbol 并标注类型；三层组件依次 inject 同一个 ref，底层一改顶层立即同步。只读边界演示两种：computed 只暴露 getter；readonly 包一层，写入时开发模式会警告。',
    conclusion:
      '记住：提供与注入要传 ref 本体才响应式，key 用 Symbol；只读需求用 readonly。它是「跨层传参」，不是全局状态库。',
  },
} satisfies CaseMeta
