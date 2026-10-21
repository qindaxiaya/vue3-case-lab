// ============================================================
// 案例：has 父级选择器（has-parent）
// - 两个常用场景：卡片有缩略图才双列 / 必填项为空时容器加红边
// - 旧做法：手写监听器 + 手动改类名（教学类真的要写 30 行）
// - 新做法：has 选择器纯 CSS 判定，JS 一行不用
// - 实际状态一律读计算样式 / matches 实测，不拿写死的结论充数
// ============================================================
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

/** 实现思路：js = 监听器 + 手动类名 / css = has 选择器纯样式 */
type ImpleMode = 'js' | 'css'

const mode = ref<ImpleMode>('css')

// ---------- 场景一：缩略图卡片 ----------

/** 是否渲染缩略图（勾选框，两种模式共用它控制 DOM 内容） */
const hasThumb = ref(true)

/** 缩略图卡片节点（css 模式由 has 命中；js 模式读它改类名） */
const thumbCardRef = ref<HTMLElement | null>(null)
const thumbCheckRef = ref<HTMLInputElement | null>(null)

/** js 模式下的双列状态（由监听器手动维护） */
const jsThumbRow = ref(false)

// ---------- 场景二：必填项为空 → 容器红边 ----------

const nick = ref('')
const mail = ref('')
const memo = ref('')

const nickRef = ref<HTMLInputElement | null>(null)
const mailRef = ref<HTMLInputElement | null>(null)
/** 表单容器节点（css 模式由 has 命中；js 模式读它改类名） */
const formBoxRef = ref<HTMLElement | null>(null)

/** js 模式下的红边状态（由监听器手动维护） */
const jsFormBad = ref(false)

/** 必填为空个数（两种模式下的轻量读数：与 has 判定的 DOM 真相同源） */
const emptyCount = computed(() => (nick.value === '' ? 1 : 0) + (mail.value === '' ? 1 : 0))

// ---------- 实时核对：一切以浏览器算出来的为准 ----------

/** 卡片实际排向（读计算样式的 flex-direction） */
const thumbDir = ref<'row' | 'column' | null>(null)

/** 容器红边是否点亮：css 模式用 matches 实测 has 规则；js 模式以监听器状态为准 */
function formBadLive(): boolean {
  if (mode.value === 'js') return jsFormBad.value
  const el = formBoxRef.value
  return el ? el.matches(':has(input.req:placeholder-shown)') : false
}

/** 排向显示文案 */
const thumbDirText = computed(() =>
  thumbDir.value === 'row' ? '横排（双列）' : thumbDir.value === 'column' ? '纵排' : '读取中…',
)

/** 下一帧复查：Vue 渲染与 has 规则结算完成后再读真实状态 */
function scheduleLiveCheck(): void {
  void nextTick(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = thumbCardRef.value
        if (el) {
          thumbDir.value = getComputedStyle(el).flexDirection === 'row' ? 'row' : 'column'
        }
      }),
    )
  })
}

// ---------- js 模式：老写法的全套样板 ----------

/** 监听器集合（卸载/切换时统一摘除，防止残留） */
const liveHandlers: Array<[EventTarget, string, EventListener]> = []

function onThumbJs(): void {
  // 老写法第 1 步：读原始 DOM 状态
  jsThumbRow.value = thumbCheckRef.value?.checked ?? false
}

function onFieldJs(): void {
  // 老写法第 2 步：手工比对每个必填输入
  const nickEmpty = (nickRef.value?.value ?? '') === ''
  const mailEmpty = (mailRef.value?.value ?? '') === ''
  jsFormBad.value = nickEmpty || mailEmpty
}

/** js 教学片段的静态行数（与 code/js-fallback.ts.txt 核心段一致） */
const JS_LINES = 30

/** 当前生效的监听器个数（css 模式恒为 0，js 模式为实际挂载数） */
const listenerCount = ref(0)

