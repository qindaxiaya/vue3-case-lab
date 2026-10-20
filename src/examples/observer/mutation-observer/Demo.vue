// ============================================================
// 案例：MutationObserver DOM 变更监听（mutation-observer）
// - 监听一个「模拟数据流」容器：子节点增删、属性变化、文本变化分类型记录
// - attributes / childList / characterData 三个开关自由组合观察目标
// - 按钮注入节点 / 改属性 / 改文本；「清空重建」演示 takeRecords 防洪泛
// - onUnmounted disconnect() 释放观察器
// ============================================================
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// ---------- 变更日志（分类型着色） ----------

/** 变更类型：add 增节点 / remove 删节点 / attr 属性 / text 文本 */
type MutationKind = 'add' | 'remove' | 'attr' | 'text'

interface MutationLog {
  kind: MutationKind
  text: string
}

const logs = ref<MutationLog[]>([])

function log(kind: MutationKind, text: string): void {
  logs.value.unshift({ kind, text })
  if (logs.value.length > 6) logs.value.pop()
}

// ---------- 观察配置开关 ----------

/** 观察子节点增删 */
const watchChildList = ref(true)
/** 观察属性变化 */
const watchAttributes = ref(true)
/** 观察文本变化 */
const watchCharacter = ref(true)

// ---------- 观察器 ----------

let observer: MutationObserver | null = null
/** 被观察容器 */
const panel = ref<HTMLElement | null>(null)
/** 节点计数（增删统计） */
const nodeCount = ref(3)

function buildObserver(): void {
  observer?.disconnect()
  observer = new MutationObserver((records) => {
    for (const r of records) {
      // 子节点增删
      r.addedNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) {
          log('add', `新增节点 <${(n as HTMLElement).tagName.toLowerCase()}>`)
          nodeCount.value++
        }
      })
      r.removedNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) {
          log('remove', `删除节点 <${(n as HTMLElement).tagName.toLowerCase()}>`)
          nodeCount.value--
        }
      })
      // 属性变化（只记录 data-active，避免 style 噪音）
      if (r.type === 'attributes' && r.attributeName === 'data-active') {
        const el = r.target as HTMLElement
        log('attr', `data-active → ${el.dataset.active ?? 'false'}`)
      }
      // 文本变化
      if (r.type === 'characterData') {
        log('text', `文本改为「${String(r.target.nodeValue).slice(0, 12)}」`)
      }
    }
  })

  if (!panel.value) return
  // 三个开关决定观察目标的哪些变更（每次重建生效）
  observer.observe(panel.value, {
    childList: watchChildList.value,
    attributes: watchAttributes.value,
    characterData: watchCharacter.value,
    subtree: true, // 深度监听所有后代（不加只看直接子节点）
  })
}

/** 重建观察器（切换开关后调用） */
function rebuild(): void {
  buildObserver()
}

// ---------- 操作按钮 ----------

/** 注入一个新节点 */
function addNode(): void {
  const el = document.createElement('div')
  el.className = 'mo-item'
  el.textContent = `动态节点 ${nodeCount.value + 1}`
  panel.value?.appendChild(el)
}

/** 删除最后一个子节点（保留第一个标题） */
function removeNode(): void {
  const children = panel.value?.querySelectorAll('.mo-item')
  if (children && children.length > 0) {
    children[children.length - 1].remove()
  }
}

/** 切换 data-active 属性 */
function toggleAttr(): void {
  if (!panel.value) return
  const cur = panel.value.dataset.active === 'true'
  panel.value.dataset.active = String(!cur)
}

/** 修改第一个子节点的文本（触发 characterData） */
let textIdx = 0
function editText(): void {
  const first = panel.value?.querySelector('.mo-item')
  if (first) {
    textIdx++
    first.textContent = `改文本 #${textIdx}`
  }
}

/** 清空重建：先 takeRecords 冲刷残留记录，再重建面板（防变更洪泛） */
function resetAll(): void {
  // takeRecords：立即取走未派发的记录并丢弃——清空前防止日志瞬间灌满
  observer?.takeRecords()
  if (!panel.value) return
  panel.value.innerHTML = ''
  panel.value.dataset.active = 'false'
  for (let i = 1; i <= 3; i++) {
    const el = document.createElement('div')
    el.className = 'mo-item'
    el.textContent = `初始节点 ${i}`
    panel.value.appendChild(el)
  }
  nodeCount.value = 3
  logs.value = []
}

