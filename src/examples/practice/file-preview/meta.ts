// ============================================================
// 案例元数据：多格式文件预览
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'file-preview',
  title: '多格式文件预览',
  difficulty: 'intermediate',
  tags: ['File', 'Blob URL', 'MIME', '拖拽'],
  summary: '按 MIME 分流图片/文本/PDF/音视频，内置 canvas 图片、WAV、手写 PDF 示例全部本地生成',
  sell: '按 MIME 分流预览，示例文件全部本地生成',
  explain: {
    situation:
      '用户上传了图片、PDF、Markdown、MP4，你要分别预览，结果全塞进 iframe：图片打不开、视频没控件、文本变成乱码。',
    background:
      '不同格式要用不同标签：图片用 img、文本用 pre、PDF 用 iframe/object、音视频用 audio/video。判断类型优先看 MIME，MIME 为空时再看扩展名（.md、.log 经常没有 MIME）。',
    action:
      '案例按 MIME 分流成四类预览；内置的 canvas 图片、WAV、手写 PDF 示例全部本地生成，不依赖外网。',
    conclusion:
      '记住：预览先分流再渲染，MIME 优先、扩展名兜底。用 URL.createObjectURL 生成的地址记得 revoke，否则会一直占内存。',
  },
} satisfies CaseMeta
