// ============================================================
// 案例元数据：命令面板 Command Palette
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'command-palette',
  title: '命令面板 Command Palette',
  difficulty: 'intermediate',
  tags: ['fuse.js', '快捷键', '模糊搜索'],
  summary: 'Ctrl+K 唤起，模糊匹配 + 命中高亮，纯键盘导航的命令入口',
  sell: 'Ctrl+K 唤起，模糊搜索 + 纯键盘操作',
  explain: {
    situation:
      '想给站点加个「按 Ctrl+K 搜索一切」的入口，像代码编辑器、效率工具那样，敲几个字母就能找到命令，但自己写模糊匹配越写越乱。',
    background:
      '命令面板 = 全局快捷键 + 模糊搜索 + 键盘导航。模糊搜索不用自己造，fuse.js 这个库会按相似度打分，还能返回命中字符的位置，正好用来做高亮。',
    action:
      '案例在 document 上监听快捷键，按下 Ctrl+K 打开面板并自动聚焦输入框；输入时用 fuse.js 在命令列表里搜索，把命中区间渲染成高亮；上下键移动选中项，回车执行，Esc 关闭，点击遮罩也能关。所有操作都不需要鼠标。',
    conclusion:
      '记住：模糊搜索直接用 fuse.js，相似度阈值 0.3 到 0.4 比较好用。命令面板的核心体验是「纯键盘也能完成一切」。',
  },
} satisfies CaseMeta
