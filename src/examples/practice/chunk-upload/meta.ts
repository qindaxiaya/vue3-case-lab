// ============================================================
// 案例元数据：大文件分片上传
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'chunk-upload',
  title: '大文件分片上传',
  difficulty: 'advanced',
  tags: ['分片上传', '断点续传', '秒传', 'SHA-256'],
  summary: '本地算 SHA-256 指纹 → 秒传判断 → 1MB 分片并发 3 上传；暂停后续传只补未完成分片',
} satisfies CaseMeta
