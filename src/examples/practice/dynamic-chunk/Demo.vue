// ============================================================
// 案例：运行时按需加载（dynamic-chunk）
// - 三个功能模块平时不下载，点按钮才 import()，真实测量新增字节与耗时
// - 「全量预载」模式演示错误做法：点任意一个按钮，三个模块一起下载
// - 第二次点击命中浏览器模块缓存，用来对比「首次下载」和「缓存命中」
// - 注入失败：演示加载失败后的错误提示与重试
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MdBlock } from './modules/mini-markdown'

/** 三个可独立加载的功能 */
type ModuleKey = 'report' | 'csv' | 'markdown'

/** 加载模式：按需（正确）/ 全量（错误对照） */
type LoadMode = 'lazy' | 'full'

interface Feature {
  key: ModuleKey
  title: string
  desc: string
  /** 资源计时要匹配的文件名片段（开发环境是源文件名，构建后是打包文件名） */
  chunks: string[]
}

/** 功能清单：文案与匹配片段集中在这里，模板只负责渲染 */
const FEATURES: Feature[] = [
  {
    key: 'report',
    title: '城市人口报表',
    desc: '聚合 80 个城市，按国家汇总人口并取前五',
    chunks: ['city-report', 'city-data'],
  },
  {
    key: 'csv',
    title: 'CSV 解析',
    desc: '解析 400 行带引号、含逗号字段的表格',
    chunks: ['csv-kit'],
  },
  {
    key: 'markdown',
    title: '迷你 Markdown',
    desc: '把一段笔记渲染成标题与列表',
    chunks: ['mini-markdown'],
  },
]

/** 全量入口依赖的文件（按需模式下都不会请求） */
const FULL_CHUNKS = ['full-kit', 'city-report', 'city-data', 'csv-kit', 'mini-markdown']

/** 一次加载的测量结果 */
interface Sample {
  id: number
  key: ModuleKey
  mode: LoadMode
  /** import() 到模块可用的耗时（含网络与解析） */
  loadMs: number
  /** 真正执行功能代码的耗时 */
  runMs: number
  /** 本次新增下载的字节（命中缓存为 0） */
  bytes: number
  /** 浏览器资源计时里的传输耗时（拿不到为 null） */
  resourceMs: number | null
  /** 是否命中模块缓存 */
  cached: boolean
}

const mode = ref<LoadMode>('lazy')
const loading = ref<ModuleKey | null>(null)
const error = ref('')
const injectFailure = ref(false)

/** 已完整加载过的功能（用来判断「缓存命中」） */
const loadedKeys = ref<Set<ModuleKey>>(new Set())
/** 已经统计过字节的请求地址（避免重复计数） */
const countedUrls = new Set<string>()
/** 已请求的文件数（重置时清空） */
const requestCount = ref(0)

const samples = ref<Sample[]>([])
let sampleId = 0

/** 结果区内容：普通功能用文本行，Markdown 用结构化块 */
const resultTitle = ref('')
const resultLines = ref<string[]>([])
const mdBlocks = ref<MdBlock[]>([])

// ---------- 测量工具 ----------

/**
 * 汇总「本次新增」的模块文件字节与传输耗时
 * - 只统计 dynamic-chunk 目录（开发）或 assets 目录（构建）下的请求
 * - 同一个地址只算一次：第二次点击时字节数为 0，正好体现缓存
 */
function collectChunks(names: string[]): { bytes: number; resourceMs: number | null } {
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  let bytes = 0
  let resourceMs: number | null = null

  for (const entry of entries) {
    if (countedUrls.has(entry.name)) continue
    const inCase = entry.name.includes('/dynamic-chunk/') || entry.name.includes('/assets/')
    const matched = names.some((name) => entry.name.includes(name))
    if (!inCase || !matched) continue

    countedUrls.add(entry.name)
    requestCount.value += 1
    // decodedBodySize 是解压后的体积；部分环境为 0，退回 transferSize
    bytes += entry.decodedBodySize || entry.transferSize || 0
    if (resourceMs === null || entry.duration > resourceMs) {
      resourceMs = Math.round(entry.duration)
    }
  }

  return { bytes, resourceMs }
}

