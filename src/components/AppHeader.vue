// ============================================================
// 全站顶栏（VitePress 规格：64px 高 + 底部 1px 分隔线）
// 左：站点名（回首页）+「案例」导航；右：搜索入口 + 暗色切换
// 搜索为全局弹窗：点击入口或按 Ctrl / Cmd + K 打开
// ============================================================
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import SearchBox from './SearchBox.vue'
import SearchModal from './SearchModal.vue'
import ThemeToggle from './ThemeToggle.vue'

/** 搜索弹窗开关（本组件持有，弹窗与入口都受控） */
const searchOpen = ref(false)

/**
 * 全局快捷键：Ctrl + K（macOS 为 Cmd + K）打开搜索
 * 输入框内也允许触发，与主流文档站一致
 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchOpen.value = true
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})
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
        <SearchBox @open="searchOpen = true" />
        <ThemeToggle />
      </div>
    </div>

    <!-- 搜索弹窗：Teleport 到 body，不受顶栏层叠上下文影响 -->
    <SearchModal
      :open="searchOpen"
      @close="searchOpen = false"
    />
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
  /* 允许工具区在窄屏收缩，搜索框由自身 min-width: 0 让出空间 */
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* ---------- 主导航 ---------- */

.header-nav {
  display: flex;
  flex-shrink: 0;
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
  flex-shrink: 0;
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

/* 窄屏（含 375px）：收紧留白并隐藏站点名文字，只保留 logo，
   把宽度让给搜索框，避免顶栏横向溢出 */
@media (max-width: 560px) {
  .header-inner {
    padding: 0 1rem;
    gap: 0.5rem;
  }

  .site-name {
    display: none;
  }

  .header-tools {
    gap: 0.5rem;
  }
}
</style>
