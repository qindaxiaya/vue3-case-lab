// ============================================================
// 案例元数据：watch/watchEffect 三大陷阱
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'watch-traps',
  title: 'watch/watchEffect 三大陷阱',
  difficulty: 'advanced',
  tags: ['watch', 'watchEffect', 'deep', 'flush'],
  summary: 'deep 浅监听盲区、onCleanup 取消过期异步、sync/pre/post 三种 flush 读 DOM 的差异',
  sell: 'deep、清理、flush 三个坑一次避开',
} satisfies CaseMeta
