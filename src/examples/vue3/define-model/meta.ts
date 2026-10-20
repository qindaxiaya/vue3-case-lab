// ============================================================
// 案例元数据：defineModel 组件双向绑定
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'define-model',
  title: 'defineModel 组件双向绑定',
  difficulty: 'intermediate',
  tags: ['defineModel', 'v-model', 'props', 'emit'],
  summary: '同一个输入框用旧写法与新写法并排实现双向绑定，父级改写与子级输入都验证',
  sell: '双向绑定样板代码太多：新写法省掉参数与事件',
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
