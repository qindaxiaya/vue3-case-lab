// ============================================================
// 案例元数据：useKeyboardShortcuts 快捷键声明式注册
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'use-keyboard-shortcut',
  title: 'useKeyboardShortcuts：把快捷键表交给一个监听器',
  difficulty: 'intermediate',
  tags: ['组合式函数', '键盘事件', '快捷键', '事件清理'],
  summary: '按键一张表注册，输入框里自动让路，修饰键必须完全一致',
  sell: '一个监听器管全部快捷键，输入框里不乱触发',
  explain: {
    situation:
      '功能加多了，页面里挂了好几个 keydown：用户在输入框里打一个 / 被吞掉，按 Esc 想取消输入却把面板关了；某天想给 Ctrl+K 加个别名，改完发现 Ctrl+Shift+K 也跟着触发。',
    background:
      'keydown 挂在 window 上是全局的，浏览器不关心焦点在哪个元素。手写判断通常只看「按了哪个键 + 某个修饰键」，漏掉两件事：其他修饰键有没有同时按下，以及焦点是不是在输入框里——那里按键是打字，不是快捷键。',
    action:
      '案例把「键位表 → 回调」一次性交给 useKeyboardShortcuts：一个监听器按表分发，修饰键全等比对（Alt+K 不会被 Alt+Shift+K 冒充），焦点在输入框且这组键没有修饰键时直接让路，带修饰键的组合仍然生效；监听器在作用域结束时自动解绑。',
    conclusion:
      '快捷键不是一个 keydown 回调，而是一张键位表加一套让路规则。把规则集中在封装里，新增快捷键才不会多踩一个坑；手写版最大的问题不是写不出来，而是每加一个快捷键就要重抄一遍这些判断。',
  },
} satisfies CaseMeta
