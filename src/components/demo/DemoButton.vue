// ============================================================
// 案例演示区通用按钮
// - 所有案例共用同一套尺寸、圆角、焦点环与过渡
// - 只负责外观；点击、disabled、aria-* 等原生属性直接透传
// ============================================================
<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 视觉变体：主操作 / 描边 / 危险操作 / 弱化操作 */
    variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
    /** 尺寸：sm 用于工具栏，md 用于主要操作 */
    size?: 'sm' | 'md'
    /** 独立开关的选中态（互斥模式请用 DemoSegmented） */
    active?: boolean
    /** 是否占满一行 */
    block?: boolean
  }>(),
  {
    variant: 'ghost',
    size: 'md',
    active: false,
    block: false,
  },
)
</script>

<template>
  <button
    class="demo-btn"
    :class="[
      `demo-btn--${variant}`,
      `demo-btn--${size}`,
      { 'is-active': active, 'is-block': block },
    ]"
    type="button"
  >
    <slot />
  </button>
</template>

<style scoped>
.demo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
  border: 1px solid transparent;
  border-radius: var(--radius-btn);
  font-family: inherit;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color var(--transition),
    border-color var(--transition),
    color var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
}

.demo-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.demo-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.demo-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* ---------- 尺寸 ---------- */

.demo-btn--md {
  min-height: var(--demo-control-h);
  padding: var(--demo-control-py) var(--demo-control-px);
  font-size: var(--demo-text-md);
}

.demo-btn--sm {
  min-height: calc(var(--demo-control-h) - 0.25rem);
  padding: 0.3rem 0.7rem;
  font-size: var(--demo-text-sm);
}

.demo-btn.is-block {
  width: 100%;
}

/* ---------- 变体 ---------- */

.demo-btn--primary {
  background-color: var(--primary);
  color: #fff;
}

.demo-btn--primary:hover:not(:disabled) {
  background-color: var(--primary-hover);
}

.demo-btn--ghost {
  border-color: var(--border);
  background-color: transparent;
  color: var(--text-secondary);
}

.demo-btn--ghost:hover:not(:disabled),
.demo-btn--ghost.is-active {
  border-color: var(--primary);
  background-color: var(--primary-soft);
  color: var(--primary);
}

.demo-btn--danger {
  border-color: var(--danger);
  background-color: transparent;
  color: var(--danger);
}

.demo-btn--danger:hover:not(:disabled),
.demo-btn--danger.is-active {
  background-color: var(--danger);
  color: #fff;
}

.demo-btn--subtle {
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
}

.demo-btn--subtle:hover:not(:disabled),
.demo-btn--subtle.is-active {
  background-color: var(--primary-soft);
  color: var(--primary);
}

@media (max-width: 768px) {
  .demo-btn--md {
    min-height: var(--demo-control-h-touch);
  }
}
</style>
