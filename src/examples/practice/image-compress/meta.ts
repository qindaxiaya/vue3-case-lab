// ============================================================
// 案例元数据：图片压缩前后对比
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'image-compress',
  title: '图片压缩前后对比',
  difficulty: 'intermediate',
  tags: ['canvas', 'toBlob', '图片处理'],
  summary: 'canvas 等比缩放 + toBlob(quality) 原生编码，拖动分割线对比体积与画质',
} satisfies CaseMeta
