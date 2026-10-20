// ============================================================
// 主题切换 composable（模块级单例）
// - 读写 localStorage('moyu-theme')：'dark' | 'light'
// - 同步 <html> 的 .dark class（CSS 变量随类切换）
// - index.html 内联脚本已在首屏前应用 class（防闪白），此处保持同步
// ============================================================
import { ref, watchEffect } from 'vue'

// localStorage 键名（全站统一）
const STORAGE_KEY = 'moyu-theme'

/** 是否暗色模式（模块级 ref，全站共享同一实例） */
const isDark = ref(false)

// 是否已完成初始化（防止 watchEffect 重复注册）
let initialized = false

/**
 * 主题切换入口
 * @returns isDark 响应式引用 + toggle 切换函数
 */
export function useTheme() {
  // 首次调用时：初始化状态 + 注册同步副作用（后续调用直接复用单例）
  if (!initialized) {
    initialized = true

    // 读持久化偏好；无记录时跟随系统暗色设置（与 index.html 防闪白逻辑一致）
    const stored = localStorage.getItem(STORAGE_KEY)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    isDark.value = stored === 'dark' || (stored === null && prefersDark)

    // 响应式同步：isDark 变化 → 更新 html class
    // 注意：这里不写 localStorage。初始化即写入会把「跟随系统」固化成
    // 一次性快照，之后系统切换主题就再也跟不上了。
    watchEffect(() => {
      document.documentElement.classList.toggle('dark', isDark.value)
    })

    // 用户尚未显式选择（localStorage 无记录）时，跟随系统主题实时变化
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (event) => {
        if (localStorage.getItem(STORAGE_KEY) === null) {
          isDark.value = event.matches
        }
      })
  }

  /** 切换暗/亮（仅显式切换时持久化） */
  function toggle(): void {
    isDark.value = !isDark.value
    // localStorage 为空代表继续跟随系统；有值则固定为用户选择
    localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
  }

  return { isDark, toggle }
}