/** 字节数展示：超过 1 KB 换成 KB，方便读 */
function formatBytes(value: number): string {
  if (value === 0) return '0 B'
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(1)} KB`
}

/** 毫秒展示：小于 10 ms 保留一位小数，避免全是 0 / 1 */
function formatMs(value: number): string {
  return value < 10 ? `${value.toFixed(1)} ms` : `${Math.round(value)} ms`
}

// ---------- 各功能的真实工作 ----------

/**
 * 执行功能
 * 注意：这里的 import() 和上面的加载是同一份模块，第二次调用直接命中缓存，
 * 所以「执行耗时」测到的只有真实计算时间。
 */
async function execute(key: ModuleKey): Promise<number> {
  const started = performance.now()

  if (key === 'report') {
    const { buildReport } = await import('./modules/city-report')
    const result = buildReport()
    resultTitle.value = `城市人口报表：${result.totalCities} 个城市 / ${result.countries.length} 个国家`
    resultLines.value = [
      '人口最多的 5 个城市：',
      ...result.topCities.map(
        (row, index) => `${index + 1}. ${row[0]}（${row[1]}）${row[4]} 万`,
      ),
      '',
      '国家汇总（前 5）：',
      ...result.countries
        .slice(0, 5)
        .map((stat) => `${stat.country}：${stat.cities} 城 / ${stat.population} 万`),
    ]
    mdBlocks.value = []
  } else if (key === 'csv') {
    const { buildSampleCsv, parseCsv } = await import('./modules/csv-kit')
    const text = buildSampleCsv(400)
    const parsed = parseCsv(text)
    const quoted = parsed.rows.find((row) => row[1].includes(','))
    resultTitle.value = `CSV 解析：${parsed.rows.length} 行 / ${parsed.header.length} 列`
    resultLines.value = [
      `表头：${parsed.header.join(' | ')}`,
      `首行：${parsed.rows[0]?.join(' | ') ?? '（空）'}`,
      `带引号且含逗号的字段：${quoted ? quoted[1] : '未找到'}`,
      `原始文本长度：${text.length} 字符`,
    ]
    mdBlocks.value = []
  } else {
    const { renderMarkdown, SAMPLE_DOC } = await import('./modules/mini-markdown')
    resultTitle.value = '迷你 Markdown 渲染结果'
    resultLines.value = []
    mdBlocks.value = renderMarkdown(SAMPLE_DOC)
  }

  return performance.now() - started
}

// ---------- 主流程 ----------

/**
 * 按当前模式加载并运行一个功能
 * 三种「首次代价」都记下来：import 耗时、功能执行耗时、新增下载字节
 */
async function run(key: ModuleKey): Promise<void> {
  if (loading.value) return

  loading.value = key
  error.value = ''
  const feature = FEATURES.find((item) => item.key === key)
  const cached = loadedKeys.value.has(key)

  try {
    // 注入失败：在 import 之前抛出，模拟弱网下载失败
    if (injectFailure.value) {
      injectFailure.value = false
      throw new Error('模拟网络中断：模块下载失败，已自动关闭注入，可再点一次重试')
    }

    const started = performance.now()

    if (mode.value === 'full') {
      // 错误做法：任意按钮都先下载全量入口，三个模块一起到手
      await import('./modules/full-kit')
    } else if (key === 'report') {
      await import('./modules/city-report')
    } else if (key === 'csv') {
      await import('./modules/csv-kit')
    } else {
      await import('./modules/mini-markdown')
    }

    const loadMs = performance.now() - started

    // 先执行再统计：资源计时条目可能比 import 的 Promise 晚一拍登记，
    // 提前统计会漏掉最后一个文件（实测全量模式偶尔少算一个模块的字节）
    const runMs = await execute(key)
    loadedKeys.value.add(key)

    const names = mode.value === 'full' ? FULL_CHUNKS : feature?.chunks ?? []
    const { bytes, resourceMs } = collectChunks(names)

    samples.value.push({
      id: (sampleId += 1),
      key,
      mode: mode.value,
      loadMs,
      runMs,
      bytes,
      resourceMs,
      cached,
    })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    loading.value = null
  }
}

/** 清空读数：只清统计，浏览器已经缓存的模块不会卸载 */
function resetReadings(): void {
  samples.value = []
  countedUrls.clear()
  requestCount.value = 0
  // loadedKeys 故意不清：模块仍在浏览器缓存里，清掉会让下一次显示成「首次下载」，
  // 反而和实际耗时（几毫秒）对不上
  resultTitle.value = ''
  resultLines.value = []
  mdBlocks.value = []
  error.value = ''
}

/** 每个功能最近一次测量结果（模板里按 key 取） */
const latestByKey = computed<Partial<Record<ModuleKey, Sample>>>(() => {
  const map: Partial<Record<ModuleKey, Sample>> = {}
  for (const sample of samples.value) map[sample.key] = sample
  return map
})

/** 本次会话新增下载的总字节 */
const totalBytes = computed(() =>
  samples.value.reduce((sum, sample) => sum + sample.bytes, 0),
)

/** 是否还没有任何结果可展示 */
const hasResult = computed(
  () => resultLines.value.length > 0 || mdBlocks.value.length > 0,
)

/** 功能名（记录表里显示中文） */
function featureTitle(key: ModuleKey): string {
  return FEATURES.find((item) => item.key === key)?.title ?? key
}
</script>

<template>
  <div class="dc-demo">
    <!-- 模式开关：同一套按钮，两种加载策略 -->
    <div class="mode-bar">
      <div
        class="mode-switch"
        role="group"
        aria-label="加载模式"
      >
        <button
          type="button"
          class="mode-btn"
          :class="{ 'mode-btn--active': mode === 'lazy' }"
          :aria-pressed="mode === 'lazy'"
          @click="mode = 'lazy'"
        >
          按需加载
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ 'mode-btn--active': mode === 'full' }"
          :aria-pressed="mode === 'full'"
          @click="mode = 'full'"
        >
          全量预载
        </button>
      </div>
      <p class="mode-hint">
        {{
          mode === 'lazy'
            ? '点哪个模块才下载哪个（推荐）'
            : '点任意按钮都会把三个模块一起下载（对照用）'
        }}
      </p>
    </div>

    <!-- 三个功能：每个都能独立触发一次真实下载 -->
    <div class="feature-grid">
      <article
        v-for="feature in FEATURES"
        :key="feature.key"
        class="feature"
      >
        <h3 class="feature-title">
          {{ feature.title }}
        </h3>
        <p class="feature-desc">
          {{ feature.desc }}
        </p>
        <p class="feature-files">
          {{ feature.chunks.join(' + ') }}
        </p>

        <button
          type="button"
          class="btn-act"
          :disabled="loading !== null"
          @click="run(feature.key)"
        >
          {{ loading === feature.key ? '加载中…' : '加载并运行' }}
        </button>

        <!-- 最近一次点击的真实代价 -->
        <dl
          v-if="latestByKey[feature.key]"
          class="feature-metrics"
        >
          <div>
            <dt>加载</dt>
            <dd>{{ formatMs(latestByKey[feature.key]?.loadMs ?? 0) }}</dd>
          </div>
          <div>
            <dt>新增字节</dt>
            <dd>{{ formatBytes(latestByKey[feature.key]?.bytes ?? 0) }}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{{ latestByKey[feature.key]?.cached ? '缓存命中' : '首次下载' }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <!-- 失败注入：演示错误提示与重试 -->
    <div class="fail-row">
      <button
        type="button"
        class="btn-mini"
        :class="{ 'btn-mini--on': injectFailure }"
        :aria-pressed="injectFailure"
        @click="injectFailure = !injectFailure"
      >
        {{ injectFailure ? '已开启：下一次点击会失败' : '注入一次加载失败' }}
      </button>
      <span
        v-if="error"
        class="error-text"
      >{{ error }}</span>
    </div>

    <!-- 运行结果 -->
    <section
      v-if="hasResult"
      class="result"
      aria-live="polite"
    >
      <h4 class="result-title">
        {{ resultTitle }}
      </h4>

      <pre
        v-if="resultLines.length"
        class="result-pre"
      >{{ resultLines.join('\n') }}</pre>

      <div
        v-else
        class="md-view"
      >
        <template
          v-for="(block, index) in mdBlocks"
          :key="index"
        >
          <h5
            v-if="block.type === 'heading'"
            class="md-heading"
          >
            {{ block.text }}
          </h5>
          <ul
            v-else-if="block.type === 'list'"
            class="md-list"
          >
            <li
              v-for="(item, itemIndex) in block.items"
              :key="itemIndex"
            >
              {{ item }}
            </li>
          </ul>
          <p
            v-else
            class="md-p"
          >
            {{ block.text }}
          </p>
        </template>
      </div>
    </section>

    <!-- 加载记录：一屏看清每次点击到底下载了什么 -->
    <section class="log">
      <header class="log-head">
        <h4 class="log-title">
          加载记录
        </h4>
        <button
          type="button"
          class="btn-mini"
          @click="resetReadings"
        >
          清空读数
        </button>
      </header>

      <p
        v-if="samples.length === 0"
        class="log-empty"
      >
        还没有下载任何模块 —— 首屏只有这段演示本身的代码。
      </p>

      <table
        v-else
        class="log-table"
      >
        <thead>
          <tr>
            <th>功能</th>
            <th>模式</th>
            <th>加载</th>
            <th>新增字节</th>
            <th>执行</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="sample in samples"
            :key="sample.id"
          >
            <td>{{ featureTitle(sample.key) }}</td>
            <td>{{ sample.mode === 'lazy' ? '按需' : '全量' }}</td>
            <td>{{ formatMs(sample.loadMs) }}</td>
            <td>{{ formatBytes(sample.bytes) }}</td>
            <td>{{ formatMs(sample.runMs) }}</td>
          </tr>
        </tbody>
      </table>

      <p class="log-total">
        本次新增下载 <b>{{ formatBytes(totalBytes) }}</b>
        · 已请求 {{ requestCount }} 个模块文件
        <span class="log-tip">清空读数不会卸载已缓存的模块</span>
      </p>
    </section>
  </div>
</template>

<style scoped>
.dc-demo {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  font-size: 0.875rem;
}

/* ---------- 模式开关 ---------- */

.mode-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.9rem;
}

.mode-switch {
  display: inline-flex;
  padding: 3px;
  background-color: var(--surface-muted, rgba(127, 127, 127, 0.1));
  border: 1px solid var(--border);
  border-radius: 999px;
}

.mode-btn {
  padding: 0.3rem 0.85rem;
  font-family: inherit;
  font-size: 0.8rem;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition:
    color var(--transition),
    background-color var(--transition);
}

.mode-btn--active {
  color: #fff;
  background-color: var(--primary);
}

.mode-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* ---------- 功能卡片 ---------- */

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.feature {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.85rem 0.9rem;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
}

.feature-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
}

.feature-desc {
  flex: 1;
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.65;
  color: var(--text-secondary);
}

/* 模块文件名：小号等宽，帮读者建立「按钮 ↔ 文件」的对应 */
.feature-files {
  margin: 0 0 0.15rem;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  line-height: 1.5;
  color: var(--primary);
  word-break: break-all;
}

.btn-act {
  padding: 0.42rem 0.7rem;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  color: #fff;
  background-color: var(--primary);
  border: none;
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition:
    opacity var(--transition),
    transform var(--transition);
}

.btn-act:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-act:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-act:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

/* 测量结果：三列小格子，数字用等宽字体 */
.feature-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  margin: 0.15rem 0 0;
}

.feature-metrics > div {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.feature-metrics dt {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.feature-metrics dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
}

/* ---------- 失败注入 ---------- */

.fail-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.btn-mini {
  padding: 0.26rem 0.65rem;
  font-family: inherit;
  font-size: 0.76rem;
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition:
    color var(--transition),
    border-color var(--transition);
}

.btn-mini:hover {
  color: var(--primary);
  border-color: var(--primary);
}

.btn-mini--on {
  color: var(--danger);
  border-color: var(--danger);
}

.error-text {
  font-size: 0.78rem;
  color: var(--danger);
}

/* ---------- 结果 ---------- */

.result {
  padding: 0.8rem 0.9rem;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--primary);
  border-radius: var(--radius-btn);
}

.result-title {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.result-pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.76rem;
  line-height: 1.7;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
}

.md-view {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.md-heading {
  margin: 0.15rem 0 0;
  font-size: 0.88rem;
  font-weight: 600;
}

.md-list {
  margin: 0;
  padding-left: 1.15rem;
  font-size: 0.8rem;
  line-height: 1.75;
  color: var(--text-secondary);
}

.md-p {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.7;
  color: var(--text-secondary);
}

/* ---------- 加载记录 ---------- */

.log {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.log-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
}

.log-empty {
  margin: 0;
  padding: 0.6rem 0.75rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
  background-color: var(--surface);
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.76rem;
}

.log-table th,
.log-table td {
  padding: 0.32rem 0.4rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.log-table th {
  font-weight: 500;
  color: var(--text-secondary);
}

.log-table td:nth-child(3),
.log-table td:nth-child(4),
.log-table td:nth-child(5) {
  font-family: var(--font-mono);
}

/* 窄屏允许表格内部横滚，页面本身不溢出 */
.log {
  overflow-x: auto;
}

.log-total {
  margin: 0;
  font-size: 0.77rem;
  color: var(--text-secondary);
}

.log-total b {
  font-family: var(--font-mono);
  color: var(--text);
}

.log-tip {
  margin-left: 0.35rem;
  opacity: 0.75;
}

@media (max-width: 720px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
