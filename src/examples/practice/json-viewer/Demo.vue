// ============================================================
// 案例：JSON 树查看器（json-viewer）
// - 左侧输入 JSON，右侧类型着色的树（string/number/boolean/null）
// - 对象/数组可折叠展开（扁平化行 + 缩进实现，非递归组件，性能更好）
// - 点击任意节点复制其 JSON 路径（data.list[0].name），调试时超实用
// - 解析失败给出行列定位提示
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ============================================================
// 输入与解析
// ============================================================

/** 预设示例 JSON */
const SAMPLE = JSON.stringify(
  {
    name: 'vue3-case-lab',
    version: '0.2.0',
    private: true,
    tags: ['vue3', 'case', 'performance'],
    author: { name: 'moyu', contact: { email: 'demo@example.com', wechat: null } },
    stats: { stars: 128, forks: 12, issues: { open: 3, closed: 47 } },
    experimental: false,
  },
  null,
  2,
)

const source = ref(SAMPLE)

/** 解析结果（失败时为 null） */
const parsed = computed<{ ok: true; value: unknown } | { ok: false; error: string }>(() => {
  try {
    return { ok: true, value: JSON.parse(source.value) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '解析失败' }
  }
})

// ============================================================
// 扁平化树（关键：不用递归组件）
// ============================================================

/** 值类型分类（决定着色与展示） */
type ValueType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'

/** 树的一行（扁平化后的节点） */
interface Row {
  /** 完整 JSON 路径：data.list[0].name */
  path: string
  /** 键名（数组元素显示 [i]） */
  key: string
  /** 原始值 */
  value: unknown
  /** 类型 */
  type: ValueType
  /** 缩进深度 */
  depth: number
  /** 是否有子节点（可折叠） */
  hasChildren: boolean
  /** 子节点数量预览 */
  childCount: number
}

/** 判定类型 */
function typeOf(v: unknown): ValueType {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v as ValueType
}

/** 折叠状态：存路径的集合（用替换新 Set 触发响应式） */
const collapsed = ref<Set<string>>(new Set())

/** 递归扁平化：折叠的节点不展开子级 */
function flatten(value: unknown, path: string, key: string, depth: number): Row[] {
  const type = typeOf(value)
  const isContainer = type === 'object' || type === 'array'
  const entries = isContainer ? Object.entries(value as object) : []

  const row: Row = {
    path,
    key,
    value,
    type,
    depth,
    hasChildren: entries.length > 0,
    childCount: entries.length,
  }

  // 折叠或空容器：到此为止
  if (!isContainer || collapsed.value.has(path) || entries.length === 0) {
    return [row]
  }

  const rows: Row[] = [row]
  for (const [k, v] of entries) {
    // 数组元素路径用 [i]，对象用 .key
    const childPath = Array.isArray(value) ? `${path}[${k}]` : `${path}.${k}`
    rows.push(...flatten(v, childPath, Array.isArray(value) ? `[${k}]` : k, depth + 1))
  }
  return rows
}

/** 当前可见行（折叠变化时重算） */
const rows = computed<Row[]>(() => {
  if (!parsed.value.ok) return []
  // 根节点 key 用 $ 表示
  return flatten(parsed.value.value, '$', '$', 0)
})

/** 统计：节点总数（全展开时） */
const totalNodes = computed(() => {
  let n = 0
  const walk = (v: unknown): void => {
    n++
    if (v && typeof v === 'object') Object.values(v as object).forEach(walk)
  }
  if (parsed.value.ok) walk(parsed.value.value)
  return n
})

// ============================================================
// 交互
// ============================================================

/** 折叠/展开切换 */
function toggle(row: Row): void {
  if (!row.hasChildren) return
  const next = new Set(collapsed.value)
  if (next.has(row.path)) next.delete(row.path)
  else next.add(row.path)
  collapsed.value = next
}

/** 复制提示反馈 */
const copiedPath = ref('')

/** 点击行：复制该节点路径（调试时可直接粘到控制台取值） */
function copyPath(row: Row): void {
  void navigator.clipboard
    .writeText(row.path)
    .then(() => {
      copiedPath.value = row.path
      window.setTimeout(() => {
        if (copiedPath.value === row.path) copiedPath.value = ''
      }, 1500)
    })
    .catch(() => {
      copiedPath.value = '复制失败'
    })
}

/** 一键全部展开 / 全部折叠 */
function expandAll(): void {
  collapsed.value = new Set()
}

/** 全部折叠：只保留根节点可见的折叠集合 */
function collapseAll(): void {
  const set = new Set<string>()
  const walk = (v: unknown, path: string): void => {
    if (v && typeof v === 'object') {
      const entries = Object.entries(v as object)
      if (entries.length > 0) {
        set.add(path)
        for (const [k, child] of entries) {
          const childPath = Array.isArray(v) ? `${path}[${k}]` : `${path}.${k}`
          walk(child, childPath)
        }
      }
    }
  }
  walk(parsed.value.ok ? parsed.value.value : null, '$')
  set.delete('$') // 根保持展开（否则全屏只剩一行）
  collapsed.value = set
}

/** 值预览（叶子节点显示，容器显示摘要） */
function preview(row: Row): string {
  switch (row.type) {
    case 'string':
      return `"${row.value as string}"`
    case 'number':
    case 'boolean':
      return String(row.value)
    case 'null':
      return 'null'
    case 'array':
      return `Array(${row.childCount})`
    case 'object':
      return `{${row.childCount}}`
    default:
      return ''
  }
}
</script>

