// ============================================================
// 案例元数据：文件上传
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'file-upload',
  title: '文件上传（校验 + 队列）',
  difficulty: 'intermediate',
  tags: ['上传', '并发队列', '进度', '取消重试'],
  summary: '类型/大小校验、并发 2 的上传队列、单项取消、失败重试与总进度，全部模拟可交互',
} satisfies CaseMeta
