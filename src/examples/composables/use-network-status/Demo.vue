// ============================================================
// 案例：useNetworkStatus 网络状态
// 左边只读一次 + 监听 online/offline；右边同时订阅连接信息变化
// ============================================================
<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, onUnmounted, reactive, ref, watch } from 'vue'

// ---------- 类型 ----------

/** 一次网络快照 */
interface NetworkSnapshot {
  online: boolean
  effectiveType: string
  downlink: number
  rtt: number
  saveData: boolean
  supported: boolean
}

/** 可替换的数据源：真实环境读 navigator，演示里换成可控的模拟源 */
interface NetworkSource {
  read: () => NetworkSnapshot
  subscribe: (onChange: () => void) => () => void
}

/** Network Information API 的最小类型（TS 的 DOM lib 还没收） */
interface NetworkConnection extends EventTarget {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkConnection
}

// ============================================================
// 封装版：默认读浏览器，也可以注入数据源（演示 / 测试）
// ============================================================

/** 真实浏览器数据源：navigator + online/offline + connection.change */
function browserNetworkSource(): NetworkSource {
  const nav = navigator as NavigatorWithConnection
  const connection = nav.connection

  return {
    read: () => ({
      online: nav.onLine,
      effectiveType: connection?.effectiveType ?? 'unknown',
      downlink: connection?.downlink ?? 0,
      rtt: connection?.rtt ?? 0,
      saveData: connection?.saveData ?? false,
      supported: Boolean(connection),
    }),
    subscribe(onChange) {
      //! online/offline 只说明「有没有网」，连接类型变化要靠 connection.change
      window.addEventListener('online', onChange)
      window.addEventListener('offline', onChange)
      connection?.addEventListener('change', onChange)

      return () => {
        window.removeEventListener('online', onChange)
        window.removeEventListener('offline', onChange)
        connection?.removeEventListener('change', onChange)
      }
    },
  }
}

/**
 * 网络状态：初始值同步 + 订阅所有变化 + 作用域销毁时解绑
 * @param source 数据源，默认浏览器；测试 / 演示可注入
 */
function useNetworkStatus(source: NetworkSource = browserNetworkSource()) {
  const state = reactive<NetworkSnapshot>(source.read())
  const changes = ref(0)

  /** 重新读一次并覆盖状态 */
  function refresh(): void {
    Object.assign(state, source.read())
    changes.value++
  }

  /** 清零计数并同步一次（不额外计一次变化） */
  function reset(): void {
    Object.assign(state, source.read())
    changes.value = 0
  }

  //! 订阅在 setup 同步注册，避免首帧之后才补上监听
  const stop = source.subscribe(refresh)

  //! 组件卸载 / effectScope.stop() 都会走到这里
  onScopeDispose(stop)

  return { state, changes, refresh, reset }
}

// ============================================================
// 演示用的模拟源：让「连接类型变化」可以手动触发
// ============================================================

const demoOnline = ref(true)
const demoType = ref<'4g' | '3g' | '2g'>('4g')
const demoSaveData = ref(false)

/** 不同制式给一组接近真实的参考值，方便观察面板变化 */
const demoDownlink = computed(() => {
  if (demoType.value === '4g') return 10
  if (demoType.value === '3g') return 1.5
  return 0.25
})
const demoRtt = computed(() => {
  if (demoType.value === '4g') return 50
  if (demoType.value === '3g') return 300
  return 700
})

/** 演示源：read 返回快照，subscribe 用 watch 汇总所有字段 */
const demoSource: NetworkSource = {
  read: () => ({
    online: demoOnline.value,
    effectiveType: demoType.value,
    downlink: demoDownlink.value,
    rtt: demoRtt.value,
    saveData: demoSaveData.value,
    supported: true,
  }),
  subscribe(onChange) {
    const stop = watch([demoOnline, demoType, demoSaveData], onChange)
    return stop
  },
}

