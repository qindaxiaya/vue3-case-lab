// ============================================================
// 根组件：全站外壳（顶栏 + 路由出口）
// - 顶栏全站固定（VitePress 惯例：64px + 底部分隔线）
// - 搜索改为顶栏弹窗，本组件不再持有搜索词
// ============================================================
<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
</script>

<template>
  <div class="app-layout">
    <!-- 全站顶栏（搜索弹窗由顶栏内部管理） -->
    <AppHeader />

    <!-- 路由出口：首页 landing / 案例列表 / 案例详情 -->
    <!-- 页面切换只做淡入淡出：不加位移，避免影响详情页吸顶与固定按钮 -->
    <RouterView v-slot="{ Component, route }">
      <Transition
        name="page"
        mode="out-in"
      >
        <component
          :is="Component"
          :key="route.path"
        />
      </Transition>
    </RouterView>
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
</style>
