// ============================================================
// 案例元数据：defineModel 组件双向绑定
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'define-model',
  title: 'defineModel 组件双向绑定',
  difficulty: 'intermediate',
  tags: ['defineModel', 'v-model', 'props', 'emit'],
  summary: '参数加事件旧写法与新写法并排对比，父级改写与子级输入双向验证',
  sell: '旧写法与新写法并排，迁移一眼懂',
  explain: {
    situation:
      '写一个输入框组件给父级用双向绑定。子组件里参数加更新事件写一大串，每次都要翻模板确认名字。',
    background:
      'defineModel 是 Vue 3.4 起提供的宏，一行就能声明双向绑定，父级用法完全不变。本地写入会先改本地值再通知父级；父级不更新时界面会回弹，这正是受控组件的语义。',
    action:
      '案例把旧写法和新写法并排：旧写法声明参数、在输入时触发更新事件；新写法只写一行 defineModel。父级改值时子组件同步，子组件输入时父级同步；自定义名 defineModel("title") 对应父级 v-model:title。',
    conclusion:
      '记住：新项目直接用 defineModel，旧项目只改子组件内部，父级不用动。需要 Vue 3.4 以上，默认模型名仍是 modelValue。',
  },
} satisfies CaseMeta
