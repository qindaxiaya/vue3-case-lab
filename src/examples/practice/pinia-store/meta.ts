// ============================================================
// 案例元数据：状态管理（Pinia 范式 + 持久化）
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'pinia-store',
  title: '状态管理：Pinia 范式 + 持久化',
  difficulty: 'intermediate',
  tags: ['Pinia', 'store', '持久化', 'localStorage'],
  summary: '二十行实现跨组件共享仓库，配合深度侦听做持久化，并附真实 Pinia 写法对照',
  sell: '状态散落各组件难同步：集中仓库加持久化',
  explain: {
    situation:
      '两个互不相干的组件都要用「当前用户」和「购物车」，你一层层往下传参数，改一次要动五个文件；刷新页面数据又全没了。',
    background:
      'Pinia 的 setup 写法本质就是「一个模块级的响应式对象 + 一组方法」：谁导入谁共享同一份数据。持久化就是在数据变化时写进浏览器本地存储，启动时再读回来，没有什么魔法。',
    action:
      '案例用 20 行写了等价实现：用 reactive 创建状态，computed 派生购物车总价，方法里修改状态；再用深度侦听监听整个状态，一变就写入本地存储，初始化时读回来。页面还演示了解构会丢响应式，要用 storeToRefs 才能保持同步；以及在一个 store 里调用另一个 store。',
    conclusion:
      '记住：跨页面共享状态用 store，别用参数硬传；解构记得 storeToRefs。小项目一个响应式模块就够，不必为了「规范」硬上库。',
  },
} satisfies CaseMeta
