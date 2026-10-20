// ============================================================
// 案例：i18n 语言包按需加载（i18n-lazy）
// 首屏只打包当前语言（zh 静态导入），其余语言用动态 import()
// 切换时显示加载态、记录语言包体积、已加载语言不重复请求
// ============================================================
<script setup lang="ts">
import { computed, ref } from 'vue'
import zh from './locales/zh'

type Lang = 'zh' | 'en' | 'ja'

/** 语言元信息 */
const LANGS: { key: Lang; label: string }[] = [
  { key: 'zh', label: '中文' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
]

/**
 * //! 动态导入：打包器会把每个语言包切成独立 chunk，用到才下载
 * zh 已静态导入（首屏语言），这里只列其余语言
 */
const loaders: Record<Exclude<Lang, 'zh'>, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import('./locales/en'),
  ja: () => import('./locales/ja'),
}

const current = ref<Lang>('zh')
/** 当前语言文案 */
const messages = ref<Record<string, string>>(zh)
/** 已加载语言（内存缓存，切换不重复请求） */
const cache = new Map<Lang, Record<string, string>>([['zh', zh]])
const loaded = ref<Lang[]>(['zh'])
/** 各语言包大小（字节，JSON 序列化近似） */
const sizes = ref<Partial<Record<Lang, number>>>({
  zh: JSON.stringify(zh).length,
})
/** 加载态 */
const loading = ref(false)
/** 日志 */
const logs = ref<string[]>([])

function pushLog(msg: string): void {
  logs.value.unshift(msg)
  if (logs.value.length > 6) logs.value.pop()
}

// ============================================================
// 切换语言
// ============================================================

async function switchLang(lang: Lang): Promise<void> {
  if (lang === current.value || loading.value) return

  // 已加载：直接用内存缓存
  const cached = cache.get(lang)
  if (cached) {
    current.value = lang
    messages.value = cached
    pushLog(`♻ ${lang} 已在内存中，直接切换（无需请求）`)
    return
  }

  // 未加载：动态 import（这里会真实发起 chunk 请求）
  // zh 已在首屏静态加载（必命中缓存），这里显式收窄类型
  if (lang === 'zh') return

  loading.value = true
  try {
    const mod = await loaders[lang]()
    cache.set(lang, mod.default)
    loaded.value.push(lang)
    sizes.value[lang] = JSON.stringify(mod.default).length
    messages.value = mod.default
    current.value = lang
    pushLog(`⬇ 动态加载 ${lang}.ts（${sizes.value[lang]} bytes）`)
  } catch {
    pushLog(`❌ ${lang} 语言包加载失败`)
  } finally {
    loading.value = false
  }
}

// ============================================================
// 汇总
// ============================================================

const totalLoadedSize = computed(() =>
  loaded.value.reduce((sum, l) => sum + (sizes.value[l] ?? 0), 0),
)

const keys = ['greeting', 'feature', 'cta', 'sizeNote'] as const

function resetAll(): void {
  current.value = 'zh'
  messages.value = zh
  loaded.value = ['zh']
  sizes.value = { zh: JSON.stringify(zh).length }
  logs.value = []
}
</script>

<template>
  <div class="i18n-demo">
    <!-- 语言切换 -->
    <div class="i18n-bar">
      <button
        v-for="l in LANGS"
        :key="l.key"
        class="seg-btn"
        :class="{ active: current === l.key }"
        :disabled="loading"
        @click="switchLang(l.key)"
      >
        {{ l.label }}
      </button>
      <span
        v-if="loading"
        class="i18n-loading"
      >加载语言包…</span>
      <span class="i18n-size">
        已加载 {{ loaded.length }} / 3 · 合计 {{ totalLoadedSize }} bytes
      </span>
      <button
        class="btn-reset"
        @click="resetAll"
      >
        重置
      </button>
    </div>

    <!-- 预览卡 -->
    <section class="i18n-card">
      <h3>{{ messages.greeting }}</h3>
      <p class="i18n-feature">
        {{ messages.feature }}
      </p>
      <button class="i18n-cta">
        {{ messages.cta }}
      </button>
      <p class="i18n-note">
        {{ messages.sizeNote }}
      </p>
    </section>

    <!-- 键值对照 -->
    <section class="i18n-keys">
      <h4>当前语言包的键</h4>
      <table>
        <tbody>
          <tr
            v-for="k in keys"
            :key="k"
          >
            <th scope="row">
              {{ k }}
            </th>
            <td>{{ messages[k] }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 大小与日志 -->
    <div class="i18n-meta">
      <span
        v-for="l in loaded"
        :key="l"
        class="i18n-chip"
      >{{ l }}: {{ sizes[l] }} B</span>
    </div>
    <ul class="i18n-log">
      <li
        v-for="(l, i) in logs"
        :key="i"
      >
        {{ l }}
      </li>
    </ul>

    <p class="i18n-hint">
      首次切到 English / 日本語 会等待约 300~600ms（真实网络 chunk 请求）；切回已加载语言是瞬时的。
      打开 DevTools → Network 可以看到额外的语言包 chunk。
    </p>
  </div>
</template>

<style scoped>
.i18n-demo {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* ---------- 切换栏 ---------- */

.i18n-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.seg-btn {
  padding: 0.22rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.74rem;
  cursor: pointer;

  &.active {
    border-color: var(--primary);
    background-color: var(--primary);
    color: #fff;
  }

  &:disabled {
    opacity: 0.55;
    cursor: wait;
  }
}

.i18n-loading {
  font-size: 0.72rem;
  color: var(--warning);
}

.i18n-size {
  margin-left: auto;
  font-size: 0.71rem;
  color: var(--text-secondary);
}

.btn-reset {
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.7rem;
  cursor: pointer;
}

/* ---------- 预览 ---------- */

.i18n-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  h3 {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text);
  }
}

.i18n-feature {
  margin: 0;
  font-size: 0.76rem;
  color: var(--text-secondary);
  line-height: 1.7;
}

.i18n-cta {
  align-self: flex-start;
  padding: 0.28rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: var(--primary);
  color: #fff;
  font-size: 0.76rem;
  cursor: pointer;
}

.i18n-note {
  margin: 0;
  font-size: 0.7rem;
  color: var(--text-secondary);
}

/* ---------- 键值表 ---------- */

.i18n-keys {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.6rem;

  h4 {
    margin: 0 0 0.3rem;
    font-size: 0.76rem;
    color: var(--text-secondary);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.72rem;
  }

  th {
    text-align: left;
    width: 5.5rem;
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--primary);
    padding: 0.18rem 0.3rem 0.18rem 0;
    vertical-align: top;
  }

  td {
    color: var(--text-secondary);
    padding: 0.18rem 0;
    line-height: 1.6;
  }
}

/* ---------- 体积与日志 ---------- */

.i18n-meta {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.i18n-chip {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 0.08rem 0.42rem;
  border-radius: 999px;
  background-color: var(--code-bg);
  color: var(--text-secondary);
}

.i18n-log {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0.55rem;
  background-color: var(--code-bg);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  line-height: 1.85;
  color: var(--text-secondary);
  min-height: 4.4rem;
}

.i18n-hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
