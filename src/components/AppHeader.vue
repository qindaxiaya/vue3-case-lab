// ============================================================
// 顶栏：站点名 + 搜索框 + 暗色切换
// 搜索词通过 v-model 与父组件（App.vue）双向共享
// ============================================================
<script setup lang="ts">
import SearchBox from './SearchBox.vue'
import ThemeToggle from './ThemeToggle.vue'

// 搜索词双向绑定（父组件持有状态并联动侧边栏过滤）
const searchQuery = defineModel<string>('query', { default: '' })
</script>

<template>
  <header class="app-header">
    <!-- 站点名：点击回首页 -->
    <RouterLink
      to="/"
      class="site-title"
    >
      Vue 3 案例库
    </RouterLink>

    <!-- 搜索 + 主题切换靠右 -->
    <div class="header-right">
      <SearchBox v-model="searchQuery" />
      <ThemeToggle />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background-color: var(--surface);
  border-bottom: 1px solid var(--border);
  /* 吸顶：滚动时保持可见 */
  position: sticky;
  top: 0;
  z-index: 10;
}

.site-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

.site-title:hover {
  color: var(--primary);
  text-decoration: none;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  justify-content: flex-end;
}
</style>
