// ============================================================
// 案例元数据：多 v-model 参数与修饰符
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'multi-v-model',
  title: '多 v-model 参数与修饰符',
  difficulty: 'intermediate',
  tags: ['defineModel', 'v-model', '修饰符', 'trim'],
  summary: '一个组件同时绑定 title/name/visible 三个模型，set 选项实现 trim，父级值与子级输入双向可见',
  sell: '一个组件三个 v-model，修饰符也能自定义',
  explain: {
    situation:
      '一个表单组件要同时编辑标题、姓名、是否显示。你写了一堆 props + emit，父级还要配三个 @update 处理函数，改个字段名要动两处。',
    background:
      'Vue 3 支持多个 v-model：父级写 v-model:title，子组件就用 defineModel("title") 接，名字必须严格一致。父级加的修饰符（.trim、.lazy）子组件也能读到，怎么处理由你决定。',
    action:
      '案例一个组件同时绑定 title / name / visible 三个模型，子组件用 set 选项实现 trim，父子输入实时双向同步；页面上能直接看到修饰符传进来的效果。',
    conclusion:
      '记住：多个 v-model 比 props/emit 清爽得多，名字大小写敏感；不写参数时默认仍是 modelValue。布尔值别配 .trim。',
  },
} satisfies CaseMeta
