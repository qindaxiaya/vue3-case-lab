// ============================================================
// 案例元数据：defineModel 组件双向绑定
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'define-model',
  title: 'defineModel 组件双向绑定',
  difficulty: 'intermediate',
  tags: ['defineModel', 'v-model', 'props', 'emit'],
  summary: 'props + emit 旧写法与 defineModel 新写法并排对比，父级改写与子级输入双向验证',
  sell: '旧 emit 与新 defineModel 并排，迁移一眼懂',
  explain: {
    situation:
      '写一个输入框组件给父级用 v-model。子组件里 props + emit("update:modelValue") 写一大串，每次都要翻模板确认名字。',
    background:
      'defineModel 是 Vue 3.4+ 的宏，一行就能声明双向绑定，父级用法完全不变。本地写入会先改本地值再 emit；父级不更新时界面会回弹，这正是受控组件的语义。',
    action:
      '案例把旧写法和新写法并排放：父级改值子级同步、子级输入父级同步；自定义名 defineModel("title") 对应父级 v-model:title。',
    conclusion:
      '记住：新项目直接用 defineModel，旧项目只改子组件内部，父级不用动。需要 Vue 3.4+，默认模型名仍是 modelValue。',
  },
} satisfies CaseMeta
