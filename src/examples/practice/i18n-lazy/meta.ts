// ============================================================
// 案例元数据：i18n 语言包按需加载
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'i18n-lazy',
  title: 'i18n 语言包按需加载',
  difficulty: 'intermediate',
  tags: ['i18n', '动态 import', '代码分割', '首屏体积'],
  summary: '首屏只加载当前语言，切换时动态 import 独立 chunk 并显示加载态，已加载语言走内存缓存',
} satisfies CaseMeta
