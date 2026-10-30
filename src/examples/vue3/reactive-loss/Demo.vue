// ============================================================
// 案例：响应式丢失的 5 个现场（reactive-loss）
// 1. 解构 reactive → 得到的是普通快照
// 2. 整体重新赋值 → 新对象没被 Proxy 包裹
// 3. 展开运算符浅拷贝 → 拷走的是值不是连接
// 4. 解构 props → setup 时取快照，后续更新不跟
// 5. 反例验证：数组下标 / 新增属性在 Vue 3（Proxy）已经可用
// 每个现场都可切「错误 / 正确」写法，并排看 UI 值与真实值
// ============================================================
<script setup lang="ts">
 
import { computed, defineComponent, h, reactive, ref, toRef } from 'vue'

type Mode = 'wrong' | 'right'

// ============================================================
// 现场 1：解构 reactive
// ============================================================

const s1 = reactive({ count: 0 })
const mode1 = ref<Mode>('wrong')

/** 现场 1 的模式组回调（只切展示来源，不动数据） */
function setMode1(next: string | number | boolean | undefined): void {
  const m = toMode(next)
  if (m) mode1.value = m
}

//! 错误：解构拿到的是“当时的数字”，之后与响应式系统彻底无关
const snapshot1 = s1.count

//! 正确：toRef 建立一条只读连接，读写都走原对象
const linked1 = toRef(s1, 'count')

/** UI 实际显示的值：错误模式读快照，正确模式读连接 */
const shown1 = computed(() => (mode1.value === 'wrong' ? snapshot1 : linked1.value))

function bump1(): void {
  s1.count++
}

function reset1(): void {
  s1.count = 0
  mode1.value = 'wrong'
}

// ============================================================
// 现场 2：整体重新赋值
// ============================================================

/** 真实数据（模拟业务源） */
const truth2 = ref(0)

/**
 * 被展示的响应式对象。
 * //! 用 let：错误写法会把整个变量替换成普通对象
 */
let s2: { count: number } = reactive({ count: 0 })

const mode2 = ref<Mode>('wrong')
/** 手动刷新信号：重置 / 切模式时强制 computed 重算 */
const rev2 = ref(0)

/**
 * //! computed 只会追踪「第一次读到的那个 Proxy」。
 * 整个变量被替换后依赖没变 → 缓存永不失效 → 界面冻结。
 */
const shown2 = computed(() => {
  void mode2.value
  void rev2.value
  return s2.count
})

function bump2(): void {
  truth2.value++
  if (mode2.value === 'wrong') {
    //! 整体替换：新对象是裸对象，旧 Proxy 的依赖不会因它变化
    s2 = { count: truth2.value }
  } else {
    //! 原地改：同一个 Proxy 的属性变更 → 依赖失效、正常刷新
    Object.assign(s2, { count: truth2.value })
  }
}

/** 把 n-radio-group 发出的原始值收窄成 Mode（四个现场共用） */
function toMode(next: string | number | boolean | undefined): Mode | null {
  return next === 'wrong' || next === 'right' ? next : null
}

/** 切回正确模式时恢复成响应式对象（等价于“改回 let 声明 + 初始化”） */
function switchMode2(next: string | number | boolean | undefined): void {
  const m = toMode(next)
  if (!m) return
  mode2.value = m
  if (m === 'right') s2 = reactive({ count: truth2.value })
}

function reset2(): void {
  truth2.value = 0
  s2 = reactive({ count: 0 })
  mode2.value = 'wrong'
  rev2.value++
}

// ============================================================
// 现场 3：展开运算符浅拷贝
// ============================================================

const s3 = reactive({ count: 0 })

/** //! 错误：{ ...s3 } 只复制了当前的值，得到普通对象 */
let legacy3: { count: number } = { ...s3 }

const mode3 = ref<Mode>('wrong')

/** 现场 3 的模式组回调 */
function setMode3(next: string | number | boolean | undefined): void {
  const m = toMode(next)
  if (m) mode3.value = m
}

