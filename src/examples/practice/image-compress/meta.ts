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
  sell: 'canvas 压缩 + 分割线对比，体积画质看得见',
  explain: {
    situation:
      '用户上传一张手机原图，4000×3000、8MB，传半天还占服务器空间；可页面上根本只显示 800px 宽。',
    background:
      '浏览器自带 canvas：可以先把图画到一块更小的画布上，再用 toBlob 重新编码成 JPEG/WebP，质量参数控制体积。缩小图片时要开高质量插值，否则边缘全是锯齿。',
    action:
      '案例按长边等比缩放，拖动质量滑杆实时看体积和画质，中间拉一条分割线对比压缩前后；体积、分辨率、压缩耗时都直接显示。',
    conclusion:
      '记住：上传前先压缩，长边 1280–1920 通常够用，toBlob 是原生能力不用装库。注意透明图别转 JPEG，会变黑底。',
  },
} satisfies CaseMeta
