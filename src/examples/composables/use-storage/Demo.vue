// ============================================================
// 案例：useStorage —— 响应式持久化（use-storage）
// - 左边（手写）：getItem + JSON.parse 读一次，每个字段各写一处 setItem
// - 右边（推荐）：useStorage(key, defaults)，改 ref 自动落盘，读时按默认值校验并自愈
// - 对比点：坏 JSON、类型不对、多余字段三种脏数据下的处理结果
// - 存储键：moyu-lab:storage-demo:manual / :auto（清空按钮可复原）
// ============================================================
<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

// ============================================================
// 数据形状
// ============================================================

/** 三个字段都是原始类型：校验时按 typeof 比对即可 */
type Prefs = {
  name: string
  size: 'small' | 'medium' | 'large'
  dark: boolean
}

/** 默认值：既是初始状态，也是校验时的「字段白名单 + 类型模板」 */
const DEFAULTS: Prefs = { name: '访客', size: 'medium', dark: false }

/** 两边各用一个 key，互不污染 */
const MANUAL_KEY = 'moyu-lab:storage-demo:manual'
const AUTO_KEY = 'moyu-lab:storage-demo:auto'

/** 脏数据一：根本不是 JSON（用户手改、旧版本写坏） */
const BAD_JSON = '{oops'

/** 脏数据二：JSON 合法，但字段类型和字段名都不对（还混了个多余字段） */
const BAD_TYPES = '{"name":"小明","size":"huge","dark":"yes","theme":"blue"}'

/** 字号 key → 中文 */
const SIZE_LABEL: Record<string, string> = { small: '小', medium: '中', large: '大' }

// ============================================================
// 封装版：useStorage
// ============================================================

/** 允许持久化的字段值类型（对象 / 数组不在此列，想存就自己序列化） */
type Primitive = string | number | boolean

/**
 * 字段级校验函数：返回 true 表示这个值可以用
 * 默认按 typeof 比对，联合类型（如 'small' | 'large'）要自己补一个白名单
 */
type FieldGuards<T> = { [K in keyof T]?: (value: unknown) => boolean }

/**
 * 响应式持久化
 * @param key      存储键
 * @param defaults 默认值，同时充当字段白名单与类型模板
 * @param guards   可选：比 typeof 更细的字段校验（联合类型、取值范围）
 */
function useStorage<T extends Record<string, Primitive>>(
  key: string,
  defaults: T,
  guards?: FieldGuards<T>,
) {
  /** 响应式状态：读写它就行，写入自动落盘 */
  const state = reactive({ ...defaults }) as T
  /** 存储里当前的原文（面板展示用） */
  const raw = ref('')
  /** 最近一次读取的结论 */
  const message = ref('')
  /** 累计写入次数 */
  const writes = ref(0)
  /** 这次读取是否修复过存储 */
  const repaired = ref(false)

  /**
   * 逐字段校验
   * 只认 defaults 里有的字段，类型不一致的退回默认值；
   * 存储里多出来的字段（旧版本残留）直接丢掉
   */
  function sanitize(input: unknown): T {
    const next = { ...defaults }
    if (!input || typeof input !== 'object') return next
    const source = input as Record<string, unknown>
    const target = next as Record<string, Primitive>
    for (const field of Object.keys(defaults)) {
      const value = source[field]
      //! typeof 只能挡住「数字塞进字符串字段」这种粗错：
      //! 'huge' 的 typeof 同样是 string，照样会混进来，所以联合类型要传 guards
      const guard = guards?.[field as keyof T]
      const valid = guard ? guard(value) : typeof value === typeof defaults[field]
      if (valid) {
        target[field] = value as Primitive
      }
    }
    return next
  }

  /** 写一次：把当前状态序列化进存储 */
  function write(): void {
    localStorage.setItem(key, JSON.stringify(state))
    writes.value++
    raw.value = JSON.stringify(state)
  }

  /** 读一次：坏 JSON 与非法字段都在这里被兜住，并顺手把存储修好 */
  function read(): void {
    raw.value = localStorage.getItem(key) ?? ''
    repaired.value = false

    if (!raw.value) {
      message.value = '存储为空，使用默认值'
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw.value)
    } catch {
      //! 坏 JSON 不能只「显示个错误」：不把存储改对，用户下次进来还要再失败一次
      Object.assign(state, defaults)
      write()
      repaired.value = true
      message.value = '不是合法 JSON：已回退默认值，并把存储改回正确内容'
      return
    }

    const clean = sanitize(parsed)
    // 序列化后不一致，说明确实有字段被丢掉或改回默认
    const changed = JSON.stringify(clean) !== JSON.stringify(parsed)
    Object.assign(state, clean)

    if (changed) {
      write()
      repaired.value = true
      message.value = '有非法字段或多余字段：已按默认值校验，并把存储改回正确内容'
    } else {
      message.value = '读取成功，字段全部通过校验'
    }
  }

  read()
  //! watch 放在 read 之后：避免「初始化读出来的值」又被当成一次用户改动写回去
  watch(state, write)

  return { state, raw, message, writes, repaired, read, write }
}

