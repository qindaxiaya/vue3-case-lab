// ============================================================
// 案例：异步组件加载与重试（async-suspense）
// - defineAsyncComponent 包装模拟慢加载组件（可控延迟/失败）
// - loadingComponent 骨架屏（delay 内不闪现防抖动）
// - errorComponent 错误态 + onErrorCaptured 捕获 + 换 key 重试
// - timeout 配置演示（超时走 errorComponent）
// ============================================================
<script setup lang="ts">
/* eslint-disable vue/one-component-per-file -- 内联多子组件保证「demo源码」自包含 */
import {
  defineAsyncComponent,
  defineComponent,
  h,
  onErrorCaptured,
  ref,
} from 'vue'

// ---------- 内联子组件（render 函数，保证「demo源码」自包含） ----------

/** 模拟的重组件：真实场景是路由级/大图表 chunk */
const SlowPanel = defineComponent({
  name: 'SlowPanel',
  setup: () => () =>
    h('div', { class: 'async-panel' }, [
      h('p', { class: 'async-panel__title' }, '异步内容已加载'),
      h('p', { class: 'async-panel__desc' }, '模拟的重组件：真实项目中这是动态 import 的路由级 chunk'),
    ]),
})

/** 骨架屏组件（delay 200ms 后才显示，短加载不闪） */
const SkeletonBox = defineComponent({
  name: 'SkeletonBox',
  setup: () => () => h('div', { class: 'async-skel' }, '加载中…'),
})

/** 错误组件（加载失败 / timeout 超时都走这里） */
const ErrorBox = defineComponent({
  name: 'ErrorBox',
  setup: () => () => h('div', { class: 'async-err' }, '加载失败——点「重试」重新加载'),
})

// ---------- 异步组件工厂（配置项全家桶） ----------

/** 延迟时长 ms（滑块可调） */
const delayMs = ref(1200)
/** 是否让下次加载失败（模拟网络错误） */
const failNext = ref(false)
/** 重试代数：换 key 强制销毁旧实例、重新走 loader */
const attempt = ref(0)

/**
 * defineAsyncComponent 配置说明：
 * loader          —— 返回 Promise 的工厂（真实项目：() => import('./Big.vue')）
 * delay           —— 加载超过 delay ms 才显示 loading（防快网闪一下骨架屏）
 * timeout         —— 超过 timeout ms 未加载完视为失败 → errorComponent
 * loadingComponent / errorComponent —— 加载中 / 失败的展示组件
 */
const AsyncPanel = defineAsyncComponent({
  // 显式泛型：reject 分支会让 TS 把 resolve 参数推窄成 never
  loader: () =>
    new Promise<typeof SlowPanel>((resolve, reject) => {
      setTimeout(() => {
        if (failNext.value) {
          reject(new Error('模拟加载失败'))
        } else {
          resolve(SlowPanel)
        }
      }, delayMs.value)
    }),
  delay: 200,
  timeout: 5000,
  loadingComponent: SkeletonBox,
  errorComponent: ErrorBox,
})

// ---------- 失败捕获与重试 ----------

//! onErrorCaptured：捕获子树错误（返回 false 阻止继续冒泡成全局未处理错误）
onErrorCaptured((err) => {
  console.warn('[async-suspense demo] 捕获异步加载错误：', err)
  return false
})

/** 重试：attempt++ → :key 变化 → 旧实例卸载、新实例重新执行 loader */
function retry(): void {
  attempt.value++
}
</script>

<template>
  <div class="async-demo">
    <!-- 控制行 -->
    <div class="controls">
      <label class="ctl">
        加载延迟
        <input
          v-model.number="delayMs"
          type="range"
          min="0"
          max="3000"
          step="100"
        >
        <span class="ctl-val">{{ delayMs }}ms</span>
      </label>
      <label class="switch">
        <input
          v-model="failNext"
          type="checkbox"
        >
        模拟加载失败
      </label>
      <n-button
        type="primary"
        @click="retry"
      >
        重试（重建组件）
      </n-button>
      <span class="attempt">第 {{ attempt + 1 }} 次加载</span>
    </div>

    <!-- 异步组件挂载点：换 key 即重试 -->
    <AsyncPanel :key="attempt" />

    <p class="hint">
      提示：失败后勾选取消、点「重试」即可恢复；加载中拖动滑块需重试生效（key 未变不重新加载）。
    </p>
  </div>
</template>

<!--
  非 scoped：内联 render 函数创建的节点不带 scoped 属性，scoped 样式无法命中。
  类名加 async- 前缀避免全局冲突（框架与案例抽离约束下仅本案例页使用）。
-->
<style>
.async-skel {
  padding: 1.5rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-btn);
  color: var(--text-secondary);
  text-align: center;
  font-size: 0.9375rem;
  animation: async-pulse 1.2s ease-in-out infinite;
}

@keyframes async-pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

.async-err {
  padding: 1.5rem;
  border: 1px solid var(--danger);
  border-radius: var(--radius-btn);
  color: var(--danger);
  text-align: center;
  font-size: 0.9375rem;
}

.async-panel {
  padding: 1.5rem;
  border: 1px solid var(--success);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
}

.async-panel__title {
  margin: 0 0 0.4rem;
  font-weight: 600;
  color: var(--text);
}

.async-panel__desc {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}
</style>

<style scoped>
.async-demo {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  flex-wrap: wrap;
}

.ctl {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  color: var(--text);

  input[type='range'] {
    accent-color: var(--primary);
  }
}

.ctl-val {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--primary);
  min-width: 3.2em;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9375rem;
  color: var(--text);
  cursor: pointer;

  input {
    accent-color: var(--primary);
  }
}



.attempt {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}
</style>