function bump3(): void {
  s3.count++
}

function reset3(): void {
  s3.count = 0
  legacy3 = { ...s3 }
  mode3.value = 'wrong'
}

// ============================================================
// 现场 4：解构 props（内联子组件）
// ============================================================

const PropsChild = defineComponent({
  name: 'PropsChild',
  props: {
    msg: { type: String, default: '' },
    mode: { type: String, default: 'wrong' },
  },
  setup(props) {
    //! 错误：setup 只执行一次，这里拿到的是首帧快照
    const snapshot = props.msg
    //! 正确：toRef 保持对 props 的实时读取
    const linked = toRef(props, 'msg')
    return () =>
      h('span', { class: 'loss-child-val' }, props.mode === 'wrong' ? snapshot : linked.value)
  },
})

const parentMsg = ref('第 1 条消息')
const msgSeq = ref(1)
const mode4 = ref<Mode>('wrong')

/** 现场 4 的模式组回调 */
function setMode4(next: string | number | boolean | undefined): void {
  const m = toMode(next)
  if (m) mode4.value = m
}

function pushMsg4(): void {
  msgSeq.value++
  parentMsg.value = `第 ${msgSeq.value} 条消息`
}

function reset4(): void {
  msgSeq.value = 1
  parentMsg.value = '第 1 条消息'
  mode4.value = 'wrong'
}

// ============================================================
// 现场 5：Vue 3 已修复的老坑（反例验证）
// ============================================================

const arr5 = reactive([1, 2, 3])
const obj5 = reactive<{ a: number; late?: number }>({ a: 1 })

function changeIndex5(): void {
  //! Vue 3 用 Proxy 拦截下标赋值——直接改就生效（Vue 2 需要 Vue.set）
  arr5[0] = Math.floor(Math.random() * 900) + 100
}

function addKey5(): void {
  //! 新增属性同样被 Proxy 拦截——直接加就生效（Vue 2 需要 Vue.set）
  obj5.late = Math.floor(Math.random() * 900) + 100
}

function reset5(): void {
  arr5.splice(0, arr5.length, 1, 2, 3)
  delete obj5.late
}
</script>

