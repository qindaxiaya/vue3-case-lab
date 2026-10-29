// ============================================================
// 案例：Clipboard 写入与降级复制（clipboard-api）
// - 三层级链路：富文本 ClipboardItem（1 级）→ 纯文本 writeText（2 级）
//   → 老 execCommand 命令 + 隐藏输入框（3 级兜底）
// - 「无降级」与「分级降级」两模式对照：环境缺能力时一层就炸 vs 逐层编排
// - 可切换「模拟老旧环境（无 clipboard 接口）」实证第 3 级兜底价值
// - 连测 10 次统计成功率；面板展示当前所在层级与安全上下文状态
// - 读取走「手动明确尝试」：读取接口被拒时给明示提示（不断言、不白屏）
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'

// ---------- 复制内容（富 HTML 与纯文本各一份） ----------

const RICH_HTML = '<strong>剪贴板案例</strong>：这是带样式的富文本段落（内嵌加粗）'
const PLAIN_TEXT = '剪贴板案例：这是带样式的富文本段落（内嵌加粗）'

// ---------- 环境 / 策略状态 ----------

/** modern 真实当前环境 / simulated 模拟老旧环境：无 clipboard 接口 */
const envMode = ref<'modern' | 'simulated'>('modern')
/** strict 无降级（失败即报错） / fallback 分级降级 */
const strategy = ref<'strict' | 'fallback'>('fallback')

/** 切换降级策略（n-radio-group 发出的是原始值，收窄后再用） */
function onStrategyChange(next: string | number | boolean | undefined): void {
  if (next === 'strict' || next === 'fallback') strategy.value = next
}

// ---------- 运行记录 ----------

/** 一条尝试记录：ok 成功 / fail 失败 / info 说明 */
type LogKind = 'ok' | 'fail' | 'info'

interface LogLine {
  kind: LogKind
  text: string
}

const logLines = ref<LogLine[]>([])
/** 手动粘贴框内容（与读取接口互不相干：用户输入通道无需授权） */
const pasteTarget = ref('')
/** 最近一次复制的层级（1 富文本 / 2 纯文本 / 3 兜底；null 失败） */
const lastLevel = ref<number | null>(null)
/** 面板文案：当前层级（真实统计，非演示文案） */
const lastLevelText = computed(() =>
  lastLevel.value === null ? '—' : `第 ${lastLevel.value} 级`,
)
/** 安全上下文：进页面时取一次（同一页面加载内不会变） */
const isSecure = ref(window.isSecureContext)
/** 连测 10 次的成功率 */
const testRun = ref<{ successes: number; total: number } | null>(null)
/** 读取结果状态：manual 手动粘贴自证 / read 尝试读取反馈 */
const readResult = ref<{ status: 'idle' | 'ok' | 'denied' | 'unsupported'; text: string }>({
  status: 'idle',
  text: '尚未尝试；手动粘贴框（Ctrl+V）永远可用，不需要授权',
})

function pushLog(kind: LogKind, text: string): void {
  logLines.value.push({ kind, text })
  if (logLines.value.length > 12) logLines.value.shift() // 只留最近 12 条，避免面板外溢
}

// ---------- 三层级能力 ----------

/** 环境里「新式接口」是否可用：真实环境看接口存在性；模拟环境直接算不可用 */
function hasClipboardApi(): boolean {
  return envMode.value === 'modern' && typeof navigator.clipboard !== 'undefined'
}

/** 第 1 级：ClipboardItem 富文本写入 */
async function writeRichText(): Promise<void> {
  const htmlBlob = new Blob([RICH_HTML], { type: 'text/html' })
  const plainBlob = new Blob([PLAIN_TEXT], { type: 'text/plain' })
  // 同时声明 html 与 plain 两份：整台客户端都按支持程度落到合适那份
  await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob })])
}

/** 第 2 级：writeText 纯文本写入 */
async function writePlainText(): Promise<void> {
  await navigator.clipboard.writeText(PLAIN_TEXT)
}

/** 第 3 级：老式命令兜底：隐藏多行输入框选中后借助命令复制 */
function writeLegacyCommand(): boolean {
  const area = document.createElement('textarea')
  area.value = PLAIN_TEXT
  area.setAttribute('readonly', '')
  // 隐藏但不能不渲染：部分浏览器要求目标元素真实存在
  area.style.position = 'fixed'
  area.style.opacity = '0'
  area.style.pointerEvents = 'none'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  }
  catch {
    // 个别环境对老命令直接抛异常，按失败计
  }
  document.body.removeChild(area)
  return ok
}