/** 按模式挂载/摘除监听器（切换方案时调用） */
function syncListeners(): void {
  for (const [target, type, handler] of liveHandlers) {
    target.removeEventListener(type, handler)
  }
  liveHandlers.length = 0
  listenerCount.value = 0

  if (mode.value !== 'js') return

  const bind = (target: EventTarget | null, type: string, handler: EventListener): void => {
    if (!target) return
    target.addEventListener(type, handler)
    liveHandlers.push([target, type, handler])
    listenerCount.value++
  }

  bind(thumbCheckRef.value, 'change', onThumbJs)
  bind(nickRef.value, 'input', onFieldJs)
  bind(mailRef.value, 'input', onFieldJs)
  // 挂载后立即按当前 DOM 状态同步一遍（老写法还需要防初次漏判）
  onThumbJs()
  onFieldJs()
}

// ---------- 方案切换与重置 ----------

function setMode(next: ImpleMode): void {
  if (mode.value === next) return
  mode.value = next
  syncListeners()
  scheduleLiveCheck()
}

/** 重置：恢复默认内容，两种模式重新从初始状态演示 */
function resetAll(): void {
  hasThumb.value = true
  nick.value = ''
  mail.value = ''
  memo.value = ''
  jsThumbRow.value = false
  jsFormBad.value = false
  syncListeners()
  scheduleLiveCheck()
}

// ---------- 生命周期 ----------

onMounted(() => {
  syncListeners()
  scheduleLiveCheck()
})

onUnmounted(() => {
  for (const [target, type, handler] of liveHandlers) {
    target.removeEventListener(type, handler)
  }
  liveHandlers.length = 0
})
</script>

<template>
  <div
    class="has-demo"
    :class="mode === 'css' ? 'mode-css' : 'mode-js'"
  >
    <div class="bar">
      <div
        class="modes"
        role="group"
        aria-label="实现思路"
      >
        <button
          class="mode"
          :class="{ active: mode === 'js' }"
          :aria-pressed="mode === 'js'"
          @click="setMode('js')"
        >
          JS 监听器（旧）
        </button>
        <button
          class="mode"
          :class="{ active: mode === 'css' }"
          :aria-pressed="mode === 'css'"
          @click="setMode('css')"
        >
          has 选择器（推荐）
        </button>
      </div>
      <button
        class="btn ghost"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <div class="stats">
      <span>实现该行为的 JS 行数 <b>{{ mode === 'js' ? `约 ${JS_LINES}` : 0 }}</b></span>
      <span>生效监听器 <b>{{ listenerCount }}</b> 个</span>
      <span>必填为空 <b>{{ emptyCount }}</b> / 2</span>
      <span>容器红边 <b>{{ formBadLive() ? '点亮' : '熄灭' }}</b></span>
    </div>

    <!-- 场景一：卡片里有缩略图才双列 -->
    <section class="box">
      <header class="box-head">
        场景一 · 卡片里有缩略图才双列
        <label class="mini">
          <input
            v-model="hasThumb"
            type="checkbox"
          >
          带缩略图
        </label>
      </header>
      <article
        ref="thumbCardRef"
        class="thumb-card"
        :class="{ 'thumb--row': mode === 'js' && jsThumbRow }"
      >
        <div
          v-if="hasThumb"
          class="thumb"
          aria-hidden="true"
        >
          缩略图
        </div>
        <div class="tc-text">
          <h3>午间特供</h3>
          <p>勾选缩略图，纯 CSS 保持双列；取消勾选自动退回纵排。</p>
        </div>
      </article>
      <p class="fit-line">
        实际排向（计算样式实测）：<b>{{ thumbDirText }}</b>
      </p>
    </section>

    <!-- 场景二：必填项为空 → 容器加红边 -->
    <section class="box">
      <header class="box-head">
        场景二 · 必填项为空时容器加红边
      </header>
      <div
        ref="formBoxRef"
        class="form-box"
        :class="{ 'form-box--bad': mode === 'js' && jsFormBad }"
      >
        <label class="f-field">
          昵称
          <input
            v-model="nick"
            class="req"
            placeholder="必填"
            type="text"
          >
        </label>
        <label class="f-field">
          邮箱
          <input
            v-model="mail"
            class="req"
            placeholder="必填"
            type="text"
          >
        </label>
        <label class="f-field">
          备注
          <input
            v-model="memo"
            placeholder="选填"
            type="text"
          >
        </label>
      </div>
      <p class="fit-line">
        判定方式：{{ mode === 'css' ? 'has() 由样式引擎逐帧比对，JS 零参与' : 'input 事件监听器手动比对每个必填项，再手动切换容器类名' }}
      </p>
    </section>

    <p class="hint">
      两种模式的表现完全一致——差别在实现成本：旧写法要装监听器、比对状态、手动改类名；
      has 选择器把这些收进样式引擎，勾选或清空输入时直接生效。
    </p>
  </div>
