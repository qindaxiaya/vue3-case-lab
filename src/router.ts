// ============================================================
// 路由配置
// - /          → 首页（精选入口）
// - /c/:categoryId/:caseId → 案例页
// - 其余       → 重定向首页
// ============================================================
import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import CasePage from './pages/CasePage.vue'

export const router = createRouter({
  // history 模式（需要 dev/preview 正常回退；纯本地使用足够）
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    {
      path: '/c/:categoryId/:caseId',
      name: 'case',
      component: CasePage,
    },
    // 未知路径一律回首页，避免白屏
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // 页面切换滚动位置：回到顶部
  scrollBehavior() {
    return { top: 0 }
  },
})
