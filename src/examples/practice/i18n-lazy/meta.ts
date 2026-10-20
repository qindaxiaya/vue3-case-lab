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
  sell: '语言包按需 import，首屏只带当前语言',
  explain: {
    situation:
      '项目要支持中英日三语。语言包一多，首屏体积跟着涨；切换语言还要刷新页面，用户填到一半的表单直接没了。',
    background:
      '静态 import 会把所有语言打进首屏包，哪怕用户只用中文；动态 import() 会被拆成独立文件，真正切到那门语言时才下载。下载完把词条合并进 i18n 实例即可，不需要刷新。',
    action:
      '案例首屏只加载当前语言（优先级：URL 前缀 > 上次选择 > 浏览器语言 > 中文），切到 en/ja 时动态加载独立 chunk 并显示加载态，加载过的语言放进内存缓存，切来切去不重复下载。',
    conclusion:
      '记住：语言包一律按需加载，切换用 setLocaleMessage 合并。语言文件多的大项目，还可以按页面再拆一层。',
  },
} satisfies CaseMeta
