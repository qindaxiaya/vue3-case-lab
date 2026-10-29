// ============================================================
// 案例：structuredClone 深拷贝与类型保真（structured-clone）
// - 10 万条含日期与嵌套映射的对象，三种深拷贝实测耗时
// - structuredClone / JSON 字符串往返 / 展开 + 手动点名
// - 五种引用类型（日期/映射/集合/正则/循环引用）逐项打勾
// - 判定规则：拷出独立新对象才算支持（共享原引用算失败）
// - 数据规模可切换，重置可复现
// ============================================================
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

// ---------- 数据模型 ----------

/** 每条记录：日期 + 数组 + 嵌套映射（映射即键值集合） */
interface Item {
  id: number
  name: string
  createdAt: Date
  tags: string[]
  meta: Map<string, string>
}

const TAGS = ['接口同步', '后台录入', '脚本迁移'] as const

/** 固定内容生成器：同样的规模生成同样的数据，保证测量可复现 */
function buildItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `记录 #${String(i).padStart(6, '0')}`,
    createdAt: new Date(Date.UTC(2020, i % 12, (i % 27) + 3, 8, 0, 0)),
    tags: [TAGS[i % TAGS.length] ?? '', TAGS[(i + 1) % TAGS.length] ?? ''],
    meta: new Map<string, string>([
      ['来源', i % 3 === 0 ? '接口' : '后台'],
      ['批次', `B${(i % 8) + 1}`],
    ]),
  }))
}

// ---------- 三种拷法 ----------

type CopyFn = (items: Item[]) => unknown

/** 法一：结构化克隆（浏览器原生） */
const copyStructured: CopyFn = (items) => structuredClone(items)

/** 法二：JSON 字符串往返（丢类型的老办法） */
const copyJson: CopyFn = (items) => JSON.parse(JSON.stringify(items)) as unknown

/** 法三：展开 + 手动点名每个特殊字段（漏一个就共享原引用） */
const copySpread: CopyFn = (items) =>
  items.map((it) => ({
    ...it,
    createdAt: new Date(it.createdAt.getTime()),
    tags: [...it.tags],
    meta: new Map(it.meta),
  }))

const METHODS = [
  { key: 'structured', label: 'structuredClone（结构化克隆）', copy: copyStructured },
  { key: 'json', label: 'JSON.parse(JSON.stringify)', copy: copyJson },
  { key: 'spread', label: '展开 + 手动点名', copy: copySpread },
] as const

type MethodKey = (typeof METHODS)[number]['key']

/** 每种方法的测量结果：耗时中位数 + 副本里仍是真日期的条数 */
interface MethodResult {
  ms: number | null
  dateFidelity: number | null
}

// ---------- 状态 ----------

const SIZES = [10000, 100000] as const
type Size = (typeof SIZES)[number]

const size = ref<Size>(10000)
const measuring = ref(false)
const progress = ref('点「重测三种方法」开始：同数据各跑 3 轮取中位数')

const results = ref<Record<MethodKey, MethodResult>>({
  structured: { ms: null, dateFidelity: null },
  json: { ms: null, dateFidelity: null },
  spread: { ms: null, dateFidelity: null },
})

/** 数据只按当前规模生成一次并缓存；规模变化时重建（watch 里） */
let dataset: Item[] | null = null

watch(size, () => {
  dataset = null
  results.value = resetResults()
  progress.value = `数据规模已切到 ${size.value.toLocaleString()} 条，点「重测」重新测量`
})

function resetResults(): Record<MethodKey, MethodResult> {
  return {
    structured: { ms: null, dateFidelity: null },
    json: { ms: null, dateFidelity: null },
    spread: { ms: null, dateFidelity: null },
  }
}

// ---------- 测量 ----------

/** 三次取中位数，避免单次抖动 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

/** 副本里「真日期」条数：判断拷后类型是否保真 */
function countTrueDates(clone: unknown): number {
  if (!Array.isArray(clone)) return 0
  let n = 0
  for (const entry of clone) {
    // instanceof 判定：类型变字符串/丢失即不计入
    if (typeof entry === 'object' && entry !== null && (entry as { createdAt?: unknown }).createdAt instanceof Date) n++
  }
  return n
}

