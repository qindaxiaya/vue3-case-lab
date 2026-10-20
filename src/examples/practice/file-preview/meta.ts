// ============================================================
// 案例元数据：多格式文件预览
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'file-preview',
  title: '多格式文件预览',
  difficulty: 'intermediate',
  tags: ['File', 'Blob URL', 'MIME', '拖拽'],
  summary: '按文件类型分流到图片、文本、PDF、音视频预览，示例文件全部本地生成',
  sell: '不同文件格式各写一套预览：按类型分流一次搞定',
  explain: {
    situation:
      '用户上传了图片、PDF、Markdown、MP4，你要分别预览，结果全塞进 iframe：图片打不开、视频没控件、文本变成乱码。',
    background:
      '不同格式要用不同标签：图片用 img、文本用 pre、PDF 用 iframe 或 object、音视频用 audio 和 video。判断类型优先看文件类型标记，标记为空时再看扩展名，因为 .md、.log 这类文件经常没有标记。',
    action:
      '案例读取文件后先取类型，按图片、文本、PDF、音视频分成四支：图片用 createObjectURL 生成临时地址交给 img；文本用 FileReader 读成字符串放进 pre；PDF 和视频直接交给 iframe 和 video。页面上的示例文件全部由代码本地生成，不依赖外网。',
    conclusion:
      '记住：预览先分流再渲染，类型标记优先、扩展名兜底。临时地址用完要 revoke，否则文件内容会一直占内存。',
  },
} satisfies CaseMeta