// ============================================================
// 左边：手写版（只监听 online / offline，连接信息读一次）
// ============================================================

const manual = reactive<NetworkSnapshot>(demoSource.read())
const manualUpdates = ref(0)

function handleOnline(): void {
  manual.online = true
  manualUpdates.value++
}

function handleOffline(): void {
  manual.online = false
  manualUpdates.value++
}

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})

// 演示开关切换时派发真实的 online / offline 事件，让手写版也能收到
watch(demoOnline, (online) => {
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
})

// ============================================================
// 右边：封装版
// ============================================================

const network = useNetworkStatus(demoSource)

/** 真实环境快照：不受上面的模拟开关影响 */
const real = browserNetworkSource().read()

// ============================================================
// 操作
// ============================================================

async function resetDemo(): Promise<void> {
  demoOnline.value = true
  demoType.value = '4g'
  demoSaveData.value = false

  // 等 source 的 watch 先跑完，再清零，否则会被这次同步重新计上
  await nextTick()
  manual.online = true
  manualUpdates.value = 0
  network.reset()
}

/** 手写版连接信息是否已经过期（和封装版对比） */
const manualStale = computed(
  () =>
    manual.effectiveType !== network.state.effectiveType ||
    manual.downlink !== network.state.downlink ||
    manual.rtt !== network.state.rtt ||
    manual.saveData !== network.state.saveData,
)
</script>

<template>
  <div class="ns-demo">
    <p class="hint">
      左边只监听 <b>online / offline</b>，连接信息只读一次；右边同时订阅
      <b>connection.change</b>。下面的开关会派发真实事件，但浏览器报告的
      <b>navigator.onLine</b> 仍是当前真实状态，右侧「真实环境」面板不受影响。
    </p>

    <div class="toolbar">
      <span class="label">模拟制式</span>
      <n-radio-group
        v-model:value="demoType"
        size="small"
      >
        <n-radio-button value="4g">
          4G
        </n-radio-button>
        <n-radio-button value="3g">
          3G
        </n-radio-button>
        <n-radio-button value="2g">
          2G
        </n-radio-button>
      </n-radio-group>

      <label class="toggle">
        <n-switch
          v-model:value="demoOnline"
          size="small"
        />
        在线
      </label>

      <label class="toggle">
        <n-switch
          v-model:value="demoSaveData"
          size="small"
        />
        省流模式
      </label>

      <n-button
        size="small"
        @click="resetDemo"
      >
        重置
      </n-button>
    </div>

    <div class="cols">
      <section class="col col--manual">
        <header class="col-head">
          <h3 class="col-title">
            手写版
          </h3>
          <span
            class="badge"
            :class="{ 'badge--warn': manualStale }"
            data-stat="manual-stale"
          >
            {{ manualStale ? '连接信息已过期' : '信息一致' }}
          </span>
        </header>

        <dl class="metrics">
          <div class="metric">
            <dt>在线</dt>
            <dd data-stat="manual-online">
              {{ manual.online ? '在线' : '离线' }}
            </dd>
          </div>
          <div class="metric">
            <dt>制式</dt>
            <dd data-stat="manual-type">
              {{ manual.effectiveType }}
            </dd>
          </div>
          <div class="metric">
            <dt>下行 / 延迟</dt>
            <dd data-stat="manual-speed">
              {{ manual.downlink }} Mbps / {{ manual.rtt }} ms
            </dd>
          </div>
          <div class="metric">
            <dt>省流</dt>
            <dd data-stat="manual-save">
              {{ manual.saveData ? '开' : '关' }}
            </dd>
          </div>
          <div class="metric">
            <dt>在线状态更新</dt>
            <dd data-stat="manual-updates">
              {{ manualUpdates }}
            </dd>
          </div>
        </dl>

        <p class="note">
          连接信息没有订阅 <code>change</code>，切换制式后仍停在首次读取的值。
        </p>
      </section>

      <section class="col col--ok">
        <header class="col-head">
          <h3 class="col-title">
            useNetworkStatus
          </h3>
          <span class="badge badge--ok">已订阅 change</span>
        </header>

        <dl class="metrics">
          <div class="metric">
            <dt>在线</dt>
            <dd data-stat="auto-online">
              {{ network.state.online ? '在线' : '离线' }}
            </dd>
          </div>
          <div class="metric">
            <dt>制式</dt>
            <dd data-stat="auto-type">
              {{ network.state.effectiveType }}
            </dd>
          </div>
          <div class="metric">
            <dt>下行 / 延迟</dt>
            <dd data-stat="auto-speed">
              {{ network.state.downlink }} Mbps / {{ network.state.rtt }} ms
            </dd>
          </div>
          <div class="metric">
            <dt>省流</dt>
            <dd data-stat="auto-save">
              {{ network.state.saveData ? '开' : '关' }}
            </dd>
          </div>
          <div class="metric">
            <dt>状态同步次数</dt>
            <dd data-stat="auto-changes">
              {{ network.changes }}
            </dd>
          </div>
        </dl>

        <p class="note">
          所有字段都来自同一个快照，变化时整块更新；卸载时自动解绑三个监听。
        </p>
      </section>
    </div>

    <div class="real">
      <h3 class="real-title">
        真实环境（只读）
      </h3>
      <div class="real-grid">
        <span>navigator.onLine</span>
        <b>{{ real.online ? '在线' : '离线' }}</b>
        <span>connection 支持</span>
        <b>{{ real.supported ? '支持' : '不支持' }}</b>
        <span>effectiveType</span>
        <b>{{ real.effectiveType }}</b>
        <span>downlink / rtt</span>
        <b>{{ real.downlink }} Mbps / {{ real.rtt }} ms</b>
        <span>saveData</span>
        <b>{{ real.saveData ? '开' : '关' }}</b>
      </div>
    </div>

    <p class="footnote">
      真实项目默认使用 <code>browserNetworkSource()</code>，不传参就是读
      <code>navigator</code>；模拟源只是为了让连接类型变化在演示里可复现。
    </p>
  </div>
