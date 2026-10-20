// ============================================================
// 案例：PDF 预览（pdf-preview）
// 浏览器里手写生成一份 3 页 PDF，再对比 iframe / object / embed 三种嵌入方式；
// 演示 #page= 与 #zoom= 参数、新窗口打开、以及 pdfjs-dist 的适用场景。
// ============================================================
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { createSamplePdf } from './pdf'

type Method = 'iframe' | 'object' | 'embed'

const method = ref<Method>('iframe')
const page = ref(1)
const zoom = ref(100)
const url = ref('')
const size = ref(0)
const genMs = ref(0)

/** 带查看器参数的地址 */
const src = computed(() => (url.value ? `${url.value}#page=${page.value}&zoom=${zoom.value}` : ''))

function release(): void {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
}

/** 现场生成 PDF：几毫秒，纯前端 */
function generate(): void {
  release()
  const t0 = performance.now()
  const blob = createSamplePdf()
  genMs.value = performance.now() - t0
  size.value = blob.size
  url.value = URL.createObjectURL(blob)
}

generate()

function openNewTab(): void {
  if (url.value) window.open(src.value || url.value, '_blank')
}

function clear(): void {
  release()
  size.value = 0
  genMs.value = 0
}

const methodNote: Record<Method, string> = {
  iframe: '最常用，兼容性好；移动端部分浏览器会直接下载而不是预览。',
  object: '语义更准确（PDF 是一种嵌入对象），但样式控制更麻烦。',
  embed: '老标签，行为和 object 接近，已不推荐在新项目使用。',
}

onBeforeUnmount(release)
</script>

<template>
  <div class="pdf-demo">
    <!-- 控制 -->
    <div class="pdf-bar">
      <button
        class="btn-act"
        @click="generate"
      >
        重新生成 PDF
      </button>
      <button
        class="btn-ghost"
        :disabled="!url"
        @click="openNewTab"
      >
        新窗口打开
      </button>
      <button
        class="btn-ghost"
        :disabled="!url"
        @click="clear"
      >
        卸载
      </button>
      <span class="pdf-stat">
        大小 <b>{{ size ? (size / 1024).toFixed(1) + ' KB' : '—' }}</b>
      </span>
      <span class="pdf-stat">
        生成 <b>{{ genMs ? genMs.toFixed(1) + ' ms' : '—' }}</b>
      </span>
    </div>

    <!-- 参数 -->
    <div class="pdf-bar">
      <div class="seg">
        <button
          v-for="m in (['iframe', 'object', 'embed'] as Method[])"
          :key="m"
          class="seg-btn"
          :class="{ active: method === m }"
          @click="method = m"
        >
          {{ m }}
        </button>
      </div>
      <label class="pdf-field">
        页码
        <input
          v-model.number="page"
          type="number"
          min="1"
          max="3"
        >
      </label>
      <label class="pdf-field">
        缩放
        <input
          v-model.number="zoom"
          type="number"
          min="25"
          max="200"
          step="25"
        >
      </label>
      <code class="pdf-src">#page={{ page }}&zoom={{ zoom }}</code>
    </div>

    <p class="pdf-note">
      {{ methodNote[method] }}
    </p>

    <!-- 预览 -->
    <div class="pdf-frame">
      <template v-if="url">
        <iframe
          v-if="method === 'iframe'"
          :src="src"
          title="PDF 预览（iframe）"
        />
        <object
          v-else-if="method === 'object'"
          :data="src"
          type="application/pdf"
        >
          <p class="pdf-fallback">
            当前浏览器不支持内嵌 PDF，<a :href="src">点击下载</a>。
          </p>
        </object>
        <embed
          v-else
          :src="src"
          type="application/pdf"
        >
      </template>
      <p
        v-else
        class="pdf-empty"
      >
        已卸载，点「重新生成 PDF」。
      </p>
    </div>

    <!-- 说明表 -->
    <table class="pdf-table">
      <thead>
        <tr>
          <th scope="col">
            方案
          </th>
          <th scope="col">
            适合
          </th>
          <th scope="col">
            局限
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>iframe / object</td>
          <td>快速预览、内部工具、PC 端</td>
          <td>UI 不可定制；移动端可能直接下载</td>
        </tr>
        <tr>
          <td>pdfjs-dist</td>
          <td>需要自定义工具栏、高亮、搜索、水印</td>
          <td>包体较大（按需分包）；要自己实现分页渲染</td>
        </tr>
        <tr>
          <td>iframely / 服务端转图</td>
          <td>跨端一致、完全可控</td>
          <td>需要服务端，成本高</td>
        </tr>
      </tbody>
    </table>

    <p class="pdf-hint">
      这份 PDF 是纯字符串拼出来的：<code>%PDF-1.4</code> 头 + 对象 + xref 偏移表。
      用 Helvetica 内置字体，所以只能放 ASCII —— 中文要嵌入字体子集，真实项目直接用
      <code>pdf-lib</code> 或 <code>pdfjs-dist</code>。
    </p>
  </div>
</template>

<style scoped>
.pdf-demo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pdf-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.btn-act,
.btn-ghost {
  padding: 0.22rem 0.55rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  cursor: pointer;
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);

  &:hover:not(:disabled) {
    background-color: var(--primary);
    color: #fff;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.btn-ghost {
  border-color: var(--border);
  color: var(--text-secondary);

  &:hover:not(:disabled) {
    background-color: var(--code-bg);
    color: var(--text);
  }
}

.pdf-stat {
  font-size: 0.72rem;
  color: var(--text-secondary);

  b {
    font-family: var(--font-mono);
    color: var(--primary);
  }
}

.seg {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.seg-btn {
  padding: 0.2rem 0.55rem;
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.7rem;
  cursor: pointer;

  &.active {
    background-color: var(--primary);
    color: #fff;
  }
}

.pdf-field {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: var(--text-secondary);

  input {
    width: 3.4rem;
    padding: 0.14rem 0.3rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background-color: var(--bg);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }
}

.pdf-src {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 0.1rem 0.35rem;
  border-radius: var(--radius-sm);
  background-color: var(--code-bg);
  color: var(--text-secondary);
}

.pdf-note {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.pdf-frame {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  overflow: hidden;
  background-color: var(--code-bg);

  iframe,
  object,
  embed {
    display: block;
    width: 100%;
    height: 340px;
    border: none;
  }
}

.pdf-fallback {
  margin: 0;
  padding: 1.5rem;
  text-align: center;
  font-size: 0.76rem;
  color: var(--text-secondary);

  a {
    color: var(--primary);
  }
}

.pdf-empty {
  margin: 0;
  padding: 2rem;
  text-align: center;
  font-size: 0.74rem;
  color: var(--text-secondary);
}

.pdf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;

  th,
  td {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    text-align: left;
    vertical-align: top;
    line-height: 1.6;
  }

  th {
    background-color: var(--code-bg);
    color: var(--text-secondary);
    font-weight: 600;
    white-space: nowrap;
  }

  td {
    color: var(--text-secondary);
  }
}

.pdf-hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.6;

  code {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.02rem 0.24rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}
</style>
