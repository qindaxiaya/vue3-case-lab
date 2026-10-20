// ============================================================
// 案例元数据：Teleport 弹层管理
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'teleport-layer',
  title: 'Teleport 弹层管理',
  difficulty: 'intermediate',
  tags: ['Teleport', 'z-index', '弹层'],
  summary: '弹层挂 body 脱离 overflow 裁剪，集中式 z-index 计数器防层级冲突',
  sell: '弹层挂 body 不被裁剪，z-index 统一管理',
  explain: {
    situation:
      '弹窗写在卡片组件里，一打开就被父级的 overflow: hidden 裁掉一半；页面上多个弹层，z-index 各写各的，后打开的反而被盖住。',
    background:
      'Teleport 可以把弹层的 DOM 挂到 body 下，彻底脱离父级的裁剪和层叠上下文。但挂过去之后，z-index 就没人统一管了，需要自己维护一个递增计数器，保证「后打开的在上层」。',
    action:
      '案例把弹层 Teleport 到 body，用集中式 z-index 计数器分配层级；连续打开多个弹层，叠放顺序始终正确，关闭后层级正常回收。',
    conclusion:
      '记住：弹层一律挂 body；z-index 用统一计数器，别各写各的 9999。真实项目还要配合滚动锁和焦点管理。',
  },
} satisfies CaseMeta
