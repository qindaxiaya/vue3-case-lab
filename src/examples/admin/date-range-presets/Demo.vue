// ============================================================
// 案例：date-range-presets 日期范围快捷筛选
// 快捷项与自定义共用一套起止范围，结束日包含当天
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

type Preset = 'today' | '7d' | '30d' | 'custom'

interface RecordItem {
  id: number
  title: string
  date: string
  amount: number
}

/** 固定基准日：演示不依赖今天，结果才能稳定复现 */
const BASE_DATE = '2026-11-08'
const BASE = new Date(2026, 10, 8)

const records: RecordItem[] = [
  { id: 1, title: '订单 A-108', date: '2026-11-08', amount: 120 },
  { id: 2, title: '订单 A-107', date: '2026-11-08', amount: 80 },
  { id: 3, title: '订单 A-106', date: '2026-11-04', amount: 200 },
  { id: 4, title: '订单 A-105', date: '2026-11-05', amount: 150 },
  { id: 5, title: '订单 A-104', date: '2026-11-03', amount: 90 },
  { id: 6, title: '订单 A-103', date: '2026-11-02', amount: 300 },
  { id: 7, title: '订单 A-102', date: '2026-10-10', amount: 60 },
  { id: 8, title: '订单 A-101', date: '2026-10-20', amount: 45 },
  { id: 9, title: '订单 A-100', date: '2026-10-28', amount: 500 },
  { id: 10, title: '订单 A-099', date: '2026-11-01', amount: 75 },
  { id: 11, title: '订单 A-098', date: '2026-10-01', amount: 30 },
  { id: 12, title: '订单 A-097', date: '2026-09-15', amount: 20 },
]

const preset = ref<Preset>('7d')
const draftStart = ref('2026-11-02')
const draftEnd = ref('2026-11-08')
const appliedStart = ref('2026-11-02')
const appliedEnd = ref('2026-11-08')
const error = ref('')

/**! 本地格式化：toISOString 会按 UTC 截断，东八区凌晨会少一天 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return formatDate(date) === value ? date : null
}

/** 快捷项只负责算起止，真正筛选统一读 appliedStart / appliedEnd */
function presetRange(value: Preset): { start: string; end: string } | null {
  if (value === 'today') return { start: BASE_DATE, end: BASE_DATE }
  if (value === '7d') return { start: formatDate(addDays(BASE, -6)), end: BASE_DATE }
  if (value === '30d') return { start: formatDate(addDays(BASE, -29)), end: BASE_DATE }
  return null
}

const presetLabel = computed(() => {
  if (preset.value === 'today') return '今天'
  if (preset.value === '7d') return '近 7 天'
  if (preset.value === '30d') return '近 30 天'
  return '自定义'
})

const rangeText = computed(() => `${appliedStart.value} ~ ${appliedEnd.value}`)

/** 字符串比较即可：YYYY-MM-DD 的字典序和日期序一致，结束日 <= 才包含当天 */
const resultRows = computed(() =>
  records
    .filter((item) => item.date >= appliedStart.value && item.date <= appliedEnd.value)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
)

function applyPreset(value: string | number | boolean | undefined): void {
  if (value !== 'today' && value !== '7d' && value !== '30d' && value !== 'custom') return
  error.value = ''
  if (value === 'custom') {
    preset.value = 'custom'
    return
  }
  const range = presetRange(value)
  if (!range) return
  preset.value = value
  draftStart.value = range.start
  draftEnd.value = range.end
  appliedStart.value = range.start
  appliedEnd.value = range.end
}

/**! 自定义只改草稿，点应用才校验并替换已生效范围 */
function applyCustom(): void {
  const start = parseDate(draftStart.value)
  const end = parseDate(draftEnd.value)
  if (!start || !end) {
    error.value = '日期格式应为 YYYY-MM-DD'
    return
  }
  if (draftEnd.value < draftStart.value) {
    error.value = '结束日期不能早于开始日期'
    return
  }
  error.value = ''
  preset.value = 'custom'
  appliedStart.value = draftStart.value
  appliedEnd.value = draftEnd.value
}