// ---------- 生命周期 ----------

onMounted(() => {
  buildObserver()
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="mo-demo">
    <!-- 配置开关 -->
    <div class="controls">
      <label class="switch">
        <input
          v-model="watchChildList"
          type="checkbox"
          @change="rebuild"
        >
        childList
      </label>
      <label class="switch">
        <input
          v-model="watchAttributes"
          type="checkbox"
          @change="rebuild"
        >
        attributes
      </label>
      <label class="switch">
        <input
          v-model="watchCharacter"
          type="checkbox"
          @change="rebuild"
        >
        characterData
      </label>
      <span class="stat">节点数 <b>{{ nodeCount }}</b></span>
    </div>

    <div class="body">
      <div class="left">
        <!-- 操作按钮 -->
        <div class="actions">
          <button
            class="btn-act"
            @click="addNode"
          >
            + 增节点
          </button>
          <button
            class="btn-act"
            @click="removeNode"
          >
            − 删节点
          </button>
          <button
            class="btn-act"
            @click="toggleAttr"
          >
            改 data-active
          </button>
          <button
            class="btn-act"
            @click="editText"
          >
            改文本
          </button>
          <button
            class="btn-reset"
            @click="resetAll"
          >
            清空重建
          </button>
        </div>

        <!-- 被观察面板 -->
        <div
          ref="panel"
          class="panel"
          data-active="false"
        >
          <div class="mo-item">
            初始节点 1
          </div>
          <div class="mo-item">
            初始节点 2
          </div>
          <div class="mo-item">
            初始节点 3
          </div>
        </div>
      </div>

      <!-- 变更日志（分类型着色） -->
      <div class="log-panel">
        <p class="log-title">
          DOM 变更日志
        </p>
        <p
          v-if="logs.length === 0"
          class="log-empty"
        >
          点左侧按钮操作 DOM，每类变更分色记录
        </p>
        <ul
          v-else
          class="log-list"
        >
          <li
            v-for="(l, i) in logs"
            :key="i"
            class="log-item"
            :class="`log-item--${l.kind}`"
          >
            <span
              class="log-tag"
              aria-hidden="true"
            >{{
              l.kind === 'add' ? '增' : l.kind === 'remove' ? '删' : l.kind === 'attr' ? '属' : '文'
            }}</span>
            {{ l.text }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mo-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9375rem;
  color: var(--text);
  cursor: pointer;

  input {
    accent-color: var(--primary);
  }
}

.stat {
  font-size: 0.9375rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.body {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 0.75rem;
}

.left {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* ---------- 操作按钮 ---------- */

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-act {
  padding: var(--demo-control-py) var(--demo-control-px);
  border-radius: var(--demo-radius);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.btn-reset {
  padding: var(--demo-control-py) var(--demo-control-px);
  border-radius: var(--demo-radius);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
    border-color: var(--text-secondary);
  }
}

/* ---------- 被观察面板 ---------- */

.panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.6rem;
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 180px;

  /* 属性变化可视化：data-active=true 时高亮边框 */
  &[data-active='true'] {
    border-color: var(--primary);
    background-color: color-mix(in srgb, var(--primary) 6%, var(--bg));
  }
}

.mo-item {
  padding: 0.35rem 0.6rem;
  font-size: 0.875rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
}

/* ---------- 日志 ---------- */

.log-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.6rem 0.8rem;
  background-color: var(--code-bg);
  max-height: 300px;
  overflow-y: auto;
}

.log-title {
  margin: 0 0 0.4rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.log-empty {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius-sm);
}

.log-item--add {
  background-color: color-mix(in srgb, var(--success) 12%, transparent);
}

.log-item--remove {
  background-color: color-mix(in srgb, var(--danger) 12%, transparent);
}

.log-item--attr {
  background-color: color-mix(in srgb, var(--primary) 12%, transparent);
}

.log-item--text {
  background-color: color-mix(in srgb, var(--warning) 12%, transparent);
}

.log-tag {
  flex-shrink: 0;
  width: 1.2rem;
  height: 1.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
