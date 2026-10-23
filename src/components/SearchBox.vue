// ============================================================
// 搜索入口：外观像输入框的按钮，点击由父组件打开搜索弹窗
// （真正的输入与结果展示在 SearchModal 中）
// ============================================================
<script setup lang="ts">
defineEmits<{
  /** 请求打开搜索弹窗 */
  (e: 'open'): void
}>()

// 快捷键文案跟随系统：Mac 显示 ⌘ K，其他平台显示 Ctrl K
const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
const shortcut = isMac ? '⌘ K' : 'Ctrl K'
</script>

<template>
  <button
    class="search-trigger"
    type="button"
    aria-label="打开搜索"
    @click="$emit('open')"
  >
    <svg
      class="search-icon"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="9"
        cy="9"
        r="5.25"
        stroke="currentColor"
        stroke-width="1.6"
      />
      <path
        d="m13 13 3.2 3.2"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    </svg>
    <span class="search-placeholder">搜索案例、标签或正文</span>
    <kbd
      class="search-kbd"
      aria-hidden="true"
    >{{ shortcut }}</kbd>
  </button>
</template>

<style scoped>
.search-trigger {
  flex: 1;
  /* 允许收缩到 0：否则固有宽度会顶破 375px 顶栏 */
  min-width: 0;
  max-width: 18.5rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.42em 0.55em 0.42em 0.8em;
  font-family: inherit;
  font-size: 0.86rem;
  text-align: left;
  color: var(--text-secondary);
  background-color: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition:
    border-color var(--transition),
    background-color var(--transition),
    color var(--transition),
    transform var(--transition);
}

.search-trigger:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
  background-color: var(--surface);

  .search-icon {
    color: var(--primary);
  }
}

.search-trigger:active {
  transform: scale(0.99);
}

.search-trigger:focus-visible {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.search-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  opacity: 0.75;
  transition: color var(--transition);
}

/* 占位文案：窄屏优先保留，超出省略 */
.search-placeholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 快捷键提示：窄屏隐藏，给输入框让位 */
.search-kbd {
  flex-shrink: 0;
  padding: 0.06rem 0.32rem;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  line-height: 1.5;
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.3rem;
}

@media (max-width: 560px) {
  .search-kbd {
    display: none;
  }

  .search-trigger {
    font-size: 0.82rem;
  }
}
</style>