function reset(): void {
  applyPreset('7d')
}
</script>

<template>
  <div class="drp-demo">
    <p class="hint">
      快捷日期最容易各算各的：今天、近 7 天、近 30 天各写一段起止计算，最后和自定义
      对不上。这里所有入口都落到同一组已生效的起止日期上。
    </p>

    <section class="panel">
      <div class="toolbar">
        <n-radio-group
          class="drp-presets"
          :value="preset"
          size="small"
          @update:value="applyPreset"
        >
          <n-radio-button
            value="today"
            data-preset="today"
          >
            今天
          </n-radio-button>
          <n-radio-button
            value="7d"
            data-preset="7d"
          >
            近 7 天
          </n-radio-button>
          <n-radio-button
            value="30d"
            data-preset="30d"
          >
            近 30 天
          </n-radio-button>
          <n-radio-button value="custom">
            自定义
          </n-radio-button>
        </n-radio-group>
      </div>

      <div class="custom-row">
        <label class="field">
          <span>开始</span>
          <n-input
            v-model:value="draftStart"
            size="small"
            placeholder="YYYY-MM-DD"
            data-field="start"
          />
        </label>
        <label class="field">
          <span>结束</span>
          <n-input
            v-model:value="draftEnd"
            size="small"
            placeholder="YYYY-MM-DD"
            data-field="end"
          />
        </label>
        <n-button
          size="small"
          type="primary"
          data-action="apply-custom"
          @click="applyCustom"
        >
          应用自定义
        </n-button>
        <n-button
          size="small"
          quaternary
          data-action="reset"
          @click="reset"
        >
          重置
        </n-button>
      </div>

      <div class="summary">
        <span>
          当前
          <strong data-stat="preset">{{ presetLabel }}</strong>
        </span>
        <span>
          范围
          <strong data-stat="range-text">{{ rangeText }}</strong>
        </span>
        <span>
          命中
          <strong data-stat="result-count">{{ resultRows.length }}</strong>
          条
        </span>
      </div>

      <p
        v-if="error"
        class="error"
        data-stat="error-text"
      >
        {{ error }}
      </p>

      <ul class="records">
        <li
          v-for="item in resultRows"
          :key="item.id"
          class="record"
        >
          <span class="record-title">{{ item.title }}</span>
          <span class="record-date">{{ item.date }}</span>
          <span class="record-amount">¥{{ item.amount }}</span>
        </li>
        <li
          v-if="resultRows.length === 0"
          class="empty"
        >
          这个范围没有记录
        </li>
      </ul>
    </section>

    <p class="footnote">
      快捷项只生成起止字符串，筛选永远只读已生效的那一组；自定义点「应用」前不改变结果。
      错误时保留上一次结果，用户改完日期再试即可。
    </p>
  </div>
</template>

<style scoped>
.drp-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

.panel {
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.toolbar {
  margin-bottom: 0.55rem;
}

.custom-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.45rem 0.6rem;
  margin-bottom: 0.6rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  margin-bottom: 0.5rem;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);

  strong {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.error {
  margin: 0 0 0.5rem;
  padding: 0.35rem 0.55rem;
  border-radius: var(--radius-tag);
  background-color: color-mix(in srgb, var(--danger) 10%, transparent);
  font-size: var(--demo-text-xs);
  color: var(--danger);
}

.records {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.record {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.5rem;
  border-radius: var(--demo-radius);
  background-color: var(--bg-subtle);
  font-size: var(--demo-text-sm);
}

.record-title {
  flex: 1;
  min-width: 0;
}

.record-date {
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.record-amount {
  min-width: 4rem;
  text-align: right;
  font-family: var(--font-mono);
  color: var(--text);
}

.empty {
  padding: 1rem 0;
  text-align: center;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.footnote {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .field {
    flex: 1 1 8rem;
  }
}
</style>
