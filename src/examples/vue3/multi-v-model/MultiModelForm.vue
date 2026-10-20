// ============================================================
// 多 v-model 表单组件：title / name / visible 三个模型
// defineModel('xxx') 的参数就是父级的 v-model:xxx
// set 选项演示值转换（这里等价于 .trim 修饰符）
// ============================================================
<script setup lang="ts">
/** 标题（字符串模型） */
const title = defineModel<string>('title', { default: '' })

/** 名称：写入前自动去首尾空格（set 转换） */
const name = defineModel<string>('name', {
  default: '',
  set: (value) => value.trim(),
})

/** 可见性（布尔模型） */
const visible = defineModel<boolean>('visible', { default: false })
</script>

<template>
  <div class="mm-form">
    <label class="mm-field">
      <span class="mm-label">标题 v-model:title</span>
      <input
        v-model="title"
        class="mm-input"
        placeholder="输入标题"
      >
    </label>

    <label class="mm-field">
      <span class="mm-label">名称 v-model:name（自动 trim）</span>
      <input
        v-model="name"
        class="mm-input"
        placeholder="首尾空格会被去掉"
      >
    </label>

    <div class="mm-visible">
      <span class="mm-label">弹层可见 v-model:visible</span>
      <button
        class="mm-switch"
        type="button"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        {{ visible ? '已打开' : '已关闭' }}
      </button>
    </div>

    <!-- 子组件内部消费 visible：不需要父级传 slot -->
    <div
      v-if="visible"
      class="mm-pop"
    >
      我是子组件内部的弹层（visible 为 true 时显示）
    </div>
  </div>
</template>

<style scoped>
.mm-form {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.mm-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.mm-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.mm-input {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: var(--bg);
  color: var(--text);
  font-size: 0.9375rem;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.mm-visible {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-top: 1px dashed var(--border);
  padding-top: 0.5rem;
}

.mm-switch {
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.8125rem;
  cursor: pointer;

  &[aria-pressed='true'] {
    background-color: var(--primary);
    color: #fff;
  }
}

.mm-pop {
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-sm);
  background-color: var(--primary-soft);
  color: var(--primary-soft-text);
  font-size: 0.8125rem;
}
</style>
