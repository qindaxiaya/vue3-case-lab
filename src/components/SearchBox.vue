// ============================================================
// 搜索入口：外观像输入框的按钮，点击由父组件打开搜索弹窗
// （真正的输入与结果展示在 SearchModal 中）
// ============================================================
<script setup lang="ts">
defineEmits<{
  /** 请求打开搜索弹窗 */
  (e: 'open'): void
}>()
</script>

<template>
  <button
    class="search-trigger"
    type="button"
    aria-label="打开搜索"
    @click="$emit('open')"
  >
    <span
      class="search-icon"
      aria-hidden="true"
    >🔍</span>
    <span class="search-placeholder">搜索案例、标签……</span>
    <kbd class="search-kbd">Ctrl K</kbd>
  </button>
</template>

<style scoped>
.search-trigger {
  flex: 1;
  /* 允许收缩到 0：否则固有宽度会顶破 375px 顶栏 */
  min-width: 0;
  max-width: 20rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45em 0.7em 0.45em 0.9em;
  font-family: inherit;
  font-size: 0.9rem;
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
  border-color: var(--primary);
  background-color: var(--surface);
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
  font-size: 0.8rem;
  opacity: 0.6;
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
  padding: 0 0.3rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.25rem;
}

@media (max-width: 560px) {
  .search-kbd {
    display: none;
  }
}
</style>
