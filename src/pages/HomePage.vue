// ============================================================
// 项目介绍首页（landing，参照 VueUse/VitePress home layout）
// - hero：项目名 + 一句话定位 + CTA「开始查阅」
// - 特性卡片网格
// - 无侧边栏（全宽排版）
// ============================================================
<script setup lang="ts">
// 特性卡片数据（图标 + 标题 + 描述，参照 VueUse features 区）
const features = [
  {
    icon: '🎮',
    title: '可交互演示',
    desc: '每个案例都是可操作的实验台，点一点观察指标变化，不是静态截图',
  },
  {
    icon: '💬',
    title: '中文注释代码',
    desc: '核心代码逐行中文注释，关键行高亮标记，复制即可用',
  },
  {
    icon: '📋',
    title: '复制即用',
    desc: '展示代码抓重点（★ 行高亮），完整源码一键复制直接粘贴到项目用',
  },
  {
    icon: '🧩',
    title: '零成本扩展',
    desc: '按约定目录放置 Demo.vue + meta.ts 自动收录，无需注册接线',
  },
  {
    icon: '🌙',
    title: '暗色模式',
    desc: '全站暗色适配，代码高亮主题跟随切换，偏好本地持久化',
  },
  {
    icon: '⚡',
    title: '性能与 Vue 3 进阶',
    desc: 'PerformanceObserver、虚拟列表、响应式陷阱等高频进阶主题',
  },
]
</script>

<template>
  <div class="home-page">
    <!-- Hero 区：项目名 + 定位 + CTA（VueUse home 布局惯例） -->
    <section class="hero">
      <h1 class="hero-title">
        Vue 3 案例库
      </h1>
      <p class="hero-tagline">
        高级用法速查站——可交互演示 + 逐行中文注释代码 + 完整源码
      </p>

      <div class="hero-actions">
        <!-- 唯一 CTA：进入案例库 -->
        <RouterLink
          class="btn-primary hero-cta"
          to="/cases"
        >
          开始查阅
        </RouterLink>
      </div>
    </section>

    <!-- 特性卡片网格（参照 VitePress VPFeatures） -->
    <section
      class="features"
      aria-label="项目特性"
    >
      <article
        v-for="f in features"
        :key="f.title"
        class="feature-card"
      >
        <div
          class="feature-icon"
          aria-hidden="true"
        >
          {{ f.icon }}
        </div>
        <h2 class="feature-title">
          {{ f.title }}
        </h2>
        <p class="feature-desc">
          {{ f.desc }}
        </p>
      </article>
    </section>
  </div>
</template>

<style scoped>
/* landing 布局：与案例页/列表页同一宽度轴（max-width 72rem + 水平 padding 2rem） */
.home-page {
  flex: 1;
  padding: 3rem 2rem 5rem;
}

/* ---------- Hero ---------- */

.hero {
  text-align: center;
  max-width: 44rem;
  margin: 0 auto 4rem;
}

.hero-title {
  font-size: 2.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 1rem;
}

.hero-tagline {
  font-size: 1.125rem;
  color: var(--text-secondary);
  line-height: 1.8;
  margin-bottom: 2rem;
}

.hero-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* CTA 按钮稍大（landing 主操作） */
.hero-cta {
  padding: 0.65em 1.6em;
  font-size: 1rem;
}

/* ---------- 特性网格 ---------- */

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  /* 与 home-page 同宽轴（外层已有 padding，此处不再额外限宽） */
  max-width: 72rem;
  margin: 0 auto;
}

.feature-card {
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background-color: var(--surface);
  transition:
    box-shadow var(--transition),
    transform var(--transition);
}

.feature-card:hover {
  box-shadow: var(--shadow-soft-lg);
  transform: translateY(-2px);
}

.feature-icon {
  font-size: 1.5rem;
  margin-bottom: 0.75rem;
}

.feature-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.feature-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0;
}

/* 小屏：特性网格降为单列 */
@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }

  .features {
    grid-template-columns: 1fr;
  }
}
</style>
