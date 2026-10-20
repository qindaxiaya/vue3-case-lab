// ============================================================
// 案例：可编辑表格 + 行内校验（editable-table）
// - 双击单元格进入编辑（自动聚焦并全选）
// - 失焦 / Enter 保存，Esc 取消，校验失败保持编辑并提示
// - 名称必填、价格 > 0、库存为非负整数
// ============================================================
<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { Directive } from 'vue'

// ============================================================
// 数据
// ============================================================

interface Row {
  id: number
  name: string
  price: number
  stock: number
}

/** 可编辑字段 */
type EditableField = 'name' | 'price' | 'stock'

const rows = ref<Row[]>([
  { id: 1, name: '机械键盘', price: 399, stock: 12 },
  { id: 2, name: '人体工学椅', price: 1299, stock: 5 },
  { id: 3, name: '27 寸显示器', price: 1899, stock: 8 },
  { id: 4, name: '降噪耳机', price: 899, stock: 0 },
])

/** 当前编辑单元格 */
const editing = ref<{ id: number; field: EditableField } | null>(null)
/** 编辑中的草稿值 */
const draft = ref('')
/** 校验错误 */
const error = ref('')
/** 校验失败的单元格（红框） */
const errorCell = ref<string>('')

/** 统计 */
const edits = ref(0)
const saves = ref(0)
const rejects = ref(0)

// ============================================================
// 编辑状态机
// ============================================================

/** 单元格唯一键 */
function cellKey(row: Row, field: EditableField): string {
  return `${row.id}:${field}`
}

function isEditing(row: Row, field: EditableField): boolean {
  return editing.value?.id === row.id && editing.value.field === field
}

/** 双击进入编辑 */
function startEdit(row: Row, field: EditableField): void {
  editing.value = { id: row.id, field }
  draft.value = String(row[field])
  error.value = ''
  errorCell.value = ''
  edits.value++
}

/** 校验并写回；返回是否成功 */
function commit(row: Row, field: EditableField): boolean {
  const raw = draft.value.trim()

  if (field === 'name') {
    //! 名称：必填
    if (!raw) {
      error.value = '名称不能为空'
      errorCell.value = cellKey(row, field)
      rejects.value++
      return false
    }
    row.name = raw
  } else {
    const num = Number(raw)

    //! 数字合法性：空串会被 Number 转成 0，要单独拦
    if (!raw || !Number.isFinite(num)) {
      error.value = '请输入数字'
      errorCell.value = cellKey(row, field)
      rejects.value++
      return false
    }
    if (field === 'price' && num <= 0) {
      error.value = '价格必须大于 0'
      errorCell.value = cellKey(row, field)
      rejects.value++
      return false
    }
    if (field === 'stock' && (!Number.isInteger(num) || num < 0)) {
      error.value = '库存必须是非负整数'
      errorCell.value = cellKey(row, field)
      rejects.value++
      return false
    }
    row[field] = num
  }

  saves.value++
  editing.value = null
  error.value = ''
  errorCell.value = ''
  return true
}

/** 取消编辑（不写回） */
function cancelEdit(): void {
  editing.value = null
  error.value = ''
  errorCell.value = ''
}

/** Enter 保存；Esc 取消 */
function onCellKeydown(e: KeyboardEvent, row: Row, field: EditableField): void {
  if (e.key === 'Enter') {
    e.preventDefault()
    const ok = commit(row, field)
    // 校验失败：保持编辑并重新聚焦
    if (!ok) nextTick(() => focusCell())
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  }
}

/** 失焦保存：已取消/已切换单元格时不重复提交 */
function onCellBlur(row: Row, field: EditableField): void {
  if (!isEditing(row, field)) return
  //! 失焦时校验失败：保持编辑态并重新聚焦，避免用户丢掉输入
  const ok = commit(row, field)
  if (!ok) nextTick(() => focusCell())
}

/** 重新聚焦当前编辑 input（通过 DOM 查询，避免为每个单元格建 ref） */
function focusCell(): void {
  const el = document.querySelector<HTMLInputElement>('.et-input')
  el?.focus()
  el?.select()
}

/** 新增行 */
let nextId = 5
function addRow(): void {
  rows.value.push({ id: nextId++, name: '新商品', price: 1, stock: 0 })
}

/** 删除行 */
function removeRow(id: number): void {
  rows.value = rows.value.filter((r) => r.id !== id)
  if (editing.value?.id === id) cancelEdit()
}

function resetAll(): void {
  rows.value = [
    { id: 1, name: '机械键盘', price: 399, stock: 12 },
    { id: 2, name: '人体工学椅', price: 1299, stock: 5 },
    { id: 3, name: '27 寸显示器', price: 1899, stock: 8 },
    { id: 4, name: '降噪耳机', price: 899, stock: 0 },
  ]
  nextId = 5
  editing.value = null
  error.value = ''
  errorCell.value = ''
  edits.value = 0
  saves.value = 0
  rejects.value = 0
}

