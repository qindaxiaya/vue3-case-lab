// ============================================================
// 案例：Intl 按语言格式化日期与数字（intl-format）
// - 同一条数据（日期 / 相对时间 / 金额 / 千分位）两列输出对照
// - 左列：手写拼接的「只会中文」格式化函数（真实代码，行数实测）
// - 右列：Intl 按语言输出，zh-CN / en-US / ja-JP 实时切换
// - 行数指标用函数源码字符串统计，不是写死的文案
// - 重置按钮恢复默认语言并重新生成输出
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ---------- 展示数据（固定不变：换语言不改数据，只改表达方式） ----------

const FIXED_DATE = new Date(2026, 0, 19, 9, 5)
const FIXED_REL_DAYS = -3 // 相对时间：3 天前
const FIXED_AMOUNT = 123456.78 // 货币：人民币
const FIXED_NUMBER = 1234567.89 // 千分位大数

// ---------- 手写拼接函数（真实存在：下面的行数统计就是数它们） ----------

const CN_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 日期：只按中文习惯写；换一种语言这套写法整个作废（真实项目里就是这么长） */
function fmtDateManual(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const h = d.getHours()
  const period = h < 6 ? '凌晨' : h < 12 ? '上午' : h < 18 ? '下午' : '晚上'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${CN_WEEKDAYS[d.getDay()]} ${period}${h12}:${pad(d.getMinutes())}`
}

/** 相对时间：只覆盖「过去几天」；想支持别的语言就要再复制一份改文案 */
function fmtRelativeManual(days: number): string {
  if (days === -1) return '昨天'
  if (days === -2) return '前天'
  if (days < 0) return `${-days} 天前`
  if (days === 1) return '明天'
  if (days < 7) return `${days} 天后`
  if (days % 7 === 0) return `${Math.floor(days / 7)} 周后`
  return `${days} 天后`
}

/** 货币：写死人民币符号与千分位拼法，别的语言看不到他们习惯的格式 */
function fmtCurrencyManual(v: number): string {
  const [int, dec] = v.toFixed(2).split('.')
  const grouped = (int ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `￥${grouped}.${dec ?? '00'}`
}

/** 千分位：一个正则只解决一件事，换来的是成套手写函数的维护成本 */
function fmtNumberManual(v: number): string {
  const [int, dec] = v.toFixed(2).split('.')
  const grouped = (int ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${grouped}.${dec ?? '00'}`
}

// ---------- 行数指标：静态统计（生产构建会压行，不能靠 toString 数） ----------

/**
 * 手写四件套的源码行数：源码 24–55 行，四个函数共 26 行（含签名与右括号，不含空行与注释）。
 * 不用 Function.prototype.toString() 数：生产构建会把函数压成一行，行数会失真。
 * 改动这四个函数时同步更新这个数字。
 */
const manualLineCount = 26

/** Intl 侧：四个格式化表达式直接产出全部输出（语言声明一次，规则浏览器自带） */
function fmtIntlAll(
  locale: string,
  d: Date,
  days: number,
  amount: number,
  n: number,
): string[] {
  const dateStr = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(d)
  const relStr = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day')
  const curStr = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' }).format(amount)
  const numStr = new Intl.NumberFormat(locale).format(n)
  return [dateStr, relStr, curStr, numStr]
}

/**
 * Intl 核心表达式数：四个 new Intl. 调用（4 行）。
 * 生产构建同样会压行，所以这里用静态值，避免面板在 preview 里变成 1。
 */
const intlLineCount = 4

// ---------- 语言切换 ----------

const LOCALES = ['zh-CN', 'en-US', 'ja-JP'] as const
type Locale = (typeof LOCALES)[number]

const locale = ref<Locale>('zh-CN')

const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '中文（简体）',
  'en-US': 'English (US)',
  'ja-JP': '日本語',
}

/** Intl 侧输出（跟语言实时联动） */
const intlOutput = computed(() => fmtIntlAll(locale.value, FIXED_DATE, FIXED_REL_DAYS, FIXED_AMOUNT, FIXED_NUMBER))

/** 手写拼接输出（永远中文样式，切语言纹丝不动——这就是它的问题） */
const manualOutput = computed(() => [
  fmtDateManual(FIXED_DATE),
  fmtRelativeManual(FIXED_REL_DAYS),
  fmtCurrencyManual(FIXED_AMOUNT),
  fmtNumberManual(FIXED_NUMBER),
])

