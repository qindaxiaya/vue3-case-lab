// ============================================================
// 根组件：全站外壳（顶栏 + 路由出口）
// - 顶栏全站固定（VitePress 惯例：64px + 底部分隔线）
// - 搜索词状态在此持有，provide 给案例列表页（CaseListPage）过滤
// ============================================================
<script setup lang="ts">
import { provide, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'

// 全站共享搜索词：顶栏输入 → 列表页过滤（provide/inject 跨层传递）
const searchQuery = ref('')
provide('searchQuery', searchQuery)
</script>

<template>
  <div class="app-layout">
    <!-- 全站顶栏（v-model 双向绑定搜索词） -->
    <AppHeader v-model:query="searchQuery" />

    <!-- 路由出口：首页 landing / 案例列表 / 案例详情 -->
    <RouterView />
  </div>
</template>

<style scoped>
/* 整站高度撑满视口：顶栏固定，主体区自适应滚动 */
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
</style>