<template>
  <div class="loss-demo">
    <!-- 1. 解构 reactive -->
    <section
      class="loss-card"
      aria-label="解构 reactive 实验"
    >
      <header class="loss-head">
        <h3><span class="num">1</span> 解构 reactive</h3>
        <!-- 互斥模式组：Naive 单选按钮组自带选中态与键盘操作 -->
        <n-radio-group
          class="seg"
          size="small"
          :value="mode1"
          aria-label="解构 reactive 写法"
          @update:value="setMode1"
        >
          <n-radio-button value="wrong">
            丢失写法
          </n-radio-button>
          <n-radio-button value="right">
            toRef 修法
          </n-radio-button>
        </n-radio-group>
      </header>
      <pre class="snippet">{{ mode1 === 'wrong'
        ? 'const { count } = state   // 快照'
        : 'const count = toRef(state, \'count\')' }}</pre>
      <div class="loss-row">
        <n-button
          type="primary"
          @click="bump1"
        >
          源数据 +1
        </n-button>
        <span class="loss-metric">
          界面 <b :class="{ stale: mode1 === 'wrong' }">{{ shown1 }}</b>
          · 真实 <b>{{ s1.count }}</b>
        </span>
      </div>
      <p
        class="loss-status"
        :class="mode1 === 'wrong' ? 'bad' : 'good'"
      >
        {{ mode1 === 'wrong' ? '❌ 界面数字停在初始值' : '✅ 与源数据同步' }}
      </p>
      <n-button
        class="btn-reset"
        @click="reset1"
      >
        重置
      </n-button>
    </section>

    <!-- 2. 整体重新赋值 -->
    <section
      class="loss-card"
      aria-label="整体重新赋值实验"
    >
      <header class="loss-head">
        <h3><span class="num">2</span> 整体重新赋值</h3>
        <n-radio-group
          class="seg"
          size="small"
          :value="mode2"
          aria-label="整体重新赋值写法"
          @update:value="switchMode2"
        >
          <n-radio-button value="wrong">
            丢失写法
          </n-radio-button>
          <n-radio-button value="right">
            Object.assign
          </n-radio-button>
        </n-radio-group>
      </header>
      <pre class="snippet">{{ mode2 === 'wrong'
        ? 'state = { count: 1 }    // 换成了裸对象'
        : 'Object.assign(state, { count: 1 })' }}</pre>
      <div class="loss-row">
        <n-button
          type="primary"
          @click="bump2"
        >
          真实数据 +1
        </n-button>
        <span class="loss-metric">
          界面 <b :class="{ stale: mode2 === 'wrong' }">{{ shown2 }}</b>
          · 真实 <b>{{ truth2 }}</b>
        </span>
      </div>
      <p
        class="loss-status"
        :class="mode2 === 'wrong' ? 'bad' : 'good'"
      >
        {{ mode2 === 'wrong' ? '❌ 渲染用的依赖还指向旧 Proxy' : '✅ 同一对象原地更新' }}
      </p>
      <n-button
        class="btn-reset"
        @click="reset2"
      >
        重置
      </n-button>
    </section>

    <!-- 3. 展开浅拷贝 -->
    <section
      class="loss-card"
      aria-label="浅拷贝实验"
    >
      <header class="loss-head">
        <h3><span class="num">3</span> 展开浅拷贝</h3>
        <n-radio-group
          class="seg"
          size="small"
          :value="mode3"
          aria-label="浅拷贝写法"
          @update:value="setMode3"
        >
          <n-radio-button value="wrong">
            丢失写法
          </n-radio-button>
          <n-radio-button value="right">
            直接读源对象
          </n-radio-button>
        </n-radio-group>
      </header>
      <pre class="snippet">{{ mode3 === 'wrong'
        ? 'const copy = { ...state } // 普通对象'
        : 'state.count                // 读 Proxy 属性' }}</pre>
      <div class="loss-row">
        <n-button
          type="primary"
          @click="bump3"
        >
          源数据 +1
        </n-button>
        <span class="loss-metric">
          界面 <b :class="{ stale: mode3 === 'wrong' }">{{
            mode3 === 'wrong' ? legacy3.count : s3.count
          }}</b>
          · 真实 <b>{{ s3.count }}</b>
        </span>
      </div>
      <p
        class="loss-status"
        :class="mode3 === 'wrong' ? 'bad' : 'good'"
      >
        {{ mode3 === 'wrong' ? '❌ 拷贝是值快照，与源无连接' : '✅ 直接读源属性' }}
      </p>
      <n-button
        class="btn-reset"
        @click="reset3"
      >
        重置
      </n-button>
    </section>

    <!-- 4. 解构 props -->
    <section
      class="loss-card"
      aria-label="解构 props 实验"
    >
      <header class="loss-head">
        <h3><span class="num">4</span> 解构 props</h3>
        <n-radio-group
          class="seg"
          size="small"
          :value="mode4"
          aria-label="解构 props 写法"
          @update:value="setMode4"
        >
          <n-radio-button value="wrong">
            丢失写法
          </n-radio-button>
          <n-radio-button value="right">
            toRef(props)
          </n-radio-button>
        </n-radio-group>
      </header>
      <pre class="snippet">{{ mode4 === 'wrong'
        ? 'const { msg } = props   // setup 快照'
        : 'const msg = toRef(props, \'msg\')' }}</pre>
      <div class="loss-row">
        <n-button
          type="primary"
          @click="pushMsg4"
        >
          父组件发新消息
        </n-button>
        <span class="loss-metric">
          子组件显示 <b :class="{ stale: mode4 === 'wrong' }"><PropsChild
            :msg="parentMsg"
            :mode="mode4"
          /></b>
          · 父级真实 <b>{{ parentMsg }}</b>
        </span>
      </div>
      <p
        class="loss-status"
        :class="mode4 === 'wrong' ? 'bad' : 'good'"
      >
        {{ mode4 === 'wrong' ? '❌ 子组件永远停在第一条消息' : '✅ 跟随 props 更新' }}
      </p>
      <n-button
        class="btn-reset"
        @click="reset4"
      >
        重置
      </n-button>
    </section>

    <!-- 5. Vue 3 已修复的老坑 -->
    <section
      class="loss-card"
      aria-label="Vue 2 老坑验证"
    >
      <header class="loss-head">
        <h3><span class="num">5</span> 老坑已修复（反例）</h3>
        <span class="badge-ok">Vue 3 Proxy</span>
      </header>
      <pre class="snippet">arr[0] = x      // Vue 2 要 Vue.set