// ---------- 单次复制：按策略走链路 ----------

async function copyOnce(): Promise<void> {
  lastLevel.value = null

  if (strategy.value === 'strict') {
    // 较真策略：只信第 1 级，失败把错误原样抛给用户（这正是要对照的坏行号）
    if (!hasClipboardApi()) {
      pushLog('fail', '无降级：环境没有 clipboard 接口 → 直接失败（用户只能手动选文段）')
      return
    }
    try {
      await writeRichText()
      lastLevel.value = 1
      pushLog('ok', '无降级：第 1 级富文本复制成功')
    }
    catch (error) {
      pushLog('fail', `无降级：第 1 级失败 → 报错收场（${describeError(error)}）`)
    }
    return
  }

  // 分级降级：1 → 2 → 3 逐层试探，哪层通用走哪层
  if (hasClipboardApi()) {
    try {
      await writeRichText()
      lastLevel.value = 1
      pushLog('ok', '第 1 级 · ClipboardItem 富文本：成功')
      return
    }
    catch (error) {
      pushLog('fail', `第 1 级失败：${describeError(error)}`)
    }
    try {
      await writePlainText()
      lastLevel.value = 2
      pushLog('ok', '第 2 级 · writeText 纯文本：成功')
      return
    }
    catch (error) {
      pushLog('fail', `第 2 级失败：${describeError(error)}`)
    }
  }
  else {
    pushLog('fail', '环境检查：没有 clipboard 接口（模拟老旧环境/非安全上下文）')
  }

  if (writeLegacyCommand()) {
    lastLevel.value = 3
    pushLog('ok', '第 3 级 · 老命令 + 隐藏输入框：复制成功（兜底生效）')
    return
  }
  pushLog('fail', '第 3 级也失败：提示用户手动选文段复制（给明确文案，不抛白屏）')
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.name || error.message
  return typeof error === 'object' ? '未知错误对象' : String(error)
}

/** 连测 10 次：统计成功率（重测即可复现） */
async function runSuccessRateTest(): Promise<void> {
  let successes = 0
  for (let i = 0; i < 10; i++) {
    // 每次独立的复制尝试：成功与否以「层级有落点」为准（失败时层级为空）
    await copyOnce()
    if (lastLevel.value !== null) successes++
  }
  testRun.value = { successes, total: 10 }
  pushLog('info', `连测 10 次完成：成功 ${successes}/10（策略：${strategy.value === 'strict' ? '无降级' : '分级降级'}，环境：${envMode.value === 'simulated' ? '模拟老旧' : '真实'}）`)
}

// ---------- 读取（明确尝试：失败给明示，不自动触发） ----------

async function tryReadClipboard(): Promise<void> {
  if (!hasClipboardApi()) {
    readResult.value = { status: 'unsupported', text: '当前环境无剪贴板读取接口：请用下方手动粘贴框（Ctrl+V），它不需要任何授权' }
    return
  }
  try {
    // 手动按钮触发读取：接口读法可能成功也可能被拒（rows 不白屏）
    const items = await navigator.clipboard.read()
    const first = items[0]
    if (!first) throw new Error('剪贴板为空')
    const blob = await first.getType('text/plain')
    readResult.value = { status: 'ok', text: `读取成功（第 1 条，${blob.size} 字节）：${(await blob.text()).slice(0, 120)}` }
  }
  catch (error) {
    const detail = describeError(error)
    readResult.value = { status: 'denied', text: `读取被拒（${detail}）：读取授权常被浏览器限制；手动粘贴 Ctrl+V 永远可用` }
  }
}

// ---------- 重置 ----------

function resetAll(): void {
  logLines.value = []
  lastLevel.value = null
  testRun.value = null
  readResult.value = { status: 'idle', text: '尚未尝试；手动粘贴框（Ctrl+V）永远可用，不需要授权' }
}
</script>

