// ============================================================
// 案例元数据：PDF 预览
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'pdf-preview',
  title: 'PDF 预览',
  difficulty: 'intermediate',
  tags: ['PDF.js', 'Canvas', 'Web Worker', '渲染'],
  summary: 'pdf.js 把 PDF 渲染到 canvas，自建翻页缩放工具栏，跨端表现一致',
  sell: 'PDF.js 渲染到 canvas，预览界面完全自己掌控',
  explain: {
    situation:
      '在线预览合同或发票时，浏览器自带查看器在手机上可能只显示一页，甚至直接触发下载；想换个工具栏样式、加个水印也完全做不到。',
    background:
      'PDF 不是网页，浏览器只是调用了内置阅读器。PDF.js 则用 JavaScript 解析 PDF：后台线程负责拆解文件，主线程拿到每一页后画到 canvas 上，所以翻页、缩放、水印都能自己决定。',
    action:
      '案例现场生成一份三页 PDF，用 PDF.js 的 Worker 解析，把当前页放大设备像素比后画到 canvas；自建上一页/下一页、缩放、卸载按钮，翻页前取消上一次渲染任务，卸载时销毁文档对象。',
    conclusion:
      '记住：只需要「能看」可以用浏览器自带查看器；要跨端一致、自定义界面或加水印，就用 PDF.js 渲染到 canvas。PDF.js 只负责解析和绘制，界面完全由你控制。',
  },
} satisfies CaseMeta
