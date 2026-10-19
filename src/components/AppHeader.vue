// ============================================================
// 全站顶栏（VitePress 规格：64px 高 + 底部 1px 分隔线）
// 左：站点名（回首页）+「案例」导航；右：搜索框 + 暗色切换
// ============================================================
<script setup lang="ts">
import SearchBox from './SearchBox.vue'
import ThemeToggle from './ThemeToggle.vue'

// 搜索词双向绑定（App.vue 持有并 provide 给案例列表页过滤）
const searchQuery = defineModel<string>('query', { default: '' })
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <!-- 站点名：VitePress 风格 logo 位 + 文字 -->
      <RouterLink
        to="/"
        class="site-brand"
      >
        <span
          class="site-logo"
          aria-hidden="true"
        >📦</span>
        <span class="site-name">Vue 3 案例库</span>
      </RouterLink>

      <!-- 主导航：侧边栏删除后的主要入口 -->
      <nav
        class="header-nav"
        aria-label="主导航"
      >
        <RouterLink
          to="/cases"
          class="nav-link"
        >
          案例
        </RouterLink>
      </nav>

      <!-- 右侧工具区 -->
      <div class="header-tools">
        <SearchBox v-model="searchQuery" />
        <ThemeToggle />
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  /* 固定高 + 底部分隔线（VitePress nav 规格） */
  height: 64px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background-color: var(--surface);
  position: sticky;
  top: 0;
  z-index: 20;
}

.header-inner {
  height: 100%;
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* 右侧工具区推到最右（品牌+导航居左，VitePress nav 惯例） */
.header-tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* ---------- 主导航 ---------- */

.header-nav {
  display: flex;
  gap: 0.25rem;
}

.nav-link {
  /* 顶栏高度内垂直居中、左右留白 */
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 0.75rem;
  border-radius: var(--radius-btn);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition:
    color var(--transition),
    background-color var(--transition);
}

.nav-link:hover {
  color: var(--primary);
  background-color: var(--primary-soft);
}

/* 当前导航项：RouterLink 匹配前缀即加此 class（详情页也保持高亮） */
.nav-link.router-link-active {
  color: var(--primary);
  background-color: var(--primary-soft);
}

.site-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.site-brand:hover {
  color: var(--primary);
  text-decoration: none;
}

.site-logo {
  font-size: 1.25rem;
}
</style>
