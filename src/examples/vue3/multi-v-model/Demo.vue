// ============================================================
// 案例：多 v-model 参数与修饰符（multi-v-model）
// 一个子组件同时绑定 title / name / visible 三个模型：
// - defineModel('title') ↔ 父级 v-model:title
// - defineModel('name') 的 set 选项演示自动 trim（等价修饰符）
// - 布尔模型 visible 直接控制子组件内部弹层
// ============================================================
<script setup lang="ts">
import { ref } from 'vue'
import MultiModelForm from './MultiModelForm.vue'

const title = ref('季度报表')
const name = ref('  张三  ')
const visible = ref(false)

function resetAll(): void {
  title.value = '季度报表'
  name.value = '  张三  '
  visible.value = false
}
</script>

<template>
  <div class="mm-demo">
    <!-- 子组件：三个 v-model 参数 -->
    <section class="mm-card">
      <MultiModelForm
        v-model:title="title"
        v-model:name="name"
        v-model:visible="visible"
      />
    </section>

    <!-- 父级实时状态 -->
    <section class="mm-state">
      <h3>父组件拿到的值</h3>
      <dl>
        <div>
          <dt>title</dt>
          <dd>{{ JSON.stringify(title) }}</dd>
        </div>
        <div>
          <dt>name</dt>
          <dd>{{ JSON.stringify(name) }}</dd>
        </div>
        <div>
          <dt>visible</dt>
          <dd>{{ visible }}</dd>
        </div>
      </dl>
      <p class="mm-hint">
        在「名称」里输入前后空格 → 父级收到的是 trim 后的值（set 转换）。
      </p>
      <button
        class="btn-reset"
        @click="resetAll"
      >
        重置
      </button>
    </section>
  </div>
</template>

<style scoped>
.mm-demo {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 0.65rem;
}

.mm-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;
}

.mm-state {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;

  h3 {
    margin: 0 0 0.4rem;
    font-size: 0.8rem;
    color: var(--text);
  }

  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  dl > div {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }

  dt {
    width: 4.2rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--primary);
    word-break: break-all;
  }
}

.mm-hint {
  margin: 0.45rem 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.btn-reset {
  padding: 0.24rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.72rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
  }
}

@media (max-width: 760px) {
  .mm-demo {
    grid-template-columns: 1fr;
  }
}
</style>
