// ============================================================
// 代码块暗色主题（highlight.js github-dark）
// 亮色主题随 utils/code-highlight.ts 静态导入；
// 暗色用独立 <link> 启停，避免两套样式同时生效互相覆盖。
// 在 App.vue 调用一次，全站（含 notes 代码块）共享。
// ============================================================
import { watch } from 'vue'
import darkHref from 'highlight.js/styles/github-dark.css?url'
import { useTheme } from './useTheme'

/** 暗色主题样式表节点（首次切到暗色时创建，之后复用） */
let darkLink: HTMLLinkElement | null = null

export function useCodeTheme(): void {
  const { isDark } = useTheme()

  watch(
    isDark,
    (dark) => {
      if (dark) {
        if (!darkLink) {
          darkLink = document.createElement('link')
          darkLink.rel = 'stylesheet'
          darkLink.href = darkHref
          document.head.appendChild(darkLink)
        }
        darkLink.disabled = false
      } else if (darkLink) {
        darkLink.disabled = true
      }
    },
    { immediate: true },
  )
}