// ============================================================
// 自动聚焦指令
// ============================================================

const vFocus: Directive<HTMLInputElement> = {
  mounted(el) {
    el.focus()
    el.select()
  },
}
</script>

<template>
  <div class="et-demo">
    <!-- 工具栏 -->
    <div class="et-bar">
      <span class="et-meta">
        双击单元格编辑 · Enter 保存 · Esc 取消
      </span>
      <span class="et-stat">
        编辑 <b>{{ edits }}</b> · 保存 <b>{{ saves }}</b> · 拦截 <b class="bad">{{ rejects }}</b>
      </span>
      <button
        class="btn-act"
        @click="addRow"
      >
        新增行
      </button>
      <button
        class="btn-reset"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <!-- 表格 -->
    <div class="et-wrap">
      <table class="et-table">
        <thead>
          <tr>
            <th scope="col">
              商品名称
            </th>
            <th
              scope="col"
              class="num"
            >
              价格（元）
            </th>
            <th
              scope="col"
              class="num"
            >
              库存
            </th>
            <th
              scope="col"
              class="act"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
          >
            <!-- 名称 -->
            <td
              :class="{ 'et-cell--error': errorCell === cellKey(row, 'name') }"
              @dblclick="startEdit(row, 'name')"
            >
              <input
                v-if="isEditing(row, 'name')"
                v-model="draft"
                v-focus
                class="et-input"
                @keydown="onCellKeydown($event, row, 'name')"
                @blur="onCellBlur(row, 'name')"
              >
              <span
                v-else
                class="et-text"
              >{{ row.name }}</span>
            </td>

            <!-- 价格 -->
            <td
              class="num"
              :class="{ 'et-cell--error': errorCell === cellKey(row, 'price') }"
              @dblclick="startEdit(row, 'price')"
            >
              <input
                v-if="isEditing(row, 'price')"
                v-model="draft"
                v-focus
                class="et-input"
                inputmode="decimal"
                @keydown="onCellKeydown($event, row, 'price')"
                @blur="onCellBlur(row, 'price')"
              >
              <span
                v-else
                class="et-text"
              >{{ row.price }}</span>
            </td>

            <!-- 库存 -->
            <td
              class="num"
              :class="{ 'et-cell--error': errorCell === cellKey(row, 'stock') }"
              @dblclick="startEdit(row, 'stock')"
            >
              <input
                v-if="isEditing(row, 'stock')"
                v-model="draft"
                v-focus
                class="et-input"
                inputmode="numeric"
                @keydown="onCellKeydown($event, row, 'stock')"
                @blur="onCellBlur(row, 'stock')"
              >
              <span
                v-else
                class="et-text"
              >{{ row.stock }}</span>
            </td>

            <!-- 操作 -->
            <td class="act">
              <button
                class="btn-del"
                @click="removeRow(row.id)"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 校验提示 -->
    <p
      class="et-error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.et-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ---------- 工具栏 ---------- */

.et-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.et-meta {
  font-size: 0.73rem;
  color: var(--text-secondary);
}

.et-stat {
  margin-left: auto;
  font-size: 0.73rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }

  b.bad {
    color: var(--danger);
  }
}

.btn-act {
  padding: 0.24rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.73rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.btn-reset {
  padding: 0.24rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.72rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
  }
}

/* ---------- 表格 ---------- */

.et-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
}

.et-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;

  th {
    text-align: left;
    padding: 0.45rem 0.6rem;
    background-color: var(--code-bg);
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-weight: 600;
    white-space: nowrap;
  }

  td {
    padding: 0.3rem 0.6rem;
    border-top: 1px solid var(--border);
    color: var(--text);
    vertical-align: middle;
  }

  th.num,
  td.num {
    text-align: right;
  }

  th.act,
  td.act {
    text-align: right;
    width: 5rem;
  }

  tbody tr:hover td {
    background-color: var(--bg-soft, var(--code-bg));
  }
}

.et-text {
  display: inline-block;
  min-height: 1.4rem;
  line-height: 1.4rem;
  cursor: cell;
}

.et-input {
  width: 100%;
  min-width: 4.5rem;
  padding: 0.2rem 0.35rem;
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  color: var(--text);
  font-size: 0.78rem;
  font-family: inherit;

  &:focus {
    outline: 2px solid var(--primary-soft);
  }
}

.et-cell--error {
  background-color: var(--danger-soft);
}

.btn-del {
  border: none;
  background: none;
  color: var(--danger);
  font-size: 0.72rem;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

/* ---------- 错误提示 ---------- */

.et-error {
  margin: 0;
  min-height: 1.2rem;
  font-size: 0.73rem;
  color: var(--danger);
}

@media (max-width: 640px) {
  .et-stat {
    margin-left: 0;
  }
}
</style>
