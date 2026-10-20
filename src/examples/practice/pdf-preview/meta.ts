// ============================================================
// 案例元数据：PDF 预览
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'pdf-preview',
  title: 'PDF 预览',
  difficulty: 'intermediate',
  tags: ['PDF', 'Blob URL', 'iframe', 'pdfjs'],
  summary: '纯前端生成三页 PDF，对比三种嵌入方式与翻页缩放参数，给出选型建议',
  sell: 'PDF 预览方案挑花眼：手写样例加三种嵌入对比',
  explain: {
    situation:
      '合同、发票要在线预览 PDF 文件。你用 iframe 一嵌，有的浏览器直接弹下载，有的显示空白；想默认翻到第 3 页，也不知道从哪下手。',
    background:
      'PDF 不是网页，浏览器靠内置阅读器渲染。iframe、object、embed 是三种不同的嵌入标签，行为不完全一样；地址后面还能加 #page=3&zoom=120 控制页码和缩放。要自定义工具栏、加水印，就需要引入 PDF.js 这类专门的库。',
    action:
      '案例先手写一个最小的 PDF 文件（不引任何库），再用三种标签分别嵌入同一个文件对比效果，地址里加上 #page 和 #zoom 参数演示翻页与缩放，最后说明移动端和 PDF.js 的选型。',
    conclusion:
      '记住：简单预览用 iframe 加 #page 就够；要文字层、批注、自定义界面就用 PDF.js。苹果手机浏览器对 embed 支持差，优先 iframe。',
  },
} satisfies CaseMeta
