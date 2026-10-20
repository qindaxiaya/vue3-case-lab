// ============================================================
// 主题切换按钮：自绘太阳 / 月亮图标 + aria-label
// 用 SVG 代替 emoji，避免不同系统显示成完全不同的图形
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
    <svg
      v-if="isDark"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="4.2"
        stroke="currentColor"
        stroke-width="1.7"
      />
      <path
        d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
      />
    </svg>
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 14.4A8.2 8.2 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4Z"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<style scoped>
/* 紧凑图标按钮：固定正方形，避免不同图标宽度导致跳动 */
.theme-toggle {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: var(--radius-btn);
}

.theme-toggle svg {
  width: 18px;
  height: 18px;
  transition: transform var(--transition);
}

.theme-toggle:hover svg {
  transform: rotate(-14deg) scale(1.08);
}

.theme-toggle:active svg {
  transform: scale(0.86);
}

@media (max-width: 560px) {
  .theme-toggle {
    width: 34px;
    height: 34px;
  }
}
</style>
