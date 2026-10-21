// ============================================================
// 根组件：全站外壳（顶栏 + 路由出口）
// - 顶栏全站固定（VitePress 惯例：64px + 底部分隔线）
// - 搜索改为顶栏弹窗，本组件不再持有搜索词
// - 文档标题跟随路由：多开标签页时能一眼分清是哪个案例（本地速查站高频场景）
// - 提供跳过导航的快捷链接：键盘用户不必每次 Tab 过整条顶栏
// ============================================================
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import { useCodeTheme } from './composables/useCodeTheme'
import { categories } from './examples/categories'
import { getCase } from './examples/registry'

// 代码块暗色主题全站只初始化一次（代码区与 notes 共用）
useCodeTheme()

const route = useRoute()

/** 站点名：所有标题的统一后缀 */
const SITE_NAME = 'Vue 3 案例库'

/**
 * 当前路由对应的文档标题
 * - 详情页：案例标题 + 分类，便于多标签页辨认
 * - 列表/首页：固定文案
 */
const pageTitle = computed(() => {
  if (route.name === 'case') {
    const item = getCase(
      String(route.params.categoryId),
      String(route.params.caseId),
    )
    if (!item) return `案例不存在 · ${SITE_NAME}`

    const categoryName
      = categories.find((c) => c.id === item.categoryId)?.name
      ?? item.categoryId
    return `${item.meta.title} · ${categoryName} · ${SITE_NAME}`
  }

  if (route.name === 'case-list') return `案例库 · ${SITE_NAME}`
  if (route.name === 'not-found') return `页面不存在 · ${SITE_NAME}`
  return SITE_NAME
})

// 标题在导航完成后同步写入：immediate 保证首屏/刷新也对
watch(
  pageTitle,
  (title) => {
    document.title = title
  },
  { immediate: true },
)
</script>

<template>
  <div class="app-layout">
    <!-- 跳过导航：正常情况下视觉隐藏，键盘聚焦后出现在左上角 -->
    <a
      class="skip-link"
      href="#main-content"
    >跳到主内容</a>

    <!-- 全站顶栏（搜索弹窗由顶栏内部管理） -->
    <AppHeader />

    <main
      id="main-content"
      class="app-main"
      tabindex="-1"
    >
      <!-- 路由出口：首页 landing / 案例列表 / 案例详情 -->
      <!-- 页面切换只做淡入淡出：不加位移，避免影响详情页吸顶与固定按钮 -->
      <RouterView v-slot="{ Component, route: viewRoute }">
        <Transition
          name="page"
          mode="out-in"
        >
          <component
            :is="Component"
            :key="viewRoute.path"
          />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
/* 整站高度撑满视口：顶栏固定，主体区自适应滚动 */
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  /* 兜底：任何子内容（如超宽代码表）溢出都不产生页面级横向滚动 */
  overflow-x: clip;
}

/* 主体容器：保持原来的 flex 纵向布局语义（各页面依赖父级 flex column） */
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* tabindex="-1" 聚焦时不显示焦点环（只有程序聚焦用） */
  outline: none;
}

/* 跳转链接：默认移出视口，聚焦时滑入 */
.skip-link {
  position: fixed;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 100;
  padding: 0.5rem 0.9rem;
  font-size: 0.85rem;
  color: #fff;
  background-color: var(--primary);
  border-radius: var(--radius-btn);
  box-shadow: var(--shadow-soft-lg);
  transform: translateY(-200%);
  transition: transform 0.16s var(--ease-out);
}

.skip-link:focus-visible {
  transform: translateY(0);
  outline: 2px solid var(--text);
  outline-offset: 2px;
}
</style>
