// ============================================================
// 案例演示区通用分段控件（互斥模式 / 对比切换）
// - 语义是 radiogroup：Tab 只停当前项，方向键切换并跟随焦点
// - 视觉与事件循环案例的「直觉预期 / 真实输出」保持一致
// ============================================================
<script setup lang="ts">
import { nextTick } from 'vue'
import type { SegmentedOption } from './types'

const props = withDefaults(
  defineProps<{
    /** 当前选中值 */
    modelValue: string | number
    /** 选项列表 */
    options: readonly SegmentedOption[]
    /** 无障碍名称，例如「输出对照」 */
    label: string
    /** 整组禁用 */
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

/** 点击某一项：禁用时不响应 */
function select(option: SegmentedOption): void {
  if (props.disabled || option.disabled || option.value === props.modelValue) return
  emit('update:modelValue', option.value)
}

/** 方向键 / Home / End 切换；跳过禁用项，切换后把焦点交给新选中项 */
async function onKeydown(event: KeyboardEvent): Promise<void> {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  if (props.disabled || !keys.includes(event.key)) return

  const enabled = props.options.filter((option) => !option.disabled)
  if (enabled.length === 0) return

  event.preventDefault()
  const current = enabled.findIndex((option) => option.value === props.modelValue)

  let nextIndex: number
  if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = enabled.length - 1
  } else {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
    nextIndex = (current + step + enabled.length) % enabled.length
  }

  const next = enabled[nextIndex]
  if (!next) return

  // currentTarget 在 await 之后会失效，先把根节点存下来
  const root = event.currentTarget as HTMLElement
  emit('update:modelValue', next.value)
  await nextTick()
  const buttons = [...root.querySelectorAll<HTMLElement>('[role="radio"]')]
  buttons.find((button) => button.dataset.mode === String(next.value))?.focus()
}
</script>

<template>
  <div
    class="demo-seg"
    role="radiogroup"
    :aria-label="label"
    @keydown="onKeydown"
  >
    <button
      v-for="option in options"
      :key="option.value"
      class="demo-seg__btn"
      role="radio"
      :aria-checked="option.value === modelValue"
      :tabindex="option.value === modelValue ? 0 : -1"
      :disabled="disabled || option.disabled"
      :data-mode="String(option.value)"
      type="button"
      @click="select(option)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.demo-seg {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--demo-radius);
  background-color: var(--bg-subtle);
}

.demo-seg__btn {
  min-height: calc(var(--demo-control-h) - 0.5rem);
  padding: 0.35rem 0.7rem;
  border: none;
  border-radius: calc(var(--demo-radius) - 2px);
  background-color: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--demo-text-sm);
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color var(--transition),
    color var(--transition),
    box-shadow var(--transition);
}

.demo-seg__btn:hover:not(:disabled) {
  color: var(--primary);
}

.demo-seg__btn[aria-checked='true'] {
  background-color: var(--surface);
  color: var(--primary);
  box-shadow: var(--shadow-soft);
}

.demo-seg__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.demo-seg__btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

@media (max-width: 768px) {
  .demo-seg__btn {
    min-height: calc(var(--demo-control-h-touch) - 0.5rem);
  }
}
</style>
