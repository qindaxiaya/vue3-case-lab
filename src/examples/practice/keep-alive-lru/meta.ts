// ============================================================
// 案例元数据：KeepAlive + LRU 页面缓存
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'keep-alive-lru',
  title: 'KeepAlive + LRU 页面缓存',
  difficulty: 'advanced',
  tags: ['KeepAlive', 'LRU', 'onActivated', '页面缓存'],
  summary: '真实组件缓存：输入内容切走保留，最多 2 个，最久未访问的自动淘汰',
  sell: '最多缓存 2 个，超了自动淘汰，生命周期可见',
  explain: {
    situation:
      '列表翻到第 3 页，点进详情再返回，列表又回到第一页、筛选条件也没了，用户得重新找一遍。',
    background:
      'Vue 的组件缓存（KeepAlive）会把组件实例存起来：切走时不销毁，回来直接复用状态和页面结构。max 限制最多缓存几个，超了按「最近最少使用」规则淘汰，被淘汰的组件才真正执行卸载。',
    action:
      '案例用真实的 KeepAlive 包住动态组件，输入框内容切走再回来还在；把 max 设为 2，连续访问第三个页面时，最早访问的那个被淘汰并触发卸载。右侧日志按时间顺序打印创建、激活、失活、卸载，能一步步看清。',
    conclusion:
      '记住：列表、表单页适合缓存，详情页通常不需要；max 一定要设，否则缓存无限增长。配合 activated 刷新数据、上报曝光。',
  },
} satisfies CaseMeta
