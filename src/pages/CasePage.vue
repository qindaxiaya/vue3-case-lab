// ============================================================
// 案例页（Task 4 正式实现：演示卡 + 代码工作台 + 说明）
// ============================================================
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getCase } from '../examples/registry'

const route = useRoute()

// 从路由参数查找已注册案例
const item = computed(() =>
  getCase(String(route.params.categoryId), String(route.params.caseId)),
)
</script>

<template>
  <div class="case-placeholder">
    <template v-if="item">
      <h1>{{ item.meta.title }}</h1>
      <p>案例页组件建设中……</p>
    </template>
    <template v-else>
      <h1>案例不存在</h1>
      <RouterLink to="/">
        返回首页
      </RouterLink>
    </template>
  </div>
</template>

<style scoped>
.case-placeholder {
  padding: 2rem;
}
</style>
