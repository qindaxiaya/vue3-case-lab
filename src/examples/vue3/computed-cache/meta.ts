// ============================================================
// 案例元数据：computed 缓存 vs 方法 vs watch
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'computed-cache',
  title: 'computed 缓存 vs 方法 vs watch',
  difficulty: 'intermediate',
  tags: ['computed', 'watch', '缓存', '渲染'],
  summary: '改无关状态时，computed 不重算、方法每次渲染都跑、watch 不触发——用计数看清三者边界',
  sell: '计数看清 computed / 方法 / watch 的边界',
  explain: {
    situation:
      '模板里用方法算总价，改一个无关状态它也重算一遍；换成 computed 后，又搞不清它到底什么时候会重新计算。',
    background:
      'computed 是惰性的、带缓存：第一次读取才求值，依赖不变就直接返回上次结果。方法没有缓存，组件每渲染一次就跑一次。watch 不产生值，只适合做副作用。',
    action:
      '案例用计数器对比三者：改无关状态时 computed 不重算、方法每次都跑、watch 不触发；依赖变化时只有 computed 更新，数字一眼看懂。',
    conclusion:
      '记住：派生值用 computed，副作用用 watch，事件处理别包 computed。computed 里不要改状态、不要发请求。',
  },
} satisfies CaseMeta
