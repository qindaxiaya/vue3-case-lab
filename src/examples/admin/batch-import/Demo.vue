// ============================================================
// 案例：batch-import 批量导入
// 粘贴文本、逐行校验、错误预览、只导入合法行
// ============================================================
<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

// ============================================================
// 类型与示例数据
// ============================================================

type Plan = 'basic' | 'pro' | 'enterprise'

interface ImportRow {
  line: number
  name: string
  email: string
  plan: string
  errors: string[]
  valid: boolean
}

const SAMPLE = `张三,zhang@example.com,pro
李四,lisi@example.com,basic
王五,wang@example.com,pro
赵六,zhao@example.com,vip
张三,zhang@example.com,pro
孙七,sun@example.com,basic`

const planKeys: Plan[] = ['basic', 'pro', 'enterprise']
const planText: Record<Plan, string> = {
  basic: '基础版',
  pro: '专业版',
  enterprise: '旗舰版',
}

/** 演示用的「已有邮箱」，真实项目里由接口返回或查重 */
const existingEmails = new Set(['sun@example.com'])

const source = ref('')
const rows = ref<ImportRow[]>([])
const parsed = ref(false)
const importing = ref(false)
const importedCount = ref(0)
const hasImported = ref(false)
const statusText = ref('等待校验')

let importTimer: number | null = null

const validRows = computed(() => rows.value.filter((row) => row.valid))
const validCount = computed(() => validRows.value.length)
const errorCount = computed(() => rows.value.length - validCount.value)
const canImport = computed(() => parsed.value && validCount.value > 0 && !hasImported.value)

// ============================================================
// 解析与校验
// ============================================================

function fillSample(): void {
  if (importing.value) return
  source.value = SAMPLE
  rows.value = []
  parsed.value = false
  hasImported.value = false
  importedCount.value = 0
  statusText.value = '已填入示例，点「校验并预览」'
}

/** 逐行解析；错误按行收集，合法行和错误行都保留在预览里 */
function parseAndValidate(): void {
  if (importing.value) return
  const lines = source.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const seenEmails = new Set<string>()
  rows.value = lines.map((line, index) => {
    const [name = '', email = '', plan = ''] = line.split(',').map((cell) => cell.trim())
    const errors: string[] = []
    const lowerEmail = email.toLowerCase()

    if (name.length < 2) errors.push('姓名至少 2 个字')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('邮箱格式不对')
    if (!planKeys.includes(plan as Plan)) errors.push('套餐只能是 basic / pro / enterprise')
    if (lowerEmail && seenEmails.has(lowerEmail)) errors.push('文件内邮箱重复')
    if (lowerEmail && existingEmails.has(lowerEmail)) errors.push('邮箱已存在')
    if (lowerEmail) seenEmails.add(lowerEmail)

    return {
      line: index + 1,
      name,
      email,
      plan,
      errors,
      valid: errors.length === 0,
    }
  })

  parsed.value = true
  hasImported.value = false
  importedCount.value = 0
  statusText.value = `校验完成：${validRows.value.length} 条可导入`
}

/** 只导入合法行；导入中锁住按钮，避免重复提交 */
function importValid(): void {
  if (!canImport.value || importing.value) return
  importing.value = true
  statusText.value = '导入中…'
  importTimer = window.setTimeout(() => {
    importedCount.value = validCount.value
    hasImported.value = true
    importing.value = false
    statusText.value = `已导入 ${importedCount.value} 条`
    importTimer = null
  }, 500)
}

function reset(): void {
  if (importTimer !== null) {
    window.clearTimeout(importTimer)
    importTimer = null
  }
  source.value = ''
  rows.value = []
  parsed.value = false
  importing.value = false
  importedCount.value = 0
  hasImported.value = false
  statusText.value = '等待校验'
}

onUnmounted(() => {
  if (importTimer !== null) window.clearTimeout(importTimer)
})
</script>

