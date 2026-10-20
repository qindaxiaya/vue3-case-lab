// ============================================================
// 案例详情页（/cases/:categoryId/:caseId）
// 结构：面包屑 → 页头（标题+难度+标签）→ 演示区 → 代码区
// 代码区两个 tab：展示代码（重点行高亮）+ 可复制源码（复制即用）
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { categories } from '../examples/categories'
import { getCase } from '../examples/registry'
import CodeWorkbench from '../components/CodeWorkbench.vue'

const route = useRoute()
const router = useRouter()

// 演示 tab：集合由 Demo 组件 emit('tabs') 上报，当前 key 由本页持有
// 每个标签 = 一套完整案例（演示 + 对应展示代码，代码区按同 key 过滤联动）
// 无多演示的案例不上报，保持空数组（标题行不出 tab）
const demoTabs = ref<{ key: string; label: string }[]>([])
const activeDemoKey = ref('')

/** Demo 上报 tab 集合：记录并定位到初始 key */
function onDemoTabs(
  tabs: { key: string; label: string }[],
  initial: string,
): void {
  demoTabs.value = tabs
  activeDemoKey.value = initial
}

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

// ============================================================
// 返回列表：优先走浏览器历史，才能恢复原来的滚动位置
// ============================================================

/**
 * 返回案例列表
 * - 上一条历史正是列表页 → router.back()（触发 scrollBehavior 的 savedPosition）
 * - 否则（直接打开详情/从首页进入）→ push 到列表
 */
function backToList(): void {
  // Vue Router 4 会把上一条路径写进 history.state.back
  const back = window.history.state?.back as string | undefined
  if (back && (back === '/cases' || back.startsWith('/cases?'))) {
    router.back()
  } else {
    void router.push('/cases')
  }
}

// ============================================================
// 案例说明：自动从教学代码的 //! 重点行提取要点
// ============================================================

const keyPoints = computed<string[]>(() => {
  if (!item.value) return []

  const points: string[] = []
  const seen = new Set<string>()

  for (const tab of item.value.codeTabs) {
    for (const line of tab.content.split('\n')) {
      // 与代码区同一套约定：行首 //! 是重点行
      const match = line.match(/^\s*\/\/!\s?(.+)$/)
      if (!match) continue

      const text = match[1].trim()
      // 过滤过短/过长的行，避免把零散标记当要点
      if (text.length < 8 || text.length > 120) continue
      if (seen.has(text)) continue

      seen.add(text)
      points.push(text)
    }
  }

  return points.slice(0, 8)
})