// ============================================================
// 手写版：读一次 + 每处手动 setItem
// ============================================================

const manual = reactive<Prefs>({ ...DEFAULTS })
const manualRaw = ref('')
const manualMessage = ref('')
const manualWrites = ref(0)

/** 手写版每次改字段都要自己调一次（三个字段 = 三处调用点） */
function saveManual(): void {
  localStorage.setItem(MANUAL_KEY, JSON.stringify(manual))
  manualWrites.value++
  manualRaw.value = JSON.stringify(manual)
}

/** 手写版读取：能解析就 Object.assign，不校验字段名与类型 */
function readManual(): void {
  manualRaw.value = localStorage.getItem(MANUAL_KEY) ?? ''
  manualMessage.value = ''

  if (!manualRaw.value) {
    manualMessage.value = '存储为空，使用默认值'
    return
  }

  try {
    //! 这是最典型的手写版：JSON.parse + Object.assign 就完事，
    //! 存储里是什么类型、有没有多余字段，一律照单全收
    Object.assign(manual, JSON.parse(manualRaw.value) as Partial<Prefs>)
    manualMessage.value = '已按存储原样填入（没有校验）'
  } catch {
    //! 只接住错误：字段停在上一次的值，存储里的坏数据也原样留着，
    //! 用户下次进来还会再失败一次
    manualMessage.value = '读取失败：存储不是合法 JSON（字段保持原值）'
  }
}

// 手写版首次挂载也读一次
readManual()

// ============================================================
// 封装版实例
// ============================================================

const auto = useStorage(AUTO_KEY, DEFAULTS, {
  // 字号是联合类型，typeof 挡不住 'huge'，得显式列白名单
  size: (value) => value === 'small' || value === 'medium' || value === 'large',
})

/** 封装版切字号：Naive 抛的是原始值，收窄回联合类型再写 */
function setAutoSize(value: string | number | boolean | undefined): void {
  if (value === 'small' || value === 'medium' || value === 'large') {
    auto.state.size = value
  }
}

// ============================================================
// 造脏数据 / 重新读取 / 清空
// ============================================================

/** 两边写同一份脏数据，保证对比条件一致 */
function injectDirty(payload: string): void {
  localStorage.setItem(MANUAL_KEY, payload)
  localStorage.setItem(AUTO_KEY, payload)
  manualRaw.value = payload
  auto.raw.value = payload
  manualMessage.value = '存储被改写，点「重新读取」看两边怎么处理'
  auto.message.value = '存储被改写，点「重新读取」看两边怎么处理'
}

/** 两边的读取逻辑各走一遍 */
function reloadBoth(): void {
  readManual()
  auto.read()
}

/** 清空存储并把两边改回默认值 */
function clearAll(): void {
  localStorage.removeItem(MANUAL_KEY)
  localStorage.removeItem(AUTO_KEY)
  Object.assign(manual, DEFAULTS)
  // 封装版的状态一改就会落盘，所以它会把默认值立刻写回去：
  // 这是「状态是真相、存储只是镜像」的直接体现
  Object.assign(auto.state, DEFAULTS)
  manualRaw.value = ''
  manualWrites.value = 0
  manualMessage.value = '已清空存储（手写版没有写回）'
  auto.writes.value = 0
  auto.raw.value = ''
  auto.message.value = '已清空存储；封装版随即把默认值写回，存储不会保持空'
  auto.repaired.value = false
}
</script>

