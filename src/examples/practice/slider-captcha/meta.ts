// ============================================================
// 案例元数据：滑块验证
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'slider-captcha',
  title: '滑块验证',
  difficulty: 'advanced',
  tags: ['Canvas', '人机验证', '指针拖拽', '轨迹'],
  summary: 'canvas 随机背景 + 缺口，拖拽对齐判断误差；记录耗时/轨迹点/方向变化，附服务端校验提醒',
  sell: 'canvas 缺口 + 轨迹采集，滑块验证完整闭环',
} satisfies CaseMeta
