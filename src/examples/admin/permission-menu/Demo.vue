// ============================================================
// 案例：permission-menu 权限菜单
// 同一份菜单树按权限点过滤，父级分组自动剪枝
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ============================================================
// 类型与菜单数据
// ============================================================

type Role = 'admin' | 'editor' | 'viewer'

interface MenuNode {
  key: string
  label: string
  permission: string
  children?: MenuNode[]
}

const MENU_TREE: MenuNode[] = [
  {
    key: 'dashboard',
    label: '工作台',
    permission: 'dashboard.view',
    children: [
      { key: 'dashboard-home', label: '概览', permission: 'dashboard.home' },
      { key: 'dashboard-todo', label: '待办', permission: 'dashboard.todo' },
    ],
  },
  {
    key: 'content',
    label: '内容管理',
    permission: 'content.view',
    children: [
      { key: 'content-article', label: '文章管理', permission: 'content.article' },
      { key: 'content-comment', label: '评论审核', permission: 'content.comment' },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    permission: 'system.view',
    children: [
      { key: 'system-user', label: '用户管理', permission: 'system.user' },
      { key: 'system-role', label: '角色权限', permission: 'system.role' },
      { key: 'system-audit', label: '审计日志', permission: 'system.audit' },
    ],
  },
]

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [
    'dashboard.home',
    'dashboard.todo',
    'content.article',
    'content.comment',
    'system.user',
    'system.role',
    'system.audit',
  ],
  editor: ['dashboard.home', 'dashboard.todo', 'content.article', 'content.comment'],
  viewer: ['dashboard.home'],
}

const ROLE_TEXT: Record<Role, string> = {
  admin: '管理员',
  editor: '编辑',
  viewer: '访客',
}

const role = ref<Role>('editor')

// ============================================================
// 菜单过滤
// ============================================================

/** 把树拍平，只保留叶子菜单，用来给左侧「写死菜单」和计数复用 */
function flattenLeaves(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((node) => (node.children ? flattenLeaves(node.children) : [node]))
}

const allLeaves = flattenLeaves(MENU_TREE)
const totalLeafCount = allLeaves.length

/**
 * 按当前角色递归过滤菜单：
 * 1. 叶子没有权限就整个丢掉
 * 2. 分组只在还有可见子项时保留，避免留下空分组
 */
function filterMenu(nodes: MenuNode[], permissions: Set<string>): MenuNode[] {
  return nodes.flatMap((node) => {
    if (node.children) {
      const children = filterMenu(node.children, permissions)
      return children.length ? [{ ...node, children }] : []
    }
    return permissions.has(node.permission) ? [node] : []
  })
}

const visibleTree = computed(() => {
  const permissions = new Set(ROLE_PERMISSIONS[role.value])
  //! 角色一变就重新过滤整棵树，菜单不缓存旧结果
  return filterMenu(MENU_TREE, permissions)
})

const visibleCount = computed(() => flattenLeaves(visibleTree.value).length)
const hiddenCount = computed(() => totalLeafCount - visibleCount.value)
const groupCount = computed(() => visibleTree.value.filter((node) => node.children?.length).length)

// ============================================================
// 交互
// ============================================================

function onRoleChange(value: string | number | boolean | undefined): void {
  if (value === 'admin' || value === 'editor' || value === 'viewer') {
    role.value = value
  }
}

function reset(): void {
  role.value = 'editor'
}
</script>

<template>
  <div class="pm-demo">
    <p class="hint">
      左边菜单写死在模板里，右边由权限点过滤。切换角色时，右边只留下有权限的入口，
      父级分组没有可见子项时一起消失。
    </p>

    <div class="toolbar">
      <n-radio-group
        :value="role"
        size="small"
        @update:value="onRoleChange"
      >
        <n-radio-button value="admin">
          管理员
        </n-radio-button>
        <n-radio-button value="editor">
          编辑
        </n-radio-button>
        <n-radio-button value="viewer">
          访客
        </n-radio-button>
      </n-radio-group>
      <n-button
        size="small"
        quaternary
        @click="reset"
      >
        重置
      </n-button>
    </div>

    <div class="panels">
      <section class="panel pm-plain">
        <div class="panel-head">
          <h3>写死菜单</h3>
          <span class="badge">始终 7 项</span>
        </div>
        <ul class="menu-list">
          <li
            v-for="item in allLeaves"
            :key="item.key"
            class="menu-leaf"
            data-menu-item
          >
            <span>{{ item.label }}</span>
            <code>{{ item.permission }}</code>
          </li>
        </ul>
        <p class="note">
          菜单和权限各写一份：访客登录后仍能看到「用户管理」，只能靠路由守卫再拦一次。
        </p>
      </section>

      <section class="panel pm-guarded">
        <div class="panel-head">
          <h3>权限菜单</h3>
          <span class="badge">{{ ROLE_TEXT[role] }}</span>
        </div>
        <ul class="menu-groups">
          <li
            v-for="group in visibleTree"
            :key="group.key"
            class="menu-group"
            data-menu-group
          >
            <div class="group-title">
              <span>{{ group.label }}</span>
              <span class="group-count">{{ group.children?.length ?? 0 }}</span>
            </div>
            <ul class="menu-list">
              <li
                v-for="item in group.children"
                :key="item.key"
                class="menu-leaf"
                data-menu-item
              >
                <span>{{ item.label }}</span>
                <code>{{ item.permission }}</code>
              </li>
            </ul>
          </li>
        </ul>
        <p class="note">
          同一份菜单树按权限点过滤：没有权限的叶子不渲染，空分组自动收起。
        </p>
      </section>
    </div>

    <dl class="metrics">
      <div class="metric">
        <dt>可见菜单</dt>
        <dd data-stat="visible-count">
          {{ visibleCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>隐藏菜单</dt>
        <dd data-stat="hidden-count">
          {{ hiddenCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>可见分组</dt>
        <dd data-stat="group-count">
          {{ groupCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>当前角色</dt>
        <dd data-stat="current-role">
          {{ ROLE_TEXT[role] }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped lang="scss">
.pm-demo {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.panel {
  min-width: 0;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.55rem;

  h3 {
    margin: 0;
    font-size: var(--demo-text-md);
  }
}

.menu-groups,
.menu-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.menu-groups {
  gap: 0.55rem;
}

.menu-leaf {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.32rem 0.45rem;
  border-radius: 6px;
  background: var(--bg);
  font-size: var(--demo-text-sm);

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  code {
    flex: none;
    color: var(--text-muted);
    font-size: var(--demo-text-xs);
  }
}

.group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.3rem;
  color: var(--text-muted);
  font-size: var(--demo-text-xs);
}

.group-count {
  padding: 0 0.35rem;
  border-radius: var(--radius-tag);
  background: var(--bg);
}

.note {
  margin: 0.6rem 0 0;
  color: var(--text-muted);
  font-size: var(--demo-text-xs);
  line-height: 1.7;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
}

.metric {
  padding: 0.5rem 0.6rem;
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
  text-align: center;

  dt {
    color: var(--text-muted);
    font-size: var(--demo-text-xs);
  }

  dd {
    margin: 0.15rem 0 0;
    font-weight: 600;
  }
}

@media (max-width: 640px) {
  .panels {
    grid-template-columns: minmax(0, 1fr);
  }

  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
