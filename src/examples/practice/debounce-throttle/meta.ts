// ============================================================
// 案例元数据：防抖节流波形对比
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'debounce-throttle',
  title: '防抖节流波形对比',
  difficulty: 'beginner',
  tags: ['VueUse', 'debounce', 'throttle'],
  summary: '并排对比防抖与节流：脉冲波形显示原始事件与真实执行次数，一行接入现成库',
  sell: '搜索框每敲一下都请求：防抖节流一行接入',
  explain: {
    situation:
      '搜索框每敲一个字就发一次请求，输入 vue 发了三次；滚动监听里算位置，页面越滚越卡。',
    background:
      '防抖是「停手后再执行」，节流是「固定间隔最多执行一次」。手写容易漏掉取消、立即执行、返回值这些细节，VueUse 这个工具库已经把这些都处理好了。',
    action:
      '案例用 useDebounceFn 和 useThrottleFn 一行接入：防抖延迟设为 500 毫秒，连续触发只在停手后执行最后一次；节流固定每 200 毫秒最多执行一次。页面上用脉冲波形对比「原始事件」和「实际执行」的频率，还能点取消按钮验证。',
    conclusion:
      '记住：搜索用防抖，滚动、拖拽用节流。优先用 VueUse，别手写；需要中途取消时记得调 cancel。',
  },
} satisfies CaseMeta
