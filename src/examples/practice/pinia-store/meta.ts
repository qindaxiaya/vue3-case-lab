// ============================================================
// 案例元数据：状态管理（Pinia 范式 + 持久化）
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'pinia-store',
  title: '状态管理：Pinia 范式 + 持久化',
  difficulty: 'intermediate',
  tags: ['Pinia', 'store', '持久化', 'localStorage'],
  summary: '20 行等价实现讲透 setup store：跨组件共享 + deep watch 持久化，附真实 Pinia 写法对照',
  sell: '20 行还原 setup store，持久化与拆分讲透',
  explain: {
    situation:
      '两个不相干的组件都要用「当前用户」和「购物车」，你一层层 props 往下传，改一次要动五个文件；刷新页面数据又全没了。',
    background:
      'Pinia 的 setup store 本质就是「模块级 reactive 对象 + 方法」，谁 import 谁共享同一份引用；持久化就是在数据变化时写 localStorage、启动时读回来，没什么魔法。',
    action:
      '案例用 20 行实现等价 store：state / getter / action，deep watch 自动持久化；再演示解构会丢响应式（要用 storeToRefs）、跨 store 调用、按功能拆分，并附真实 Pinia 写法对照。',
    conclusion:
      '记住：跨页面共享状态用 store，别用 props 硬传；解构记得 storeToRefs。小项目一个 reactive 模块就够，不必为了「规范」硬上库。',
  },
} satisfies CaseMeta
