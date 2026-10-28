// ============================================================
// Naive UI 主题映射（正式版，源自 2026-10-28 spike）
// - Naive 的主题是 JS 对象（themeOverrides），不吃 CSS 变量，
//   所以这里手工镜像一份 _tokens.scss 的值——改动 token 要同步这里
// - 浅色覆盖主色/语义色/圆角/字号/字体；暗色直接用 darkTheme 的
//   深色体系，只额外覆盖主色与语义色（避免两套深色调色板打架）
// - 演示区控件统一 36px（触屏 40px）在组件级覆盖，替代原 EP 的
//   :deep 高度补丁；触屏下 .demo-card 的 :where(button,input,...)
//   最小高度兜底仍生效（Naive 渲染的也是原生 button/input）
// ============================================================
import { computed } from 'vue'
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import { useTheme } from './useTheme'

// ---------- 浅色覆盖（对应 :root 的值） ----------
const lightOverrides: GlobalThemeOverrides = {
  common: {
    // 主色：站点 primary（indigo-600）
    primaryColor: '#4f46e5',
    primaryColorHover: '#4338ca', // primary-hover（indigo-700）
    primaryColorPressed: '#4338ca',
    primaryColorSuppl: '#4f46e5',

    // 语义色
    successColor: '#16a34a', // green-600
    warningColor: '#d97706', // amber-600
    errorColor: '#dc2626', // red-600

    // 圆角：站点小元素 0.375rem = 6px
    borderRadius: '6px',
    borderRadiusSmall: '4px',

    // 字号 与 字体栈：站点正文控件 14px、系统 sans
    fontSize: '14px',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", '
      + '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  },

  // 演示区控件尺寸对齐站点 --demo-control-h（36px）
  Button: { heightMedium: '2.25rem' },
  Input: { heightMedium: '2.25rem' },
  Radio: { buttonHeightMedium: '2.25rem' },
  Select: { peers: { InternalSelection: { heightMedium: '2.25rem' } } },
}

// ---------- 暗色覆盖（对应 .dark 的值） ----------
const darkOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#818cf8', // primary 暗色提亮（indigo-400）
    primaryColorHover: '#a5b4fc', // primary-hover（indigo-300）
    primaryColorPressed: '#6366f1', // indigo-500：暗色按下比 hover 深
    primaryColorSuppl: '#818cf8',

    successColor: '#4ade80', // green-400
    warningColor: '#fbbf24', // amber-400
    errorColor: '#f87171', // red-400

    borderRadius: '6px',
    borderRadiusSmall: '4px',
    fontSize: '14px',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", '
      + '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  },

  // 与浅色同款尺寸，避免两套 overrides 漂移
  Button: { heightMedium: '2.25rem' },
  Input: { heightMedium: '2.25rem' },
  Radio: { buttonHeightMedium: '2.25rem' },
  Select: { peers: { InternalSelection: { heightMedium: '2.25rem' } } },
}

/**
 * 演示区 Naive UI 主题
 * 复用 useTheme 的 isDark 单例：主题切换按钮只改 .dark class，
 * Naive 这边跟着同一份响应式状态切换 darkTheme / 亮主题
 */
export function useNaiveTheme() {
  const { isDark } = useTheme()

  const theme = computed(() => (isDark.value ? darkTheme : null))
  const themeOverrides = computed(() =>
    isDark.value ? darkOverrides : lightOverrides,
  )

  return { theme, themeOverrides }
}
