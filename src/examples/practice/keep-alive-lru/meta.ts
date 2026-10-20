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
} satisfies CaseMeta
