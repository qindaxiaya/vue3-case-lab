// ============================================================
// 案例元数据：Vite 代码分割
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'vite-split',
  title: 'Vite 代码分割',
  difficulty: 'intermediate',
  tags: ['Vite', '代码分割', '懒加载', '构建优化'],
  summary: '勾选懒加载/vendor 拆分/按需引入/外置，实时看首屏体积变化，附 vite.config 配置要点',
  sell: '勾选配置实时看首屏体积，分割策略有数',
  explain: {
    situation:
      '项目越做越大，首屏要加载 8 秒。你知道「代码分割」有用，但不知道从哪切，切完到底快了多少也说不清。',
    background:
      '打包时 import 的代码会进 chunk，而 () => import() 会把组件拆成独立文件，用到才下载。vendor 拆分让第三方库的 hash 长期不变，发版时用户不用重下；按需引入、外置 CDN 也都会改变首屏体积。',
    action:
      '案例用勾选框模拟几种策略（懒加载 / vendor 拆分 / 按需引入 / 外置），实时估算首屏体积变化，并给出 vite.config 的关键配置和「该看哪个 chunk」的方法。',
    conclusion:
      '记住：先看构建输出的 chunk 大小，再决定切哪；别盲目拆，碎片太多反而请求变多。业务常改、库不常改，vendor 独立缓存最划算。',
  },
} satisfies CaseMeta
