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
    // savedPosition 只在 popstate（浏览器返回/前进）时存在
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})
