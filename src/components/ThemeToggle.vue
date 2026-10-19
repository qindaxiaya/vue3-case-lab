// ============================================================
// 主题切换按钮：太阳/月亮图标 + aria-label
// ============================================================
<script setup lang="ts">
import { useTheme } from '../composables/useTheme'

// 从 composable 取响应式状态与切换函数
const { isDark, toggle } = useTheme()
</script>

<template>
  <button
    class="btn-ghost theme-toggle"
    type="button"
    :aria-label="isDark ? '切换到浅色模式' : '切换到暗色模式'"
    @click="toggle"
  >
    <!-- 暗色时显示太阳（点击回浅色），浅色时显示月亮 -->
    <span aria-hidden="true">{{ isDark ? '☀️' : '🌙' }}</span>
  </button>
</template>

<style scoped>
/* 紧凑图标按钮：正方形、去内边距 */
.theme-toggle {
  padding: 0.45em;
  border-radius: var(--radius-btn);
  font-size: 1rem;
}
</style>