/** 让界面喘口气：把 UI 从重活里解放出来再收结果 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** 重测三种方法：同数据三轮取中位数 */
async function measureAll(): Promise<void> {
  if (measuring.value) return
  measuring.value = true
  results.value = resetResults()

  if (!dataset) {
    dataset = buildItems(size.value)
    await nextFrame()
  }
  const data = dataset

  for (const method of METHODS) {
    const runs: number[] = []
    for (let round = 1; round <= 3; round++) {
      progress.value = `${method.label}：第 ${round}/3 轮…`
      await nextFrame()
      const start = performance.now()
      const clone = method.copy(data)
      const ms = performance.now() - start
      runs.push(Math.round(ms * 10) / 10)
      // 保真条数用最后一轮的副本统计（避免三次都扫一遍 10 万条）
      if (round === 3) {
        results.value[method.key] = {
          ms: median(runs),
          dateFidelity: countTrueDates(clone),
        }
      }
    }
  }

  progress.value = '测量完成：三方法各 3 轮取中位数；点「重测」可复现'
  measuring.value = false
}

/** 重置：清结果与预览，不动数据规模 */
function resetAll(): void {
  results.value = resetResults()
  progress.value = '已重置，点「重测三种方法」重新测量'
}

/** 切换数据规模（n-radio-group 发出的是原始值，收窄成预设档位） */
function onSizeChange(next: string | number | boolean | undefined): void {
  if (typeof next === 'number' && (SIZES as readonly number[]).includes(next)) {
    size.value = next as Size
  }
}

// ---------- 支持类型判定（小样本逐项测试） ----------

/** 五种引用类型的支持结果 */
interface SupportProbe {
  date: boolean
  map: boolean
  set: boolean
  regex: boolean
  cyclic: boolean
}

const support = ref<Record<MethodKey, SupportProbe>>({
  structured: { date: false, map: false, set: false, regex: false, cyclic: false },
  json: { date: false, map: false, set: false, regex: false, cyclic: false },
  spread: { date: false, map: false, set: false, regex: false, cyclic: false },
})

/** 组合样本：date / map / set / regex 各占一个字段 */
function buildSample(): { date: Date; map: Map<string, number>; set: Set<number>; regex: RegExp } {
  return {
    date: new Date(2020, 0, 1),
    map: new Map([['k', 1]]),
    set: new Set([1, 2]),
    regex: /a+/g,
  }
}

/** 逐项判定：独立新对象且类型仍在才算支持 */
function judge(
  copy: { date?: unknown; map?: unknown; set?: unknown; regex?: unknown },
  sample: { date: Date; map: Map<string, number>; set: Set<number>; regex: RegExp },
): Omit<SupportProbe, 'cyclic'> {
  return {
    date: copy.date !== sample.date && copy.date instanceof Date,
    map: copy.map !== sample.map && copy.map instanceof Map,
    set: copy.set !== sample.set && copy.set instanceof Set,
    regex: copy.regex !== sample.regex && copy.regex instanceof RegExp,
  }
}

/** 结构化克隆：全部真实类型按类型克隆，循环引用也不绕死 */
function probeStructured(): SupportProbe {
  try {
    const sample = buildSample()
    const copy = structuredClone(sample)
    const cyc: { self?: unknown } = {}
    cyc.self = cyc
    const cyc2 = structuredClone(cyc)
    return { ...judge(copy, sample), cyclic: cyc2.self === cyc2 }
  }
  catch {
    return { date: false, map: false, set: false, regex: false, cyclic: false }
  }
}

/** JSON 往返：只有基础类型生还，循环引用直接抛错 */
function probeJson(): SupportProbe {
  try {
    const sample = buildSample()
    const copy = JSON.parse(
      JSON.stringify(sample),
    ) as { date?: unknown; map?: unknown; set?: unknown; regex?: unknown }
    return {
      ...judge(copy, sample),
      cyclic: ((): boolean => {
        const cyc: { self?: unknown } = {}
        cyc.self = cyc
        try {
          JSON.stringify(cyc)
          return true
        }
        catch {
          return false // 循环引用在 string 化时抛错：这条路走不通
        }
      })(),
    }
  }
  catch {
    return { date: false, map: false, set: false, regex: false, cyclic: false }
  }
}

