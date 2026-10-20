# 路由级 RBAC 权限

## 1. 现象与场景

后台菜单手写一份、路由守卫又写一份，改权限时两头不同步；无权限用户直接输 URL 还能进页面。

复现：切换 guest / editor / admin 三种角色，菜单与可访问页面同步变化；锁定项显示 🔒。

## 2. 原理

路由表是权限的唯一真源：每条路由的 `meta.roles` 声明哪些角色可进（游客也要显式列出）。全局守卫在跳转前判断登录态与角色，无权限直接重定向到 403/首页，而不是先放行再在页面里判断。

菜单从同一份路由表过滤生成，避免「菜单一套规则、守卫一套规则」漂移。按钮级权限用权限码判断；更细的后台用 `addRoute` 按后端返回动态注册，退出登录要 `removeRoute` 清理。

## 3. 关键代码

```ts
export const routes = [
  {
    path: '/dashboard',
    component: Dashboard,
    // 1. meta.roles 是权限唯一声明处
    meta: { roles: ['admin', 'editor', 'guest'] },
  },
  { path: '/users', component: Users, meta: { roles: ['admin'] } },
]

router.beforeEach((to) => {
  const user = useUserStore()
  if (!user.isLogin && to.path !== '/login') {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  // 2. 无权限在跳转前拦下，别放行后再判断
  const allowed = (to.meta.roles as string[] | undefined) ?? []
  if (allowed.length && !allowed.includes(user.role)) return { path: '/403' }
})

// 3. 菜单与路由同源，避免两套规则漂移
const menus = computed(() =>
  routes.filter((r) => r.meta?.title).filter((r) => {
    const roles = (r.meta?.roles as string[] | undefined) ?? []
    return roles.length === 0 || roles.includes(user.role)
  }),
)
```

## 4. 数据对比

| 角色 | 可见菜单 | 可访问页面 |
|---|---|---|
| guest | 1（工作台） | 工作台 |
| editor | 2（工作台 + 文章管理） | 工作台、文章 |
| admin | 4（全部） | 全部 |

测量方式：Chrome headless 1200×900 切换三种角色，读取菜单项与锁定标记；访问被锁页面观察重定向。角色与路由配置来自 Demo。

## 5. 追问与边界

**Q：前端权限安全吗？**
不安全。前端只控制「看不看得到」，接口必须二次校验；攻击者可以直接调接口。

**Q：为什么菜单不手写？**
手写会出现「菜单隐藏了但路由还能进」或反之；从路由表过滤保证同源。

**Q：`addRoute` 后退出登录要注意什么？**
必须 `removeRoute` 清理动态路由，否则换账号后权限串号。

坑：守卫里做重活（每次跳转都跑）会拖慢导航；权限数据登录后提前拉取。边界：403 页面必须存在且能返回；角色切换后菜单与按钮要重算，路由 meta 不会自动变。
