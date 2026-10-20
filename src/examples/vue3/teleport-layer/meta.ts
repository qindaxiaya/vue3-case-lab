// ============================================================
// 案例元数据：Teleport 弹层管理
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'teleport-layer',
  title: 'Teleport 弹层管理',
  difficulty: 'intermediate',
  tags: ['Teleport', 'z-index', '弹层'],
  summary: '弹层挂到页面根部脱离裁剪，集中式层级计数器防冲突',
  sell: '弹层挂到页面根部不被裁剪，层级统一管理',
  explain: {
    situation:
      '弹窗写在卡片组件里，一打开就被父级的 overflow: hidden 裁掉一半；页面上多个弹层，层级值各写各的，后打开的反而被盖住。',
    background:
      'Teleport（传送门）可以把弹层的页面结构挂到 body 下，彻底脱离父级的裁剪和层叠上下文。但挂过去之后，层级值就没人统一管了，需要自己维护一个递增计数器，保证「后打开的在上层」。',
    action:
      '案例把弹层用 Teleport 挂到 body，并封装一个「取下一个层级」的函数：每打开一个弹层就从计数器取一个值，关闭时不回退，保证顺序只增不减。连续打开多个弹层，叠放顺序始终正确，页面上能看到每个弹层的层级数字。',
    conclusion:
      '记住：弹层一律挂 body；层级用统一计数器，别各写各的 9999。真实项目还要配合滚动锁和焦点管理。',
  },
} satisfies CaseMeta