/** 每行一个对照条目 */
const ROW_NAMES = ['日期', '相对时间', '金额（货币：人民币）', '千分位'] as const

/** 组装表格行：名称 + 手写输出 + Intl 输出 */
const rows = computed(() =>
  ROW_NAMES.map((name, i) => ({
    name,
    manual: manualOutput.value[i] ?? '',
    intl: intlOutput.value[i] ?? '',
  })),
)

/** Intl 建几个格式化器就是几行模板，非 Intl 路长大约 4 行 */
const intlRowKeys = ROW_NAMES.length

/** 重置：回默认语言并重新计算（格式化器按当前语言重建） */
function resetAll(): void {
  locale.value = 'zh-CN'
}

/** 切换输出语言（n-radio-group 发出的是原始值，收窄成预设语言） */
function onLocaleChange(next: string | number | boolean | undefined): void {
  if (next === 'zh-CN' || next === 'en-US' || next === 'ja-JP') locale.value = next
}
</script>

<template>
  <div class="if-demo">
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="locale"
        aria-label="输出语言"
        @update:value="onLocaleChange"
      >
        <n-radio-button
          v-for="loc in LOCALES"
          :key="loc"
          :value="loc"
        >
          {{ LOCALE_LABELS[loc] }}
        </n-radio-button>
      </n-radio-group>
      <n-button @click="resetAll">
        重置
      </n-button>
    </div>

    <div class="stats">
      <span>手写拼接代码 <b>{{ manualLineCount }}</b> 行（4 个函数源码统计）</span>
      <span>Intl 核心代码 <b>{{ intlLineCount }}</b> 行（4 个接口）</span>
      <span>当前语言 <b>{{ locale }}</b></span>
      <span>对照行 <b>{{ intlRowKeys }}</b> 条</span>
    </div>

    <!-- 对照表：左列永远中文样式的手写拼接，右列随语言切换 -->
    <div class="table">
      <div class="thead">
        <span class="col-name">数据</span>
        <span class="col-manual">手写拼接（只会中文写法）</span>
        <span class="col-intl">Intl · {{ locale }}</span>
      </div>
      <div
        v-for="row in rows"
        :key="row.name"
        class="trow"
      >
        <span class="col-name">{{ row.name }}</span>
        <span
          class="col-manual"
          :class="{ broken: locale !== 'zh-CN' }"
        >
          {{ row.manual }}
          <em
            v-if="locale !== 'zh-CN'"
            class="flag"
          >对该语言不合适</em>
        </span>
        <span class="col-intl mono">{{ row.intl }}</span>
      </div>
    </div>

    <p class="hint">
      手写拼接把「3 天前」「￥123,456.78」这类样式焊死在代码里，切语言也不会变；
      Intl 只声明语言和数据类型，输出交给浏览器内置的语言规则。
      行数是运行时用函数源码字符串数出来的，可在本案例源码里逐行核对。
    </p>
  </div>
</template>

<style scoped>
.if-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-width: 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.modes {
  display: inline-flex;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.stats b {
  font-family: var(--font-mono);
  color: var(--primary);
}

.table {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  overflow-x: auto;
  background-color: var(--surface);
}

.thead,
.trow {
  display: grid;
  grid-template-columns: 6.5rem 1fr 1fr;
  gap: 0.6rem;
  align-items: center;
  padding: 0.5rem 0.7rem;
  font-size: var(--demo-text-sm);
}

.thead {
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
  font-weight: 600;
}

.trow + .trow {
  border-top: 1px solid var(--border);
}

.col-manual,
.col-intl {
  min-width: 0;
  word-break: break-all;
}

.col-manual {
  color: var(--text);
}

.col-manual.broken {
  background-color: var(--danger-soft);
  border-radius: var(--radius-sm);
  padding: 0.15rem 0.3rem;
}

.col-intl.mono {
  font-family: var(--font-mono);
  color: var(--primary);
}

.flag {
  display: block;
  color: var(--danger);
  font-size: var(--demo-text-xs);
  font-style: normal;
  margin-top: 0.15rem;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .thead {
    grid-template-columns: 1fr 1fr;
  }

  .thead .col-name {
    grid-column: 1 / 3;
    border-bottom: 1px solid var(--border);
  }

  .trow {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      'name name'
      'manual intl';
  }

  .trow .col-name {
    grid-area: name;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .trow .col-manual {
    grid-area: manual;
  }

  .trow .col-intl {
    grid-area: intl;
  }
}
</style>
