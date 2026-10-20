// ============================================================
// 全站顶栏（64px 高）
// 左：品牌标记 + 站名 +「案例」导航；右：搜索入口 + 主题切换
// 滚动后切半透明毛玻璃，让内容从顶栏下方「透」出来
// ============================================================
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import SearchBox from './SearchBox.vue'
import SearchModal from './SearchModal.vue'
import ThemeToggle from './ThemeToggle.vue'

/** 搜索弹窗开关（本组件持有，弹窗与入口都受控） */
const searchOpen = ref(false)
/** 页面是否已滚离顶部：决定顶栏是否加毛玻璃与投影 */
const scrolled = ref(false)

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

/** 滚动监听只关心「是否离开顶部」，用 boolean 避免频繁触发更新 */
function onScroll(): void {
  scrolled.value = window.scrollY > 4
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <header
    class="app-header"
    :class="{ 'app-header--scrolled': scrolled }"
  >
    <div class="header-inner">
      <!-- 品牌：自绘「层叠卡片」标记，比 emoji 在各系统上更稳定 -->
      <RouterLink
        to="/"
        class="site-brand"
        aria-label="Vue 3 案例库首页"
      >
        <span
          class="site-mark"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
          >
            <rect
              x="3.5"
              y="3.5"
              width="7"
              height="7"
              rx="2"
              fill="currentColor"
            />
            <rect
              x="13.5"
              y="3.5"
              width="7"
              height="7"
              rx="2"
              fill="currentColor"
              opacity="0.55"
            />
            <rect
              x="3.5"
              y="13.5"
              width="7"
              height="7"
              rx="2"
              fill="currentColor"
              opacity="0.55"
            />
            <rect
              x="13.5"
              y="13.5"
              width="7"
              height="7"
              rx="2"
              fill="currentColor"
            />
          </svg>
        </span>
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
  position: sticky;
  top: 0;
  z-index: 20;
  background-color: var(--surface);
  border-bottom: 1px solid var(--border);
  transition:
    background-color var(--transition),
    border-color var(--transition),
    box-shadow var(--transition);
}

/* 滚动后：半透明 + 毛玻璃，内容从顶栏下方透出层次 */
.app-header--scrolled {
  background-color: color-mix(in srgb, var(--surface) 82%, transparent);
  border-bottom-color: color-mix(in srgb, var(--border) 70%, transparent);
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.06);

  @supports (backdrop-filter: blur(1px)) {
    backdrop-filter: saturate(180%) blur(14px);
  }
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
  gap: 0.65rem;
}

/* ---------- 品牌 ---------- */

.site-brand {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.6rem;
  font-size: 1rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text);
}

/* 标记：主色渐变方块 + 层叠卡片线条，悬停轻抬 */
.site-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 9px;
  color: #fff;
  background: linear-gradient(145deg, var(--primary), #8b5cf6);
  box-shadow: 0 3px 8px rgb(79 70 229 / 0.24);
  transition:
    transform var(--transition),
    box-shadow var(--transition);

  svg {
    width: 20px;
    height: 20px;
  }
}

.site-brand:hover {
  color: var(--primary);
  text-decoration: none;

  .site-mark {
    transform: translateY(-1px) rotate(-2deg);
    box-shadow: 0 5px 12px rgb(79 70 229 / 0.3);
  }
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
  height: 34px;
  padding: 0 0.8rem;
  border-radius: var(--radius-btn);
  font-size: 0.88rem;
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

/* ---------- 窄屏 ---------- */

/* 375px：收紧留白并隐藏站名文字，只保留标记，
   把宽度让给搜索框，避免顶栏横向溢出 */
@media (max-width: 560px) {
  .header-inner {
    padding: 0 1rem;
    gap: 0.5rem;
  }

  .site-name {
    display: none;
  }

  .site-mark {
    width: 28px;
    height: 28px;
  }

  .header-tools {
    gap: 0.45rem;
  }
}
</style>
