// ============================================================
// 案例元数据：防抖节流波形对比
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'debounce-throttle',
  title: '防抖节流波形对比',
  difficulty: 'beginner',
  tags: ['VueUse', 'debounce', 'throttle'],
  summary: 'useDebounceFn/useThrottleFn 一行接入，脉冲波形直观对比原始事件与实际执行频率',
  sell: '波形对比防抖节流，一行接入 VueUse',
  explain: {
    situation:
      '搜索框每敲一个字就发一次请求，输入 vue 发了三次；滚动监听里算位置，页面越滚越卡。',
    background:
      '防抖是「停手后再执行」，节流是「固定间隔最多执行一次」。手写容易漏掉取消、立即执行、返回值这些细节，VueUse 已经把这些都处理好了。',
    action:
      '案例用 useDebounceFn / useThrottleFn 一行接入，用脉冲波形对比「原始事件」和「实际执行」的频率，500ms 窗口一眼看清。',
    conclusion:
      '记住：搜索用防抖，滚动/拖拽用节流。优先用 VueUse 别手写；需要中途取消时记得调 cancel。',
  },
} satisfies CaseMeta
