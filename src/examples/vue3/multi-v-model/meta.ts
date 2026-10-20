// ============================================================
// 案例元数据：多 v-model 参数与修饰符
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'multi-v-model',
  title: '多 v-model 参数与修饰符',
  difficulty: 'intermediate',
  tags: ['defineModel', 'v-model', '修饰符', 'trim'],
  summary: '一个组件同时绑定标题/姓名/是否显示三个模型，写入时自动去空格，父子双向可见',
  sell: '一个组件三个双向绑定，修饰符也能自定义',
  explain: {
    situation:
      '一个表单组件要同时编辑标题、姓名、是否显示。你写了一堆参数和事件，父级还要配三个更新处理函数，改个字段名要动两处。',
    background:
      'Vue 3 支持多个双向绑定：父级写 v-model:title，子组件就用 defineModel("title") 接，名字必须严格一致。父级加的修饰符（比如去空格、延迟同步）子组件也能读到，怎么处理由你决定。',
    action:
      '案例一个组件同时绑定 title、name、visible 三个模型：子组件里用 defineModel 分别声明，默认值从父级传入；用 set 选项在写入时自动去掉首尾空格；页面上父子两边的输入实时同步，还能看到修饰符是否传进来。',
    conclusion:
      '记住：多个双向绑定比参数加事件清爽得多，名字大小写敏感；不写参数时默认仍是 modelValue。布尔值别配去空格修饰符。',
  },
} satisfies CaseMeta
