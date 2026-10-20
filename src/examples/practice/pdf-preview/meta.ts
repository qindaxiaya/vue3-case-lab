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
  sell: '手写 PDF + 三种嵌入方式，选型不再靠猜',
  explain: {
    situation:
      '合同、发票要在线预览 PDF。你用 iframe 一嵌，有的浏览器直接弹下载，有的显示空白；想默认翻到第 3 页，也不知道从哪下手。',
    background:
      'PDF 不是网页，浏览器靠内置阅读器渲染。iframe、object、embed 三种嵌入方式行为不一样；地址后面还能加 #page=3&zoom=120 控制页码和缩放。要自定义工具栏、加水印，就得上 pdf.js。',
    action:
      '案例先手写一个最小 PDF（不引任何库），再分别用 iframe/object/embed 嵌入对比，演示 #page、#zoom 参数，最后给移动端和 pdf.js 的选型建议。',
    conclusion:
      '记住：简单预览用 iframe + #page 就够；要文字层、批注、自定义 UI 就用 pdf.js。iOS Safari 对 embed 支持差，优先 iframe。',
  },
} satisfies CaseMeta
