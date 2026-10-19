// ============================================================
// 案例页：标题区 + 演示卡 + 代码工作台 + 说明
// 数据来源：路由参数 → registry.getCase 查找
// ============================================================
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getCase } from '../examples/registry'
import CodeWorkbench from '../components/CodeWorkbench.vue'
import CaseNotes from '../components/CaseNotes.vue'

const route = useRoute()

// 路由参数查找案例（不存在时下方渲染空状态）
const item = computed(() =>
  getCase(String(route.params.categoryId), String(route.params.caseId)),
)

/** 难度 → tag 语义色映射（与 _components.scss 的 .tag--* 对应） */
const difficultyClass = computed(() => {
  const map = {
    beginner: 'tag--success',
    intermediate: 'tag--warning',
    advanced: 'tag--danger',
  } as const
  return map[item.value?.meta.difficulty ?? 'beginner']
})

/** 难度中文文案 */
const difficultyLabel = computed(() => {
  const map = {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高级',
  } as const
  return map[item.value?.meta.difficulty ?? 'beginner']
})
</script>

<template>
  <div class="case-page">
    <!-- 空状态：案例不存在（错误 URL / 已删除） -->
    <div
      v-if="!item"
      class="case-empty"
    >
      <h1>案例不存在</h1>
      <p>请从左侧导航选择一个案例，或返回首页。</p>
      <RouterLink
        class="btn-primary"
        to="/"
      >
        返回首页
      </RouterLink>
    </div>

    <template v-else>
      <!-- 页头：标题 + 难度 + API 标签 -->
      <header class="case-header">
        <h1 class="case-title">
          {{ item.meta.title }}
        </h1>
        <div class="case-meta">
          <span
            class="tag"
            :class="difficultyClass"
          >{{ difficultyLabel }}</span>
          <span
            v-for="tag in item.meta.tags"
            :key="tag"
            class="tag tag--primary"
          >
            {{ tag }}
          </span>
        </div>
        <p class="case-summary">
          {{ item.meta.summary }}
        </p>
      </header>

      <!-- ① 演示区：动态渲染案例 Demo 组件（卡片容器） -->
      <section aria-label="可交互演示">
        <h2 class="section-title">
          演示
        </h2>
        <div class="card demo-card">
          <component :is="item.demoComponent" />
        </div>
      </section>

      <!-- ② 代码区：核心代码 + 完整源码 -->
      <section aria-label="核心代码">
        <h2 class="section-title">
          代码
        </h2>
        <CodeWorkbench
          :tabs="item.codeTabs"
          :demo-source="item.demoSource"
        />
      </section>

      <!-- ③ 说明区：三段 Markdown -->
      <section aria-label="原理说明">
        <h2 class="section-title">
          说明
        </h2>
        <CaseNotes :notes="item.meta.notes" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.case-page {
  max-width: 56rem; /* 限制正文行宽，长行阅读更舒适 */
  margin: 0 auto;
  padding: 2rem 2rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

/* 空状态居中 */
.case-empty {
  text-align: center;
  padding: 4rem 0;

  p {
    color: var(--text-secondary);
    margin-bottom: 1.25rem;
  }
}

.case-title {
  font-size: 1.6rem;
  margin-bottom: 0.5rem;
}

.case-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.case-summary {
  color: var(--text-secondary);
  margin: 0;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

/* 演示卡片内边距（Demo 自身样式之外的容器留白） */
.demo-card {
  padding: 1.5rem;
}
</style>
