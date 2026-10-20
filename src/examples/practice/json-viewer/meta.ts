// ============================================================
// 案例元数据：JSON 树查看器
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'json-viewer',
  title: 'JSON 树查看器',
  difficulty: 'intermediate',
  tags: ['JSON', '扁平化', '路径复制'],
  summary: '扁平化行 + 缩进实现可折叠树（不用递归组件），点行复制 JSON 路径',
  sell: '不写递归组件，扁平化行实现可折叠 JSON 树',
  explain: {
    situation:
      '接口返回一大坨嵌套 JSON，你想像 DevTools 那样一层层展开看，还想复制某个字段的路径，结果自己写递归组件越写越乱。',
    background:
      '不必真的递归渲染。把整棵树「拍扁」成一维的行数组，每行记下缩进层级、路径和能否折叠；点折叠时只是跳过它的子孙行不渲染。逻辑简单，性能也可控。',
    action:
      '案例把 JSON 转成行列表，点箭头展开/折叠，点行复制 data.user.list[0].name 这种路径；空对象和空数组单独标记，很长的字符串自动截断。',
    conclusion:
      '记住：树形展示先想「扁平化 + 跳过」，别一上来就递归组件。数据量特别大时，再配合虚拟滚动。',
  },
} satisfies CaseMeta
