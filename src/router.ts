// ============================================================
// 路由配置（2026-10-19 二次简化：侧边栏已删除）
// - /                              → 项目介绍首页
// - /cases                         → 案例列表页（全宽 + 分类筛选）
// - /cases/:categoryId/:caseId     → 案例详情页（面包屑返回列表）
// - /c/:categoryId/:caseId         → 兼容旧链接，重定向
// ============================================================
import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import CaseListPage from './pages/CaseListPage.vue'
import CasePage from './pages/CasePage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 项目介绍首页（landing）
    { path: '/', name: 'home', component: HomePage },

    // 案例列表（无嵌套布局——侧边栏方案已废弃）
    { path: '/cases', name: 'case-list', component: CaseListPage },

    // 案例详情
    {
      path: '/cases/:categoryId/:caseId',
      name: 'case',
      component: CasePage,
    },

    // 旧路径兼容：/c/xxx → /cases/xxx（已在书签/历史中的链接不断）
    {
      path: '/c/:categoryId/:caseId',
      redirect: (to) => `/cases/${to.params.categoryId}/${to.params.caseId}`,
    },

    // 未知路径回首页
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // 页面切换回顶部；浏览器前进/后退时恢复原滚动位置
  scrollBehavior(_to, _from, savedPosition) {
    // 新页面导航：直接回到顶部
    if (!savedPosition) return { top: 0 }

    // savedPosition 只在 popstate（浏览器返回/前进）时存在。
    // 坑一：浏览器在 popstate 当下会先按「当前详情页」的高度恢复一次，
    // 1200px 会被截断成详情页的最大可滚动值（如 490px），Vue Router 拿到的
    // savedPosition 可能已经是这个错误值。history.state.scroll 才是离开时写入的原始位置。
    // 坑二：App.vue 的 out-in 过渡让旧页面多停留约 280ms（140ms 离场 + 140ms 入场），
    // 立刻滚动也会被旧页面高度截断。故等过渡结束再恢复。
    const raw = window.history.state?.scroll as
      | { left?: number; top?: number }
      | null
      | undefined
    const target = raw ?? savedPosition

    // 不能只等固定时长：开启「减少动态」时过渡接近 0ms，但新页面仍要等一帧才挂载；
    // 固定 320ms 又会让普通动画多等。改为等「新页面的可滚动高度足够」再恢复，
    // 既避开旧页面高度截断，也不会平白拖慢。
    // behavior: instant 避免全局 CSS smooth 再缓动一次，和过渡抢时间。
    return new Promise((resolve) => {
      const top = target.top ?? 0
      const started = performance.now()
      const maxScrollTop = (): number =>
        document.documentElement.scrollHeight - window.innerHeight

      const tryRestore = (): void => {
        // 新页面已渲染到能容纳目标位置；超时兜底避免新页面本身更短时一直等
        if (maxScrollTop() >= top || performance.now() - started > 600) {
          resolve({ ...target, behavior: 'instant' })
          return
        }
        window.requestAnimationFrame(tryRestore)
      }

      window.requestAnimationFrame(tryRestore)
    })
  },
})
