// ============================================================
// 案例：路由级 RBAC 权限（route-rbac）
// 角色切换 → 菜单按 meta.roles 过滤 → 点击导航经过守卫校验
// 越权访问被拦截并记日志；切角色时自动重定向到第一个可访问页面
// ============================================================
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type Role = 'admin' | 'editor' | 'guest'
type MenuKey = 'dashboard' | 'articles' | 'users' | 'settings'

/** 角色 → 可访问的菜单（真实项目里来自后端返回的权限码） */
const ROLE_MENUS: Record<Role, MenuKey[]> = {
  admin: ['dashboard', 'articles', 'users', 'settings'],
  editor: ['dashboard', 'articles'],
  guest: ['dashboard'],
}

interface MenuItem {
  key: MenuKey
  path: string
  label: string
  icon: string
  roles: Role[]
}

/** 路由表：meta.roles 决定哪些角色可进 */
const routes: MenuItem[] = [
  { key: 'dashboard', path: '/dashboard', label: '工作台', icon: '🏠', roles: ['admin', 'editor', 'guest'] },
  { key: 'articles', path: '/articles', label: '文章管理', icon: '📝', roles: ['admin', 'editor'] },
  { key: 'users', path: '/users', label: '用户管理', icon: '👥', roles: ['admin'] },
  { key: 'settings', path: '/settings', label: '系统设置', icon: '⚙️', roles: ['admin'] },
]

const role = ref<Role>('guest')
const current = ref<MenuKey>('dashboard')
const logs = ref<string[]>([])

/** 角色选项（模板 v-for 用，避免模板内类型断言） */
const allRoles: Role[] = ['guest', 'editor', 'admin']

// ============================================================
// 权限计算
// ============================================================

/** 当前角色可见的菜单 */
const visibleMenus = computed(() =>
  routes.filter((r) => r.roles.includes(role.value)),
)

function canAccess(key: MenuKey): boolean {
  const item = routes.find((r) => r.key === key)
  return Boolean(item?.roles.includes(role.value))
}

function pushLog(msg: string): void {
  logs.value.unshift(msg)
  if (logs.value.length > 6) logs.value.pop()
}

// ============================================================
// 导航 + 守卫
// ============================================================

/**
 * 模拟 router.push：
 * //! 真实项目里这段在 router.beforeEach((to) => { if (!allowed) return '/403' })
 */
function navigate(key: MenuKey): void {
  const item = routes.find((r) => r.key === key)
  if (!item) return

  if (!canAccess(key)) {
    //! 守卫拦截：真实项目应重定向到 403 或首页
    pushLog(`⛔ 守卫拦截 ${item.path}（需要 ${item.roles.join(' / ')}，当前 ${role.value}）`)
    return
  }

  pushLog(`✅ 放行 ${item.path}`)
  current.value = key
}

// ============================================================
// 角色切换：菜单重算 + 越权重定向
// ============================================================

watch(role, (next) => {
  pushLog(`角色切换为 ${next}，菜单重算（${ROLE_MENUS[next].length} 项）`)
  //! 当前页面失效时重定向到第一个可访问路由
  if (!canAccess(current.value)) {
    const fallback = visibleMenus.value[0]
    if (fallback) {
      current.value = fallback.key
      pushLog(`↪ 当前页无权限，重定向到 ${fallback.path}`)
    }
  }
})

/** 当前页面信息 */
const currentRoute = computed(() => routes.find((r) => r.key === current.value))

function resetAll(): void {
  role.value = 'guest'
  current.value = 'dashboard'
  logs.value = []
}
</script>

<template>
  <div class="rbac-demo">
    <!-- 角色切换 -->
    <div class="rbac-roles">
      <span class="rbac-label">当前角色</span>
      <button
        v-for="r in allRoles"
        :key="r"
        class="seg-btn"
        :class="{ active: role === r }"
        @click="role = r"
      >
        {{ r }}
      </button>
      <span class="rbac-count">
        可见菜单 <b>{{ visibleMenus.length }}</b> / {{ routes.length }}
      </span>
      <button
        class="btn-reset"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <div class="rbac-body">
      <!-- 菜单 -->
      <nav
        class="rbac-nav"
        aria-label="模拟菜单"
      >
        <button
          v-for="item in routes"
          :key="item.key"
          class="rbac-item"
          :class="{
            active: current === item.key,
            locked: !item.roles.includes(role),
          }"
          :aria-current="current === item.key ? 'page' : undefined"
          @click="navigate(item.key)"
        >
          <span aria-hidden="true">{{ item.icon }}</span>
          <span class="rbac-item-label">{{ item.label }}</span>
          <span
            v-if="!item.roles.includes(role)"
            class="rbac-lock"
            aria-label="无权限"
          >🔒</span>
        </button>
      </nav>

      <!-- 页面 -->
      <section class="rbac-page">
        <p class="rbac-path">
          {{ currentRoute?.path }}
        </p>
        <h3>{{ currentRoute?.icon }} {{ currentRoute?.label }}</h3>
        <p class="rbac-desc">
          当前角色 <b>{{ role }}</b>，允许进入的角色：
          <b>{{ currentRoute?.roles.join(' / ') }}</b>
        </p>
        <p class="rbac-note">
          无权限的菜单仍显示（🔒）——真实项目可两种策略：隐藏（菜单过滤）或置灰（引导申请权限）。
        </p>
      </section>
    </div>

    <!-- 日志 -->
    <ul class="rbac-log">
      <li
        v-for="(l, i) in logs"
        :key="i"
      >
        {{ l }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.rbac-demo {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* ---------- 角色 ---------- */

.rbac-roles {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.rbac-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.seg-btn {
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;

  &.active {
    border-color: var(--primary);
    background-color: var(--primary);
    color: #fff;
  }
}

.rbac-count {
  margin-left: auto;
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.btn-reset {
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;
}

/* ---------- 主体 ---------- */

.rbac-body {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 0.6rem;
}

.rbac-nav {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.4rem;
}

.rbac-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.45rem;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text);
  font-size: 0.8125rem;
  cursor: pointer;
  text-align: left;

  &:hover {
    background-color: var(--code-bg);
  }

  &.active {
    background-color: var(--primary-soft);
    color: var(--primary-soft-text);
    font-weight: 600;
  }

  &.locked {
    opacity: 0.5;
  }
}

.rbac-item-label {
  flex: 1;
}

.rbac-lock {
  font-size: 0.8125rem;
}

.rbac-page {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;

  h3 {
    margin: 0.2rem 0 0.35rem;
    font-size: 0.9375rem;
    color: var(--text);
  }
}

.rbac-path {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.rbac-desc,
.rbac-note {
  margin: 0 0 0.3rem;
  font-size: 0.8125rem;
  line-height: 1.7;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.rbac-note {
  font-size: 0.8125rem;
  opacity: 0.85;
}

/* ---------- 日志 ---------- */

.rbac-log {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0.55rem;
  background-color: var(--code-bg);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.9;
  color: var(--text-secondary);
  min-height: 4.8rem;
}

@media (max-width: 700px) {
  .rbac-body {
    grid-template-columns: 1fr;
  }

  .rbac-count {
    margin-left: 0;
  }
}
</style>
