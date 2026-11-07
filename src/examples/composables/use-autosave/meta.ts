// ============================================================
// 案例元数据：useAutosave 自动保存
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'use-autosave',
  title: 'useAutosave：自动保存别每次按键都写',
  difficulty: 'intermediate',
  tags: ['组合式函数', '自动保存', '防抖', 'localStorage'],
  summary: '每次输入都写会卡；防抖合并 + 离开页面补一次',
  sell: '自动保存要防抖，离开页面前再补一次',
  explain: {
    situation:
      '编辑草稿时每输入一个字就写一次 localStorage 或调一次保存接口，输入快了页面发卡，接口也被打满；关掉页面前最后一次修改还可能没保存。',
    background:
      '自动保存的难点不是「写」，而是「什么时候写」：连续输入应该合并成一次，保存期间的新输入不能被旧结果覆盖，离开页面时还要把待保存的内容补上。',
    action:
      '案例把自动保存封装成 useAutosave(source, { delay, save })：停止输入 600ms 后才保存，保存中再输入会再排一轮；pagehide 时补一次，卸载时清定时器并移除监听。',
    conclusion:
      '记住：自动保存 = 防抖 + 串行 + 离开页面兜底。不要每次 input 都落盘；保存失败要保留待保存内容，让用户能重试。',
  },
} satisfies CaseMeta