</template>

<style scoped>
.has-demo {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.modes {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg-subtle);
}

.mode {
  padding: 0.4rem 0.65rem;
  border: none;
  border-radius: calc(var(--demo-radius) - 2px);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-sm);
  cursor: pointer;
  transition: background-color 0.2s var(--ease-out), color 0.2s var(--ease-out);

  &.active {
    background-color: var(--surface);
    color: var(--primary);
    box-shadow: var(--shadow-soft);
  }
}

.btn {
  padding: var(--demo-control-py) var(--demo-control-px);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: var(--demo-text-md);
  cursor: pointer;

  &:hover {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.1rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--code-bg);
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.box {
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: var(--demo-text-sm);
  font-weight: 600;
  color: var(--text);
}

.mini {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: var(--demo-text-sm);
  font-weight: 400;
  color: var(--text-secondary);
  cursor: pointer;

  input {
    accent-color: var(--primary);
  }
}

/* ---------- 场景一：缩略图卡片 ---------- */

.thumb-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--surface);
  padding: 0.55rem;
  min-width: 0;
}

.thumb {
  width: 100%;
  height: 64px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--primary) 16%, var(--bg-subtle));
  color: var(--primary);
  font-size: var(--demo-text-xs);
}

.tc-text {
  min-width: 0;

  h3 {
    margin: 0;
    font-size: var(--demo-text-md);
    color: var(--text);
  }

  p {
    margin: 0.1rem 0 0;
    font-size: var(--demo-text-xs);
    line-height: 1.5;
    color: var(--text-secondary);
    overflow-wrap: anywhere;
  }
}

/* has 版：命中「卡片里存在缩略图」就双列，样式引擎逐帧判定 */
.mode-css .thumb-card:has(.thumb) {
  flex-direction: row;
  align-items: center;

  .thumb {
    width: 96px;
  }
}

/* js 版：类名由监听器手动维护（等价效果，JS 三十行换来的） */
.mode-js .thumb-card.thumb--row {
  flex-direction: row;
  align-items: center;

  .thumb {
    width: 96px;
  }
}

/* ---------- 场景二：必填为空 → 红边 ---------- */

.form-box {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--surface);
  transition: border-color 0.2s var(--ease-out), background-color 0.2s var(--ease-out);
}

.f-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1 1 150px;
  min-width: 0;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);

  input {
    min-height: var(--demo-control-h);
    padding: 0.3rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background-color: var(--bg);
    color: var(--text);
    font-size: var(--demo-text-md);
    min-width: 0;
  }
}

/* has 版：容器内存在「必填且仍为空」的输入就点亮红边 */
.mode-css .form-box:has(input.req:placeholder-shown) {
  border-color: var(--danger);
  background-color: color-mix(in srgb, var(--danger) 6%, var(--surface));
}

/* js 版：类名由监听器手动维护 */
.mode-js .form-box.form-box--bad {
  border-color: var(--danger);
  background-color: color-mix(in srgb, var(--danger) 6%, var(--surface));
}

.fit-line {
  margin: 0;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