</template>

<style scoped>
.ns-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hint {
  margin: 0;
  font-size: var(--demo-text-sm);
  line-height: 1.7;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.label {
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--demo-text-sm);
  color: var(--text-secondary);
  cursor: pointer;
}

/* ---------- 两栏对照 ---------- */

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: var(--demo-block-pad);
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg);
}

.col--ok {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background-color: color-mix(in srgb, var(--primary-soft) 55%, var(--bg));
}

.col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.col-title {
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

.badge--ok {
  background-color: var(--success-soft);
  color: var(--success);
}

.badge--warn {
  background-color: var(--warning-soft);
  color: var(--warning);
}

/* ---------- 指标 ---------- */

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.25;
    color: var(--text);
  }
}

.col--manual .metric dd {
  color: var(--warning);
}

.col--ok .metric dd {
  color: var(--success);
}

.note {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);
}

/* ---------- 真实环境 ---------- */

.real {
  padding: var(--demo-block-pad);
  border: 1px dashed var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--surface);
}

.real-title {
  margin: 0 0 0.4rem;
  font-size: var(--demo-text-sm);
  font-weight: 600;
  color: var(--text);
}

.real-grid {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr;
  gap: 0.25rem 0.6rem;
  font-size: var(--demo-text-xs);
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text);
  }
}

.footnote {
  margin: 0;
  font-size: var(--demo-text-xs);
  line-height: 1.7;
  color: var(--text-secondary);

  code {
    font-family: var(--font-mono);
    color: var(--text);
  }
}

@media (max-width: 768px) {
  .cols {
    grid-template-columns: 1fr;
  }

  .real-grid {
    grid-template-columns: auto 1fr;
  }
}
</style>
