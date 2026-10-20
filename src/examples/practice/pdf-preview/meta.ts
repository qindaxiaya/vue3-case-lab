// ============================================================
// 案例元数据：PDF 预览
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'pdf-preview',
  title: 'PDF 预览',
  difficulty: 'intermediate',
  tags: ['PDF', 'Blob URL', 'iframe', 'pdfjs'],
  summary: '纯前端生成 3 页 PDF，对比 iframe/object/embed 嵌入、#page/#zoom 参数与 pdfjs 选型',
} satisfies CaseMeta