<template>
  <div class="bi-demo">
    <p class="hint">
      批量导入先校验再写库：合法行和错误行一起预览，错误写清行号和原因；
      只导入合法行，避免一条脏数据把整批回滚。
    </p>

    <section class="panel">
      <label class="field">
        <span>每行格式：姓名,邮箱,套餐（basic / pro / enterprise）</span>
        <n-input
          class="bi-source"
          type="textarea"
          :rows="6"
          :value="source"
          placeholder="张三,zhang@example.com,pro"
          @update:value="(value: string) => (source = value)"
        />
      </label>

      <div class="actions">
        <n-button
          size="small"
          @click="fillSample"
        >
          填入示例
        </n-button>
        <n-button
          size="small"
          type="primary"
          :disabled="importing"
          @click="parseAndValidate"
        >
          校验并预览
        </n-button>
        <n-button
          size="small"
          type="success"
          :loading="importing"
          :disabled="!canImport || importing"
          @click="importValid"
        >
          导入合法行
        </n-button>
        <n-button
          size="small"
          quaternary
          @click="reset"
        >
          清空
        </n-button>
        <span
          class="status"
          data-stat="status-text"
        >{{ statusText }}</span>
      </div>
    </section>

    <section
      v-if="rows.length"
      class="preview"
    >
      <div class="preview-head">
        <h3>校验预览</h3>
        <span class="badge">{{ rows.length }} 行</span>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>行</th>
              <th>姓名</th>
              <th>邮箱</th>
              <th>套餐</th>
              <th>结果</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.line"
              :data-row="row.line"
              :data-valid="row.valid"
            >
              <td>{{ row.line }}</td>
              <td>{{ row.name || '—' }}</td>
              <td>{{ row.email || '—' }}</td>
              <td>{{ planText[row.plan as Plan] ?? row.plan }}</td>
              <td>
                <span
                  v-if="row.valid"
                  class="ok"
                >可导入</span>
                <span
                  v-else
                  class="bad"
                >{{ row.errors.join('；') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <dl class="metrics">
      <div class="metric">
        <dt>总行数</dt>
        <dd data-stat="total-rows">
          {{ rows.length }}
        </dd>
      </div>
      <div class="metric">
        <dt>可导入</dt>
        <dd data-stat="valid-count">
          {{ validCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>错误行</dt>
        <dd data-stat="error-count">
          {{ errorCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>已导入</dt>
        <dd data-stat="imported-count">
          {{ importedCount }}
        </dd>
      </div>
      <div class="metric">
        <dt>是否已导入</dt>
        <dd data-stat="has-imported">
          {{ hasImported ? '是' : '否' }}
        </dd>
      </div>
    </dl>

    <p class="footnote">
      真实项目里把校验规则抽成纯函数，前端先校验一遍，后端再校验一遍；
      错误报告可以导出成带行号的文本，方便用户改完再传。
    </p>
  </div>
</template>

<style scoped>
.bi-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint,
.footnote {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.footnote {
  font-size: var(--demo-text-xs);
}

.panel,
.preview {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.status {
  margin-left: auto;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.preview-head h3 {
  margin: 0;
  font-size: var(--demo-text-md);
  font-weight: 600;
  color: var(--text);
}

.badge {
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  background-color: var(--bg-subtle);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.table-scroll {
  margin-top: 0.5rem;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--demo-text-sm);
}

th,
td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}

th {
  background-color: var(--bg-subtle);
  font-weight: 600;
  color: var(--text);
}

td {
  color: var(--text-secondary);
}

tbody tr:last-child td {
  border-bottom: 0;
}

tr[data-valid='false'] {
  background-color: color-mix(in srgb, var(--danger) 6%, transparent);
}

.ok {
  color: var(--success);
}

.bad {
  color: var(--danger);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  margin: 0;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;

  dt {
    font-size: var(--demo-text-xs);
    color: var(--text-secondary);
  }

  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--demo-text-sm);
    font-weight: 600;
    color: var(--text);
  }
}

@media (max-width: 768px) {
  .metrics {
    grid-template-columns: 1fr 1fr;
  }

  .status {
    width: 100%;
    margin-left: 0;
  }
}
</style>
