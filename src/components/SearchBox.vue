// ============================================================
// 搜索框：输入即触发过滤回调，父组件联动侧边栏/列表
// ============================================================
<script setup lang="ts">
// 定义 props + emits 契约（defineModel 需要 modelValue 双向绑定）
const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="search-box">
    <!-- 语义化 label 仅供读屏，视觉隐藏 -->
    <label
      class="sr-only"
      for="case-search"
    >搜索案例</label>
    <input
      id="case-search"
      v-model="model"
      class="search-input"
      type="search"
      placeholder="搜索案例、标签……"
      autocomplete="off"
    >
    <!-- 装饰性图标，读屏忽略 -->
    <span
      class="search-icon"
      aria-hidden="true"
    >🔍</span>
  </div>
</template>

<style scoped>
.search-box {
  position: relative;
  flex: 1;
  /* 允许收缩到 0：否则 input 的固有宽度会顶破 375px 顶栏 */
  min-width: 0;
  max-width: 20rem;
}

.search-input {
  width: 100%;
  padding: 0.45em 0.9em 0.45em 2.2em; /* 左侧留出图标位 */
  font-family: inherit;
  font-size: 0.9rem;
  color: var(--text);
  background-color: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  transition: border-color var(--transition);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-input:focus {
  outline: none; /* 焦点环由外框统一表现 */
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.search-icon {
  position: absolute;
  left: 0.7em;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8rem;
  pointer-events: none; /* 不拦截点击 */
  opacity: 0.6;
}
</style>
