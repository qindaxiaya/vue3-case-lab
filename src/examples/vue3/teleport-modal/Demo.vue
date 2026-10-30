// ============================================================
// 案例：Teleport 弹层工程化（teleport-modal）
// 除了「挂到 body」，补齐真实弹窗必备的四件事：
// 1. 背景滚动锁（记录原值 + 关闭还原）
// 2. Esc 关闭
// 3. 焦点陷阱（Tab 在弹窗内循环）
// 4. 关闭后焦点回到触发按钮
// ============================================================
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const open = ref(false)

/** 触发按钮（关闭后焦点归还） */
/** 触发按钮：Naive 按钮的模板 ref 拿到的是组件实例，取 $el 才是真实 <button> */
const triggerRef = ref<{ $el?: HTMLElement } | null>(null)
/** 弹窗容器（焦点陷阱范围） */
const modalRef = ref<HTMLElement | null>(null)

/** 打开前的 body overflow 原值 */
let prevOverflow = ''
/** 打开前聚焦的元素（兜底：没有 trigger 时归还给它） */
let prevActive: HTMLElement | null = null

// ============================================================
// 开关
// ============================================================

async function openModal(): Promise<void> {
  prevActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
  prevOverflow = document.body.style.overflow

  open.value = true

  //! 滚动锁：body overflow hidden（弹窗内容自己可滚）
  document.body.style.overflow = 'hidden'

  // 等 Teleport 内容渲染后再聚焦第一个可交互元素
  await nextTick()
  focusFirst()
}

function closeModal(): void {
  open.value = false
  //! 还原滚动（不能直接写 ''，可能覆盖页面原有值）
  document.body.style.overflow = prevOverflow
  //! 焦点归还：无障碍的关键一步（组件实例要先取 $el 才是真实按钮）
  ;(triggerRef.value?.$el ?? prevActive)?.focus()
}

// ============================================================
// 焦点管理
// ============================================================

/** 弹窗内可聚焦元素选择器 */
const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function getFocusables(): HTMLElement[] {
  if (!modalRef.value) return []
  return Array.from(modalRef.value.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled'),
  )
}

function focusFirst(): void {
  const list = getFocusables()
  list[0]?.focus()
}

/** //! 焦点陷阱：Tab / Shift+Tab 在弹窗内循环 */
function onKeydown(e: KeyboardEvent): void {
  if (!open.value) return

  if (e.key === 'Escape') {
    e.preventDefault()
    closeModal()
    return
  }

  if (e.key !== 'Tab') return
  const list = getFocusables()
  if (list.length === 0) return

  const first = list[0]
  const last = list[list.length - 1]
  const active = document.activeElement as HTMLElement | null

  // 正向到底 → 回第一个；反向到顶 → 去最后一个
  if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  } else if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  }
}

// 弹窗打开期间监听键盘；关闭即移除
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})

// 组件卸载兜底：清监听 + 解锁滚动
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  if (open.value) {
    document.body.style.overflow = prevOverflow
  }
})

// ============================================================
// 表单演示
// ============================================================

const form = ref({ name: '', email: '' })
const saved = ref('')

function save(): void {
  saved.value = `${form.value.name || '未命名'} / ${form.value.email || '无邮箱'}`
  closeModal()
}

/** 打开次数（演示滚动锁与焦点归还） */
const openCount = ref(0)
watch(open, (v) => {
  if (v) openCount.value++
})
</script>

<template>
  <div class="tp-demo">
    <!-- 打开入口 -->
    <section class="tp-card">
      <h3>触发</h3>
      <p class="tp-desc">
        弹窗被 <code>Teleport to="body"</code> 挂到 body；打开时背景滚动锁死。
      </p>
      <n-button
        ref="triggerRef"
        class="btn-act"
        type="primary"
        @click="openModal"
      >
        打开弹窗
      </n-button>
      <p class="tp-meta">
        已打开 <b>{{ openCount }}</b> 次 · 上次保存：<b>{{ saved || '—' }}</b>
      </p>
    </section>

    <!-- 长内容：验证滚动锁 -->
    <section class="tp-card tp-card--scroll">
      <h3>背景内容</h3>
      <p
        v-for="i in 12"
        :key="i"
        class="tp-line"
      >
        第 {{ i }} 行背景内容 —— 弹窗打开时这里应该滚不动。
      </p>
    </section>

    <!-- 弹窗本体（Teleport 到 body） -->
    <Teleport to="body">
      <div
        v-if="open"
        class="tp-mask"
        @click.self="closeModal"
      >
        <div
          ref="modalRef"
          class="tp-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tp-title"
        >
          <header class="tp-head">
            <h3 id="tp-title">
              编辑资料
            </h3>
            <button
              class="tp-close"
              aria-label="关闭弹窗"
              @click="closeModal"
            >
              ✕
            </button>
          </header>

          <div class="tp-body">
            <label class="tp-field">
              <span>姓名</span>
              <input
                v-model="form.name"
                placeholder="输入姓名"
              >
            </label>
            <label class="tp-field">
              <span>邮箱</span>
              <input
                v-model="form.email"
                placeholder="输入邮箱"
              >
            </label>
            <p class="tp-tip">
              Tab 在弹窗内循环、Esc 关闭、点遮罩关闭；关闭后焦点回到「打开弹窗」。
            </p>
          </div>

          <footer class="tp-foot">
            <n-button
              @click="closeModal"
            >
              取消
            </n-button>
            <n-button
              type="primary"
              @click="save"
            >
              保存
            </n-button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tp-demo {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 0.65rem;
}

.tp-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--text);
  }
}

.tp-card--scroll {
  max-height: 320px;
  overflow: auto;
}

.tp-desc,
.tp-meta {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.tp-line {
  margin: 0;
  padding: 0.3rem 0;
  border-bottom: 1px dashed var(--border);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.btn-act {
  align-self: flex-start;
}




/* ---------- 弹窗（Teleport 到 body 后不受 scoped 限制，靠全局唯一类名） ---------- */

.tp-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgb(0 0 0 / 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.tp-modal {
  width: min(420px, 100%);
  background-color: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  box-shadow: 0 18px 50px rgb(0 0 0 / 0.25);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: auto;
}

.tp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0.8rem;
  border-bottom: 1px solid var(--border);

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--text);
  }
}

.tp-close {
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
  }
}

.tp-body {
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tp-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  span {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  input {
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background-color: var(--bg);
    color: var(--text);
    font-size: 0.875rem;

    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }
}

.tp-tip {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.tp-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
  padding: 0.6rem 0.8rem;
  border-top: 1px solid var(--border);
}

@media (max-width: 760px) {
  .tp-demo {
    grid-template-columns: 1fr;
  }
}
</style>
