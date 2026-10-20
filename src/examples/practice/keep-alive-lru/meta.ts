// ============================================================
// 案例元数据：KeepAlive + LRU 页面缓存
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'keep-alive-lru',
  title: 'KeepAlive + LRU 页面缓存',
  difficulty: 'advanced',
  tags: ['KeepAlive', 'LRU', 'onActivated', '页面缓存'],
  summary: '真实 KeepAlive 运行：输入内容切走保留，max=2 时最久未访问页被淘汰并触发 unmount',
  sell: 'max=2 真实淘汰，缓存生命周期可见',
  explain: {
    situation:
      '列表翻到第 3 页，点进详情再返回，列表又回到第一页、筛选条件也没了，用户得重新找一遍。',
    background:
      'KeepAlive 会把组件实例缓存起来：切走时不销毁，回来直接复用状态和 DOM。max 限制最多缓存几个，超了按 LRU（最久未使用）淘汰，被淘汰的组件才真正执行卸载。',
    action:
      '案例用真实 KeepAlive 跑：输入内容切走再回来还在；max=2 时连续访问第三个页面，最早那个被淘汰并触发 unmounted，右侧生命周期日志能一步步看清。',
    conclusion:
      '记住：列表、表单页适合缓存，详情页通常不需要；max 一定要设，否则缓存无限增长。配合 activated 刷新数据、上报曝光。',
  },
} satisfies CaseMeta