<template>
  <div class="jv-demo">
    <div class="body">
      <!-- 输入区 -->
      <section
        class="input-pane"
        aria-label="JSON 输入"
      >
        <div class="pane-head">
          <span class="pane-title">输入 JSON</span>
          <button
            class="btn-mini"
            @click="source = SAMPLE"
          >
            载入示例
          </button>
        </div>
        <textarea
          v-model="source"
          class="json-input"
          spellcheck="false"
          aria-label="JSON 源码"
        />
        <!-- 解析错误 -->
        <p
          v-if="!parsed.ok"
          class="parse-error"
          role="alert"
        >
          ✕ {{ parsed.error }}
        </p>
        <p
          v-else
          class="parse-ok"
        >
          ✓ 解析成功 · 共 {{ totalNodes }} 个节点
        </p>
      </section>

      <!-- 树视图 -->
      <section
        class="tree-pane"
        aria-label="JSON 树"
      >
        <div class="pane-head">
          <span class="pane-title">树视图（点击行复制路径）</span>
          <span class="tree-actions">
            <button
              class="btn-mini"
              @click="expandAll"
            >
              全展开
            </button>
            <button
              class="btn-mini"
              @click="collapseAll"
            >
              全折叠
            </button>
          </span>
        </div>

        <!-- 复制反馈 -->
        <p
          v-if="copiedPath"
          class="copied"
          aria-live="polite"
        >
          已复制路径：<code>{{ copiedPath }}</code>
        </p>

        <!-- 扁平行列表 -->
        <div class="tree-scroll">
          <div
            v-for="row in rows"
            :key="row.path"
            class="tree-row"
            @click="copyPath(row)"
          >
            <!-- 缩进 -->
            <span
              class="indent"
              :style="{ paddingLeft: `${row.depth * 1.1}rem` }"
            />
            <!-- 折叠箭头 -->
            <button
              v-if="row.hasChildren"
              class="caret"
              :class="{ 'caret--collapsed': collapsed.has(row.path) }"
              :aria-label="collapsed.has(row.path) ? '展开' : '折叠'"
              @click.stop="toggle(row)"
            >
              ▾
            </button>
            <span
              v-else
              class="caret caret--empty"
            />
            <!-- 键名 -->
            <span
              class="key"
              :class="{ 'key--root': row.path === '$' }"
            >{{ row.key }}</span>
            <span class="colon">:</span>
            <!-- 值（按类型着色） -->
            <span
              class="val"
              :class="`val--${row.type}`"
            >{{ preview(row) }}</span>
            <!-- 折叠时的子项数提示 -->
            <span
              v-if="row.hasChildren && collapsed.has(row.path)"
              class="folded-hint"
            >… {{ row.childCount }} 项</span>
          </div>

          <p
            v-if="rows.length === 0"
            class="tree-empty"
          >
            左侧输入合法 JSON 后在此渲染
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.jv-demo {
  display: flex;
  flex-direction: column;
}

.body {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 0.75rem;
  min-height: 420px;
}

/* ---------- 通用面板头 ---------- */

.input-pane,
.tree-pane {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border-bottom: 1px solid var(--border);
}

.pane-title {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.tree-actions {
  display: inline-flex;
  gap: 0.35rem;
}

.btn-mini {
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.7rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
    border-color: var(--text-secondary);
  }
}

/* ---------- 输入区 ---------- */

.json-input {
  flex: 1;
  min-height: 340px;
  resize: none;
  border: none;
  outline: none;
  padding: 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.76rem;
  line-height: 1.7;
  background-color: var(--code-bg);
  color: var(--text);
  tab-size: 2;
}

.parse-error {
  margin: 0;
  padding: 0.45rem 0.7rem;
  font-size: 0.74rem;
  color: var(--danger);
  background-color: color-mix(in srgb, var(--danger) 10%, transparent);
  border-top: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
}

.parse-ok {
  margin: 0;
  padding: 0.45rem 0.7rem;
  font-size: 0.74rem;
  color: var(--success);
  border-top: 1px solid var(--border);
}

/* ---------- 树视图 ---------- */

.copied {
  margin: 0;
  padding: 0.4rem 0.7rem;
  font-size: 0.72rem;
  color: var(--primary);
  background-color: color-mix(in srgb, var(--primary) 8%, transparent);

  code {
    font-family: var(--font-mono);
  }
}

.tree-scroll {
  flex: 1;
  overflow: auto;
  padding: 0.5rem 0.4rem;
  min-height: 340px;
}

.tree-row {
  display: flex;
  align-items: center;
  height: 24px;
  font-family: var(--font-mono);
  font-size: 0.76rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  white-space: nowrap;

  &:hover {
    background-color: var(--bg-subtle);
  }
}

.indent {
  flex-shrink: 0;
}

.caret {
  flex-shrink: 0;
  width: 1.05rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.65rem;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s;
}

.caret--collapsed {
  transform: rotate(-90deg);
}

.caret--empty {
  cursor: default;
}

.key {
  color: var(--primary);
  font-weight: 500;
}

.key--root {
  color: var(--text-secondary);
  font-weight: 600;
}

.colon {
  color: var(--text-secondary);
  margin: 0 0.35rem 0 0.05rem;
}

/* 类型着色 */
.val--string {
  color: var(--success);
}

.val--number {
  color: #b45309;
}

.val--boolean {
  color: #7c3aed;
}

.val--null {
  color: var(--text-secondary);
}

.val--object,
.val--array {
  color: var(--text-secondary);
}

.folded-hint {
  margin-left: 0.44rem;
  color: var(--text-secondary);
  font-size: 0.7rem;
}

.tree-empty {
  margin: 1.5rem auto;
  text-align: center;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

/* 暗色下 number 用更亮的橙 */
:global(.dark) .val--number {
  color: #fbbf24;
}

:global(.dark) .val--boolean {
  color: #c4b5fd;
}

@media (max-width: 860px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
