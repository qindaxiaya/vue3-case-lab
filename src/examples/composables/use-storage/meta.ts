// ============================================================
// 案例元数据：useStorage 响应式持久化
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'use-storage',
  title: 'useStorage：让 localStorage 变成响应式状态',
  difficulty: 'intermediate',
  tags: ['组合式函数', 'localStorage', '持久化', '数据校验'],
  summary: '改状态就自动存；读时校验字段，脏数据回退默认值并修好存储',
  sell: '改状态就自动落盘，脏数据回退默认值还顺手修好',
  explain: {
    situation:
      '用户调好的字号、昵称，刷新页面就回到默认；更糟的是哪天有人在控制台把存储改坏了，页面每次进来都报错，用户只能清缓存自救。',
    background:
      'localStorage 只能存字符串：写要自己 JSON.stringify，读要自己 JSON.parse，而且它不会通知任何组件，所以很多人只在初始化时读一次。读出来的内容也没人检查——旧版本残留的字段、手改错的类型都会原样进界面。',
    action:
      '案例把读写封装成 useStorage(key, defaults)：state 是响应式对象，改它就会自动写回；读取时按 defaults 的字段和类型逐个校验，坏 JSON 与非法字段回退默认值，并把正确内容写回存储。界面并排展示手写版与封装版在三种脏数据下的不同结果。',
    conclusion:
      '记住：状态是真相，存储只是镜像；凡是读进来的数据都当不可信输入处理。校验 + 回退 + 修复三步做完，用户下次进来才不会继续踩同一个坑。',
  },
} satisfies CaseMeta