obj.newKey = x  // Vue 2 要 Vue.set</pre>
      <div class="loss-row">
        <n-button
          type="primary"
          @click="changeIndex5"
        >
          改 arr[0]
        </n-button>
        <n-button
          type="primary"
          @click="addKey5"
        >
          新增 obj.late
        </n-button>
      </div>
      <p class="loss-metric">
        arr[0] = <b>{{ arr5[0] }}</b>
        · obj.late = <b>{{ obj5.late ?? '—' }}</b>
      </p>
      <p class="loss-status good">
        ✅ 下标赋值 / 新增属性都被 Proxy 拦截，直接生效
      </p>
      <n-button
        class="btn-reset"
        @click="reset5"
      >
        重置
      </n-button>
    </section>

    <!-- 小结 -->
    <section
      class="loss-card summary"
      aria-label="修法小结"
    >
      <h3>修法速查</h3>
      <ul>
        <li><code>toRef(obj, 'key')</code> / <code>toRefs(obj)</code>：解构 <code>reactive</code> 时保连接</li>
        <li>不要整体替换 <code>reactive</code> 变量；用 <code>Object.assign</code> 原地改</li>
        <li>不要 <code>{ ...reactiveObj }</code> 存副本；确实要快照就明确它不响应</li>
        <li><code>props</code> 解构先 <code>toRef</code>；Vue 3.5+ 可用 <code>defineProps</code> 解构语法糖</li>
        <li>跨层级共享用 <code>provide/inject</code>，别用普通对象“传着传着”</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.loss-demo {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

/* ---------- 卡片 ---------- */

.loss-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.loss-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
  }
}

.num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 50%;
  background-color: var(--primary);
  color: #fff;
  font-size: 0.8125rem;
  margin-right: 0.25rem;
}

/* ---------- 模式切换 ---------- */

/* 模式组只留排列方式，其余观感交给 Naive 单选按钮（卡片窄，用 size="small"） */
.seg {
  display: inline-flex;
}

/* ---------- 代码片段 ---------- */

.snippet {
  margin: 0;
  padding: 0.4rem 0.5rem;
  background-color: var(--code-bg);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 2.6rem;
}

/* ---------- 操作行 ---------- */

.loss-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* 观感交给 Naive，只留「靠左不拉伸」的布局声明 */
.btn-reset {
  align-self: flex-start;
}

/* ---------- 指标 ---------- */

.loss-metric {
  font-size: 0.8125rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.loss-metric b.stale {
  color: var(--danger);
}

.loss-status {
  margin: 0;
  font-size: 0.8125rem;

  &.bad {
    color: var(--danger);
  }

  &.good {
    color: var(--success);
  }
}

.badge-ok {
  font-size: 0.8125rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background-color: var(--success-soft);
  color: var(--success);
}

/* ---------- 子组件显示值 ---------- */

.loss-card :deep(.loss-child-val) {
  color: inherit;
}

/* ---------- 小结 ---------- */

.summary {
  grid-column: 1 / -1;

  h3 {
    margin: 0 0 0.2rem;
    font-size: 0.9375rem;
    color: var(--text);
  }

  ul {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.8125rem;
    line-height: 1.9;
    color: var(--text-secondary);
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.25rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}

@media (max-width: 860px) {
  .loss-demo {
    grid-template-columns: 1fr;
  }
}
</style>
