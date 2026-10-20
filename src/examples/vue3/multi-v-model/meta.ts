// ============================================================
// 案例元数据：多 v-model 参数与修饰符
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'multi-v-model',
  title: '多 v-model 参数与修饰符',
  difficulty: 'intermediate',
  tags: ['defineModel', 'v-model', '修饰符', 'trim'],
  summary: '一个组件同时绑定 title/name/visible 三个模型，set 选项实现 trim，父级值与子级输入双向可见',
  sell: '一个组件三个 v-model，修饰符也能自定义',
} satisfies CaseMeta