/** 展开 + 手动点名：点过名的字段生还，其余共享原引用（等于没拷） */
function probeSpread(): SupportProbe {
  try {
    const sample = buildSample()
    const copy = {
      ...sample,
      date: new Date(sample.date.getTime()),
      map: new Map(sample.map),
      // set / regex 没写对应分支：原引用直接带过去
    }
    const cyc: { self?: unknown } = {}
    cyc.self = cyc
    const cyc2 = { ...cyc } // 展开 1 层不递归：self 仍指到原对象
    return { ...judge(copy, sample), cyclic: cyc2.self === cyc2 }
  }
  catch {
    return { date: false, map: false, set: false, regex: false, cyclic: false }
  }
}

/** 跑一次三种判定 */
function measureSupport(): void {
  support.value = {
    structured: probeStructured(),
    json: probeJson(),
    spread: probeSpread(),
  }
}

// 支持类型判定很轻，直接在挂载时跑一遍，保证打开页面就有结论
onMounted(() => {
  measureSupport()
})
</script>

<template>
  <div class="sc-demo">
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="size"
        aria-label="数据规模"
        :disabled="measuring"
        @update:value="onSizeChange"
      >
        <n-radio-button
          v-for="s in SIZES"
          :key="s"
          :value="s"
        >
          {{ s.toLocaleString() }} 条
        </n-radio-button>
      </n-radio-group>
      <n-button
        type="primary"
        :disabled="measuring"
        @click="measureAll"
      >
        {{ measuring ? '测量中…' : '重测三种方法' }}
      </n-button>
      <n-button
        :disabled="measuring"
        @click="resetAll"
      >
        重置
      </n-button>
    </div>

    <div class="stats">
      <span>数据规模 <b>{{ size.toLocaleString() }}</b> 条</span>
      <template
        v-for="method in METHODS"
        :key="method.key"
      >
        <span>{{ method.key }} 耗时 <b>{{ results[method.key].ms ?? '—' }}</b> ms</span>
        <span>真日期副本 <b>{{ results[method.key].dateFidelity ?? '—' }}</b> 条</span>
      </template>
    </div>

    <!-- 支持类型判定表 -->
    <div class="table">
      <div class="thead">
        <span class="col-type">引用类型</span>
        <span
          v-for="method in METHODS"
          :key="method.key"
          class="col-probe"
        >{{ method.label }}</span>
      </div>
      <div
        v-for="row in ['date', 'map', 'set', 'regex', 'cyclic'] as const"
        :key="row"
        class="trow"
      >
        <span class="col-type">{{ ({ date: '日期 Date', map: '映射 Map（键值集合）', set: '集合 Set', regex: '正则对象', cyclic: '循环引用' })[row] }}</span>
        <span
          v-for="method in METHODS"
          :key="method.key"
          class="col-probe"
          :class="support[method.key][row] ? 'yes' : 'no'"
        >
          {{ support[method.key][row] ? '独立副本 通过' : '失败（丢失/共享）' }}
        </span>
      </div>
    </div>

    <p class="progress">
      {{ progress }}
    </p>
    <p class="hint">
      判定规则：拷出「独立的新对象且类型不丢」才算通过；共享原引用或类型消失都算失败。
      展开法只对点过名的字段（日期+映射）有效；测试数据每次按固定规则重建，测量可复现。
    </p>
  </div>
</template>

<style scoped>
.sc-demo {
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
  grid-template-columns: minmax(9rem, 1.2fr) repeat(3, minmax(11rem, 1fr));
  gap: 0.5rem;
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

.col-probe.yes {
  color: var(--success);
}

.col-probe.no {
  color: var(--danger);
}

.progress {
  margin: 0;
  font-size: var(--demo-text-sm);
  color: var(--primary);
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