/** 源码默认关闭：先看演示与说明，需要时再展开 */
const showCode = ref(false)
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
      <!-- 返回条：返回按钮 + 面包屑（返回优先走历史，恢复列表滚动位置） -->
      <div class="case-toolbar">
        <button
          class="back-btn"
          type="button"
          @click="backToList"
        >
          <span aria-hidden="true">←</span>
          返回列表
        </button>

        <nav
          class="crumbs"
          aria-label="面包屑"
        >
          <button
            class="crumb-link"
            type="button"
            @click="backToList"
          >
            案例库
          </button>
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
      </div>

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
      <!-- ① 演示区：标题行携带演示 tab（每个标签 = 一套演示+代码） -->
      <section aria-label="可交互演示">
        <h2 class="section-title">
          演示
          <div
            v-if="demoTabs.length"
            class="demo-tab-list"
            role="tablist"
            aria-label="演示切换"
          >
            <button
              v-for="tab in demoTabs"
              :key="tab.key"
              class="demo-tab"
              :class="{ 'demo-tab--active': activeDemoKey === tab.key }"
              type="button"
              role="tab"
              :aria-selected="activeDemoKey === tab.key"
              @click="activeDemoKey = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
        </h2>

        <!-- 演示组件：@tabs 上报集合，demo-active 受控当前 key -->
        <div class="card demo-card">
          <component
            :is="item.demoComponent"
            :demo-active="activeDemoKey"
            @tabs="onDemoTabs"
          />
        </div>
      </section>

      <!-- ② 案例说明：先讲清楚「为什么看、看什么」，源码按需展开 -->
      <section aria-label="案例说明">
        <h2 class="section-title">
          说明
        </h2>

        <div class="card note-card">
          <div class="note-sell">
            <span class="note-sell-label">为什么看</span>
            <p class="note-sell-text">
              {{ item.meta.sell }}
            </p>
          </div>

          <!-- 要点自动取自教学代码的 //! 重点行，不额外维护文案 -->
          <ul
            v-if="keyPoints.length"
            class="note-points"
          >
            <li
              v-for="point in keyPoints"
              :key="point"
            >
              {{ point }}
            </li>
          </ul>

          <p class="note-foot">
            共 {{ item.codeTabs.length }} 段教学代码 · 难度 {{ difficultyLabel }} · 分类 {{ categoryName }}
          </p>
        </div>
      </section>

      <!-- ③ 源码区：默认收起，避免一进来就是大段代码 -->
      <section aria-label="源码">
        <h2 class="section-title">
          源码
          <button
            class="code-toggle"
            type="button"
            :aria-expanded="showCode"
            @click="showCode = !showCode"
          >
            {{ showCode ? '收起源码' : '展开源码' }}
          </button>
        </h2>

        <div v-show="showCode">
          <CodeWorkbench
            :tabs="item.codeTabs"
            :demo-source="item.demoSource"
            :demo-key="activeDemoKey"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.case-page {
  /* width:100% 必须显式声明：父级是 flex column，仅靠 max-width + margin:auto
     会禁用 stretch 而退化为 fit-content——页面宽度将随代码行内容实时变化
     （切「可复制源码」tab 时长行会把整页撑宽的根因） */
  width: 100%;
  max-width: 84rem;
  margin: 0 auto;
  padding: 2rem 2.5rem 5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* ---------- 返回条 ---------- */

.case-toolbar {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.34rem 0.8rem;
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    color var(--transition),
    border-color var(--transition),
    background-color var(--transition);

  &:hover {
    color: var(--primary);
    border-color: var(--primary);
    background-color: var(--primary-soft);
  }
}

/* ---------- 面包屑 ---------- */

.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.83rem;
  color: var(--text-secondary);
}

.crumb-link {
  padding: 0;
  font-size: inherit;
  font-family: inherit;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;

  &:hover {
    color: var(--primary);
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

/* 区块小标题（演示/说明/源码） */
.section-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.25rem;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
  margin-bottom: 1.1rem;
}

/* 源码展开/收起按钮 */
.code-toggle {
  margin-left: auto;
  padding: 0.28rem 0.8rem;
  font-size: 0.8rem;
  font-family: inherit;
  font-weight: 500;
  color: var(--primary);
  background-color: var(--primary-soft);
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  transition:
    color var(--transition),
    background-color var(--transition);

  &:hover {
    color: #fff;
    background-color: var(--primary);
  }
}

/* ---------- 演示 tab（标题行内） ---------- */

.demo-tab-list {
  display: flex;
  gap: 0.15rem;
}

.demo-tab {
  padding: 0.25rem 0.7rem;
  font-size: 0.8rem;
  font-family: inherit;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    color var(--transition),
    background-color var(--transition);
}

.demo-tab:hover {
  color: var(--text);
  background-color: var(--bg);
}

.demo-tab--active {
  color: var(--primary);
  font-weight: 500;
  background-color: var(--primary-soft);
}

/* 演示卡：宽屏下给足留白，避免显得局促 */
.demo-card {
  padding: 2rem 2.25rem;
}

/* ---------- 说明卡 ---------- */

.note-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.35rem 1.6rem;
}

.note-sell {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.note-sell-label {
  flex-shrink: 0;
  padding: 0.12rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--primary-soft-text);
  background-color: var(--primary-soft);
  border-radius: 999px;
}

.note-sell-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--text);
}

.note-points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 1.5rem;

  li {
    position: relative;
    padding-left: 1rem;
    font-size: 0.86rem;
    line-height: 1.65;
    color: var(--text-secondary);
    word-break: break-word;

    /* 主色圆点，弱化视觉重量 */
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0.55em;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background-color: var(--primary);
      opacity: 0.6;
    }
  }
}

.note-foot {
  margin: 0;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border);
  font-size: 0.76rem;
  color: var(--text-secondary);
}

/* ---------- 移动端 ---------- */

@media (max-width: 768px) {
  .case-page {
    padding: 1.5rem 1.25rem 3rem;
    gap: 1.5rem;
  }

  .demo-card {
    padding: 1.15rem;
  }

  .note-card {
    padding: 1.1rem;
  }

  .note-points {
    grid-template-columns: 1fr;
  }
}
</style>
