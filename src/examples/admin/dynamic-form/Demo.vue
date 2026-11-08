<script setup lang="ts">
// ============================================================
// 案例：dynamic-form 动态表单
// 增删行、逐行校验、错误行保留
// ============================================================
import { computed, ref } from 'vue'

// ============================================================
// 类型与初始行
// ============================================================

interface FormRow {
  id: number
  name: string
  qty: string
  price: string
  error: string
}

/** 每次重置都新建对象和 id，避免旧行被复用 */
function createRows(): FormRow[] {
  return [
    { id: 1, name: 'A4 纸', qty: '10', price: '25.5', error: '' },
    { id: 2, name: '签字笔', qty: '20', price: '3.5', error: '' },
  ]
}

const rows = ref<FormRow[]>(createRows())
const nextId = ref(3)
const submitCount = ref(0)
const statusText = ref('待填写')

// ============================================================
// 校验
// ============================================================

/** 单行校验：名称非空、数量正整数、单价正数 */
function validateRow(row: FormRow): string {
  if (!row.name.trim()) return '请输入名称'
  const qty = Number(row.qty)
  if (!Number.isInteger(qty) || qty <= 0) return '数量为正整数'
  const price = Number(row.price)
  if (!Number.isFinite(price) || price <= 0) return '单价为正数'
  return ''
}

const validCount = computed(
  () => rows.value.filter((row) => validateRow(row) === '').length,
)
const errorCount = computed(() => rows.value.filter((row) => row.error).length)

// ============================================================
// 行操作
// ============================================================

/** 用户一改这一行就清掉旧错误，避免错误提示挂在已经修好的行上 */
function onInput(row: FormRow): void {
  if (row.error) row.error = ''
  if (statusText.value.startsWith('有 ')) statusText.value = '待填写'
}

function addRow(): void {
  rows.value.push({
    id: nextId.value++,
    name: '',
    qty: '',
    price: '',
    error: '',
  })
  statusText.value = '待填写'
}

/** 删除按 id 定位，不用数组下标，避免删错行或 key 复用 */
function removeRow(id: number): void {
  rows.value = rows.value.filter((row) => row.id !== id)
}

function submit(): void {
  let errors = 0
  for (const row of rows.value) {
    row.error = validateRow(row)
    if (row.error) errors += 1
  }

  if (errors > 0) {
    statusText.value = `有 ${errors} 行需要修改`
    return
  }

  submitCount.value += 1
  statusText.value = '提交成功'
}

function reset(): void {
  rows.value = createRows()
  nextId.value = 3
  submitCount.value = 0
  statusText.value = '待填写'
}
</script>

<template>
  <div class="df-demo">
    <div class="df-table-wrap">
      <table class="df-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>数量</th>
            <th>单价</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            :data-row="row.id"
            :class="{ 'has-error': row.error }"
          >
            <td>
              <n-input
                v-model:value="row.name"
                data-field="name"
                size="small"
                placeholder="商品名称"
                @update:value="onInput(row)"
              />
              <p
                v-if="row.error"
                class="df-error"
              >
                {{ row.error }}
              </p>
            </td>
            <td>
              <n-input
                v-model:value="row.qty"
                data-field="qty"
                size="small"
                placeholder="正整数"
                @update:value="onInput(row)"
              />
            </td>
            <td>
              <n-input
                v-model:value="row.price"
                data-field="price"
                size="small"
                placeholder="正数"
                @update:value="onInput(row)"
              />
            </td>
            <td>
              <n-button
                size="small"
                type="error"
                quaternary
                data-action="delete"
                @click="removeRow(row.id)"
              >
                删除
              </n-button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="df-actions">
      <n-button @click="addRow">
        添加一行
      </n-button>
      <n-button
        type="primary"
        @click="submit"
      >
        提交
      </n-button>
      <n-button @click="reset">
        重置
      </n-button>
      <p class="df-hint">
        每行独立校验，错误行会保留，修好后可以继续提交。
      </p>
    </div>

    <div class="df-stats">
      <span>行数 <b data-stat="row-count">{{ rows.length }}</b></span>
      <span>合法 <b data-stat="valid-count">{{ validCount }}</b></span>
      <span>错误 <b data-stat="error-count">{{ errorCount }}</b></span>
      <span>提交 <b data-stat="submit-count">{{ submitCount }}</b></span>
      <span class="df-stat-wide">
        状态 <b data-stat="status-text">{{ statusText }}</b>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.df-demo {
  display: grid;
  gap: 0.75rem;
}

.df-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
}

.df-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--demo-text-sm);
}

.df-table th,
.df-table td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.df-table th {
  color: var(--text-soft);
  font-weight: 600;
  background: var(--bg-subtle);
  white-space: nowrap;
}

.df-table tbody tr:last-child td {
  border-bottom: 0;
}

.df-table td:nth-child(2),
.df-table td:nth-child(3) {
  width: 8rem;
}

.df-table td:last-child {
  width: 5.5rem;
  white-space: nowrap;
}

.df-table tr.has-error td {
  background: color-mix(in srgb, var(--danger) 5%, transparent);
}

.df-error {
  margin: 0.25rem 0 0;
  color: var(--danger);
  font-size: var(--demo-text-xs);
}

.df-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.df-hint {
  margin: 0;
  color: var(--text-soft);
  font-size: var(--demo-text-xs);
  line-height: 1.6;
}

.df-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background: var(--bg-subtle);
  color: var(--text-soft);
  font-size: var(--demo-text-sm);
}

.df-stats b {
  color: var(--text);
}

.df-stat-wide {
  margin-left: auto;
}

@media (max-width: 640px) {
  .df-stat-wide {
    margin-left: 0;
  }
}
</style>