<template>
  <div class="us-demo">
    <p class="hint">
      同一个表单、两份实现：左边每次改字段都要自己调 <code>setItem</code>，右边改状态就自动落盘。
      三种脏数据下「怎么读」的差别，比「怎么写」更能看出封装的价值。
    </p>

    <div class="actions">
      <n-button @click="injectDirty(BAD_JSON)">
        写入坏 JSON
      </n-button>
      <n-button @click="injectDirty(BAD_TYPES)">
        写入错类型
      </n-button>
      <n-button
        type="primary"
        @click="reloadBoth"
      >
        重新读取
      </n-button>
      <n-button @click="clearAll">
        清空存储
      </n-button>
    </div>

    <div class="cols">
      <!-- 左：手写版 -->
      <section class="col">
        <header class="col-head">
          <h3 class="col-title">
            手写 getItem / setItem
          </h3>
          <span class="tag warn-tag">需要手动写 {{ 3 }} 处</span>
        </header>

        <div class="field">
          <label class="label">昵称</label>
          <n-input
            :value="manual.name"
            data-stat="manual-name"
            placeholder="输入昵称"
            @update:value="(v) => { manual.name = v; saveManual() }"
          />
        </div>

        <div class="field">
          <label class="label">字号</label>
          <n-radio-group
            :value="manual.size"
            size="small"
            @update:value="(v) => { manual.size = v as Prefs['size']; saveManual() }"
          >
            <n-radio-button value="small">
              小
            </n-radio-button>
            <n-radio-button value="medium">
              中
            </n-radio-button>
            <n-radio-button value="large">
              大
            </n-radio-button>
          </n-radio-group>
          <p
            class="pick"
            data-stat="manual-size"
          >
            当前档位：{{ SIZE_LABEL[manual.size] ?? `${manual.size}（不是合法选项）` }}
          </p>
        </div>

        <div class="field field--row">
          <label class="label">深色预览</label>
          <n-switch
            :value="manual.dark === true"
            size="small"
            @update:value="(v) => { manual.dark = v; saveManual() }"
          />
          <span class="switch-note">{{ manual.dark === true ? '已开启' : '已关闭' }}</span>
        </div>

        <div class="io">
          <p class="io-line">
            写入次数 <b data-stat="manual-writes">{{ manualWrites }}</b>
          </p>
          <p
            class="io-line io-raw"
            data-stat="manual-raw"
          >
            存储原文：{{ manualRaw || '（空）' }}
          </p>
          <p
            class="io-msg"
            :class="{ bad: manualMessage.includes('失败') }"
            data-stat="manual-msg"
          >
            {{ manualMessage }}
          </p>
        </div>
      </section>

      <!-- 右：封装版 -->
      <section class="col col--ok">
        <header class="col-head">
          <h3 class="col-title">
            useStorage(key, defaults)
          </h3>
          <span class="tag ok-tag">0 处手动写入</span>
        </header>

        <div class="field">
          <label class="label">昵称</label>
          <n-input
            v-model:value="auto.state.name"
            data-stat="auto-name"
            placeholder="输入昵称"
          />
        </div>

        <div class="field">
          <label class="label">字号</label>
          <n-radio-group
            :value="auto.state.size"
            size="small"
            @update:value="setAutoSize"
          >
            <n-radio-button value="small">
              小
            </n-radio-button>
            <n-radio-button value="medium">
              中
            </n-radio-button>
            <n-radio-button value="large">
              大
            </n-radio-button>
          </n-radio-group>
          <p
            class="pick"
            data-stat="auto-size"
          >
            当前档位：{{ SIZE_LABEL[auto.state.size] ?? `${auto.state.size}（不是合法选项）` }}
          </p>
        </div>

        <div class="field field--row">
          <label class="label">深色预览</label>
          <n-switch
            v-model:value="auto.state.dark"
            size="small"
          />
          <span class="switch-note">{{ auto.state.dark ? '已开启' : '已关闭' }}</span>
        </div>

        <div class="io">
          <p class="io-line">
            写入次数 <b data-stat="auto-writes">{{ auto.writes.value }}</b>
            <span
              v-if="auto.repaired.value"
              class="fixed"
            >已修复存储</span>
          </p>
          <p
            class="io-line io-raw"
            data-stat="auto-raw"
          >
            存储原文：{{ auto.raw.value || '（空）' }}
          </p>
          <p
            class="io-msg"
            :class="{ bad: auto.message.value.includes('不是合法') }"
            data-stat="auto-msg"
          >
            {{ auto.message.value }}
          </p>
        </div>
      </section>
    </div>

    <p class="footnote">
      「写入坏 JSON」只改存储内容、不动界面；点「重新读取」后才走各自的读取逻辑。
      左边只把错误接住，存储里的坏数据原样留着；右边回退默认值并把存储改回正确内容。
    </p>
  </div>
</template>

<style scoped>
.us-demo {
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

.hint code {
  padding: 0.05rem 0.25rem;
  border-radius: var(--radius-sm);
  background-color: var(--bg-subtle);
  font-family: var(--font-mono);
  font-size: var(--demo-text-xs);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.col--ok {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background-color: color-mix(in srgb, var(--primary-soft) 45%, var(--bg));
}

.col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.col-title {
  margin: 0;
  font-size: var(--demo-text-md);
  font-weight: 600;
  color: var(--text);
}

.tag {
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-tag);
  font-size: var(--demo-text-xs);
  white-space: nowrap;
}

.warn-tag {
  background-color: var(--warning-soft);
  color: var(--warning);
}

.ok-tag {
  background-color: var(--success-soft);
  color: var(--success);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field--row {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.label {
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.switch-note {
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.pick {
  margin: 0;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);
}

.io {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: var(--demo-block-pad);
  border-radius: var(--demo-radius);
  background-color: var(--bg-subtle);
}

.io-line {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

.io-raw {
  font-family: var(--font-mono);
  word-break: break-all;
}

.io-msg {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.6;
  color: var(--text-secondary);

  &.bad {
    color: var(--danger);
  }
}

.fixed {
  padding: 0.05rem 0.35rem;
  border-radius: var(--radius-tag);
  background-color: var(--success-soft);
  color: var(--success);
  font-size: var(--demo-text-xs);
}

@media (max-width: 768px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
</style>