<template>
  <div class="cl-demo">
    <div class="bar">
      <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
      <n-radio-group
        class="modes"
        :value="strategy"
        aria-label="降级策略"
        @update:value="onStrategyChange"
      >
        <n-radio-button value="strict">
          无降级（失败即报错）
        </n-radio-button>
        <n-radio-button value="fallback">
          分级降级（照样复制成功）
        </n-radio-button>
      </n-radio-group>
      <n-button
        :type="envMode === 'simulated' ? 'primary' : 'default'"
        :ghost="envMode === 'simulated'"
        :aria-pressed="envMode === 'simulated'"
        @click="envMode = envMode === 'simulated' ? 'modern' : 'simulated'"
      >
        {{ envMode === 'simulated' ? '模拟老旧环境：开（无 clipboard 接口）' : '模拟老旧环境：关（真实当前环境）' }}
      </n-button>
    </div>

    <div class="actions">
      <n-button
        type="primary"
        @click="copyOnce"
      >
        复制一次
      </n-button>
      <n-button @click="runSuccessRateTest">
        连测 10 次（统计成功率）
      </n-button>
      <n-button @click="resetAll">
        重置
      </n-button>
    </div>

    <div class="stats">
      <span>当前层级 <b>{{ lastLevelText }}</b></span>
      <span>复制成功率 <b>{{ testRun ? `${testRun.successes}/${testRun.total}` : '—' }}</b>（连测 10 次）</span>
      <span>安全上下文 <b>{{ String(isSecure) }}</b></span>
    </div>

    <div class="levels">
      <span class="level-title">三层级，各自适用范围：</span>
      <ol class="level-list">
        <li>1 · ClipboardItem：富文本（带样式段落）；需安全上下文与授权配合</li>
        <li>2 · writeText：纯文本；同样要求安全上下文与授权配合</li>
        <li>3 · execCommand 命令 + 隐藏输入框：无授权要求；老式兜底（已判废弃但广泛兼容）</li>
      </ol>
    </div>

    <!-- 复制/测量日志 -->
    <div class="log">
      <p class="log-title">
        复制与测量日志（可选中复制）
      </p>
      <p
        v-if="logLines.length === 0"
        class="log-empty"
      >
        点「复制一次」或「连测 10 次」，这里按真实尝试记录每层成败。
      </p>
      <ul
        v-else
        class="log-list"
      >
        <li
          v-for="(line, i) in logLines"
          :key="i"
          class="log-item"
          :class="line.kind === 'ok' ? 'ok' : line.kind === 'fail' ? 'fail' : 'info'"
        >
          <span class="log-dot">{{ line.kind === 'ok' ? '成' : line.kind === 'fail' ? '败' : '记' }}</span>
          {{ line.text }}
        </li>
      </ul>
    </div>

    <!-- 读取区：手动明确尝试 + 手动粘贴框 -->
    <div class="read">
      <n-button @click="tryReadClipboard">
        试试读取接口（read，可能被拒）
      </n-button>
      <textarea
        v-model="pasteTarget"
        class="paste"
        rows="3"
        placeholder="把剪贴板内容手动 Ctrl+V 到这里验证（不需要任何权限）"
        aria-label="手动粘贴验证框"
      />
      <p
        class="read-state"
        :class="readResult.status === 'ok' ? 'good' : readResult.status === 'idle' ? '' : 'warn'"
      >
        {{ readResult.text }}
      </p>
      <p
        v-if="pasteTarget"
        class="hand-note"
      >
        手动粘贴内容已就位（{{ pasteTarget.length }} 字符），走的是用户输入通道，与读取接口无关。
      </p>
    </div>
  </div>
</template>

<style scoped>
.cl-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-width: 0;
}

.bar,
.actions {
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

.levels {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  padding: 0.6rem 0.8rem;
}

.level-title {
  font-size: var(--demo-text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.level-list {
  margin: 0.3rem 0 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: var(--demo-text-sm);
  color: var(--text);
}

.log {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  padding: 0.6rem 0.8rem;
  user-select: text;
}

.log-title {
  margin: 0 0 0.35rem;
  font-size: var(--demo-text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.log-empty {
  margin: 0;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.log-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--demo-text-sm);
  color: var(--text);
  word-break: break-all;
}

.log-dot {
  flex-shrink: 0;
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-tag);
  font-size: var(--demo-text-xs);
}

.log-item.ok .log-dot {
  background-color: var(--success-soft);
  color: var(--success);
}

.log-item.fail .log-dot {
  background-color: var(--danger-soft);
  color: var(--danger);
}

.log-item.info .log-dot {
  background-color: var(--primary-soft);
  color: var(--primary);
}

.read {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  padding: 0.6rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.paste {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--demo-text-sm);
  resize: vertical;
  min-width: 0;
}

.read-state {
  margin: 0;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
  word-break: break-all;
}

.read-state.good {
  color: var(--success);
}

.read-state.warn {
  color: var(--warning);
}

.hand-note {
  margin: 0;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}
</style>
