// ============================================================
// 根组件：站点壳布局
// ┌─────────────────────────────┐
// │ 顶栏（站点名+搜索+主题切换）  │
// ├──────────┬──────────────────┤
// │ 侧边栏    │   router-view    │
// └──────────┴──────────────────┘
// 搜索词状态在此持有，通过 props 下发侧边栏
// ============================================================
<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'

// 全站共享的搜索词（顶栏输入 → 侧边栏过滤）
const searchQuery = ref('')
</script>

<template>
  <div class="app-layout">
    <!-- 顶栏：v-model 双向绑定搜索词 -->
    <AppHeader v-model:query="searchQuery" />

    <div class="app-body">
      <!-- 侧边栏：接收搜索词做联动过滤 -->
      <AppSidebar :query="searchQuery" />

      <!-- 路由出口：首页 / 案例页 -->
      <main class="app-main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* 整站高度撑满视口：顶栏固定高，主体区自适应滚动 */
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-body {
  display: flex;
  flex: 1;
  min-height: 0; /* 允许子项收缩，配合 overflow 实现侧边栏独立滚动 */
}

.app-main {
  flex: 1;
  min-width: 0; /* 防止代码块等宽内容撑破布局 */
  overflow-y: auto;
}
</style>
