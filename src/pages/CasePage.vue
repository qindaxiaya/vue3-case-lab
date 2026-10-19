// ============================================================
// 案例详情页（/cases/:categoryId/:caseId）
// 结构：面包屑 → 页头（标题+难度+标签）→ 演示区 → 代码区 → 说明区
// 侧边栏已删除：顶部面包屑提供返回列表的导航路径
// ============================================================
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { categories } from '../examples/categories'
import { getCase } from '../examples/registry'
import CodeWorkbench from '../components/CodeWorkbench.vue'
import CaseNotes from '../components/CaseNotes.vue'

const route = useRoute()

// 路由参数查找案例（不存在渲染空状态）
const item = computed(() =>
  getCase(String(route.params.categoryId), String(route.params.caseId)),
)

/** 当前分类展示名（面包屑用，找不到回退为原始 id） */
const categoryName = computed(
  () =>
    categories.find((c) => c.id === route.params.categoryId)?.name ??
    String(route.params.categoryId),
)

/** 难度 → tag 语义色类 */
const difficultyClass = computed(() => {
  const map = {
    beginner: 'tag--success',
    intermediate: 'tag--warning',
    advanced: 'tag--danger',
  } as const
  return map[item.value?.meta.difficulty ?? 'beginner']
})

/** 难度 → 中文文案 */
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
    <!-- 空状态：案例不存在 -->
    <div
      v-if="!item"
      class="case-empty"
    >
      <h1>案例不存在</h1>
      <p>请从左侧导航选择一个案例，或返回案例列表。</p>
      <RouterLink
        class="btn-primary"
        to="/cases"
      >
        返回案例库
      </RouterLink>
    </div>

    <template v-else>
      <!-- 面包屑：案例库 / 分类 / 当前案例（侧边栏替代的返回路径） -->
      <nav
        class="crumbs"
        aria-label="面包屑"
      >
        <RouterLink
          to="/cases"
          class="crumb-link"
        >
          案例库
        </RouterLink>
        <span
          class="crumb-sep"
          aria-hidden="true"
        >/</span>
        <span>{{ categoryName }}</span>
        <span
          class="crumb-sep"
          aria-hidden="true"
        >/</span>
        <span
          class="crumb-current"
          aria-current="page"
        >{{ item.meta.title }}</span>
      </nav>

      <!-- 页头：标题 + 难度/标签一行 + 摘要（文档站紧凑规格） -->
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

      <!-- ① 演示区 -->
      <section aria-label="可交互演示">
        <h2 class="section-title">
          演示
        </h2>
        <div class="card demo-card">
          <component :is="item.demoComponent" />
        </div>
      </section>

      <!-- ② 代码区（重点行高亮） -->
      <section aria-label="核心代码">
        <h2 class="section-title">
          代码
          <span
            class="section-hint"
            aria-hidden="true"
          >★ 标记行为重点行</span>
        </h2>
        <CodeWorkbench
          :tabs="item.codeTabs"
          :demo-source="item.demoSource"
        />
      </section>

      <!-- ③ 说明区（callout 重点突出） -->
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
  /* 纵向节奏 + 限宽（与列表页同级全宽容器内的正文列） */
  max-width: 72rem;
  margin: 0 auto;
  padding: 2rem 2rem 5rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* ---------- 面包屑 ---------- */

.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.crumb-link {
  color: var(--text-secondary);

  &:hover {
    color: var(--primary);
    text-decoration: none;
  }
}

.crumb-sep {
  opacity: 0.5;
}

.crumb-current {
  color: var(--text);
  font-weight: 500;
}

/* 空状态 */
.case-empty {
  text-align: center;
  padding: 4rem 0;

  p {
    color: var(--text-secondary);
    margin-bottom: 1.25rem;
  }
}

/* 页头：文档页 h1 规格 */
.case-title {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 0.6rem;
}

.case-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.65rem;
}

.case-summary {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.7;
  margin: 0;
}

/* 区块小标题（演示/代码/说明） */
.section-title {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  font-size: 1.125rem;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.45rem;
  margin-bottom: 1rem;
}

/* 代码区标题旁的重点行提示 */
.section-hint {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-secondary);
}

/* 演示卡容器留白 */
.demo-card {
  padding: 1.5rem;
}
</style>
