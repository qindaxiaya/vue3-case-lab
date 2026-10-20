// ============================================================
// 案例：自定义指令三件套（custom-directives）
// v-permission：按角色显示/隐藏按钮
// v-lazy：IntersectionObserver 懒加载图片（滚动容器内）
// v-click-outside：点外部关闭下拉
// script setup 中以 v 开头的变量会自动注册为局部指令
// ============================================================
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Directive } from 'vue'

// ============================================================
// 1. v-permission
// ============================================================

type Role = 'admin' | 'editor' | 'guest'

const role = ref<Role>('admin')

/** 依据角色显隐元素（display 控制，保留 DOM） */
function applyPermission(el: HTMLElement, allowed: string[]): void {
  el.style.display = allowed.includes(role.value) ? '' : 'none'
}

const vPermission: Directive<HTMLElement, string[]> = {
  mounted(el, binding) {
    applyPermission(el, binding.value)
  },
  updated(el, binding) {
    applyPermission(el, binding.value)
  },
}

// ============================================================
// 2. v-lazy
// ============================================================

/** 图片真实地址（canvas 生成，离线可用） */
const imageUrls = Array.from({ length: 12 }, (_, i) => makeImage(i))

/** 已加载数量 */
const lazyLoaded = ref(0)

const ioMap = new WeakMap<HTMLElement, IntersectionObserver>()

const vLazy: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        el.setAttribute('src', binding.value)
        lazyLoaded.value++
        io.disconnect()
        ioMap.delete(el)
      },
      // 提前 80px 预加载，滚动更顺滑
      { rootMargin: '80px', threshold: 0.01 },
    )
    io.observe(el)
    ioMap.set(el, io)
  },
  unmounted(el) {
    ioMap.get(el)?.disconnect()
    ioMap.delete(el)
  },
}

/** 生成演示图片：渐变底 + 序号（避免外网依赖） */
function makeImage(index: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 140
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const hue = (index * 31) % 360
  const gradient = ctx.createLinearGradient(0, 0, 320, 140)
  gradient.addColorStop(0, `hsl(${hue}, 70%, 55%)`)
  gradient.addColorStop(1, `hsl(${(hue + 50) % 360}, 70%, 40%)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 320, 140)

  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = 'bold 34px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`IMG ${index + 1}`, 160, 70)
  return canvas.toDataURL('image/png')
}

// ============================================================
// 3. v-click-outside
// ============================================================

const dropdownOpen = ref(false)
const outsideHits = ref(0)

const handlerMap = new WeakMap<HTMLElement, (e: PointerEvent) => void>()

const vClickOutside: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    const handler = (e: PointerEvent): void => {
      if (!el.contains(e.target as Node)) {
        outsideHits.value++
        binding.value()
      }
    }
    handlerMap.set(el, handler)
    document.addEventListener('pointerdown', handler, true)
  },
  unmounted(el) {
    const handler = handlerMap.get(el)
    if (handler) document.removeEventListener('pointerdown', handler, true)
    handlerMap.delete(el)
  },
}

function closeDropdown(): void {
  dropdownOpen.value = false
}

// ============================================================
// 其他
// ============================================================

const roles: Role[] = ['admin', 'editor', 'guest']

const roleLabel = computed(() => {
  const map: Record<Role, string> = { admin: '管理员', editor: '编辑', guest: '游客' }
  return map[role.value]
})

function resetAll(): void {
  role.value = 'admin'
  lazyLoaded.value = 0
  dropdownOpen.value = false
  outsideHits.value = 0
}

// 组件卸载时兜底清理（指令自身也有 unmounted，双保险）
onBeforeUnmount(() => {
  dropdownOpen.value = false
})
</script>

<template>
  <div class="dir-demo">
    <!-- 1. 权限 -->
    <section
      class="dir-card"
      aria-label="v-permission 实验"
    >
      <header class="dir-head">
        <h3><code>v-permission</code></h3>
        <span class="dir-tag">角色：{{ roleLabel }}</span>
      </header>

      <div class="dir-row">
        <button
          v-for="r in roles"
          :key="r"
          class="seg-btn"
          :class="{ active: role === r }"
          @click="role = r"
        >
          {{ r }}
        </button>
      </div>

      <div class="dir-row">
        <button
          v-permission="['admin']"
          class="btn-act"
        >
          删除（仅 admin）
        </button>
        <button
          v-permission="['admin', 'editor']"
          class="btn-act"
        >
          编辑（admin/editor）
        </button>
        <button class="btn-act">
          查看（所有人）
        </button>
      </div>
      <p class="dir-note">
        切角色看按钮消失/出现：指令在 mounted/updated 时直接改 <code>display</code>。
      </p>
    </section>

    <!-- 2. 懒加载 -->
    <section
      class="dir-card"
      aria-label="v-lazy 实验"
    >
      <header class="dir-head">
        <h3><code>v-lazy</code></h3>
        <span class="dir-tag">已加载 {{ lazyLoaded }} / {{ imageUrls.length }}</span>
      </header>

      <div class="lazy-scroll">
        <img
          v-for="(src, i) in imageUrls"
          :key="i"
          v-lazy="src"
          class="lazy-img"
          :alt="`示例图片 ${i + 1}`"
          width="320"
          height="140"
        >
      </div>
      <p class="dir-note">
        向下滚动：只有进入视口（含提前 80px）的图片才设 <code>src</code>。
      </p>
    </section>

    <!-- 3. 点外部关闭 -->
    <section
      class="dir-card"
      aria-label="v-click-outside 实验"
    >
      <header class="dir-head">
        <h3><code>v-click-outside</code></h3>
        <span class="dir-tag">外部点击 {{ outsideHits }} 次</span>
      </header>

      <div class="dropdown-wrap">
        <button
          class="btn-act"
          @click="dropdownOpen = !dropdownOpen"
        >
          打开下拉
        </button>

        <!-- //! v-click-outside 绑定关闭回调 -->
        <div
          v-if="dropdownOpen"
          v-click-outside="closeDropdown"
          class="dropdown"
        >
          <button
            v-for="item in ['复制', '重命名', '删除']"
            :key="item"
            class="dropdown-item"
            @click="dropdownOpen = false"
          >
            {{ item }}
          </button>
        </div>
      </div>
      <p class="dir-note">
        打开后点面板外部关闭；点面板内部不关闭（<code>el.contains</code> 判定）。
      </p>
    </section>

    <button
      class="btn-reset"
      @click="resetAll"
    >
      重置全部
    </button>
  </div>
</template>

<style scoped>
.dir-demo {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

/* 第三个卡片横跨两列 */
.dir-card:nth-child(3) {
  grid-column: 1 / -1;
}

.dir-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.dir-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;

  h3 {
    margin: 0;
    font-size: 0.875rem;

    code {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      color: var(--primary);
    }
  }
}

.dir-tag {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.dir-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dir-note {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.02rem 0.22rem;
    background-color: var(--code-bg);
    border-radius: var(--radius-sm);
  }
}

/* ---------- 分段按钮 ---------- */

.seg-btn {
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;

  &.active {
    border-color: var(--primary);
    background-color: var(--primary);
    color: #fff;
  }
}

.btn-act {
  padding: 0.28rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.btn-reset {
  grid-column: 1 / -1;
  justify-self: start;
  padding: 0.22rem 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
  }
}

/* ---------- 懒加载 ---------- */

.lazy-scroll {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-right: 0.2rem;
}

.lazy-img {
  width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  /* 未加载时显示占位底色 */
  background-color: var(--code-bg);
  display: block;
}

/* ---------- 下拉 ---------- */

.dropdown-wrap {
  position: relative;
}

.dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  z-index: 5;
  min-width: 8rem;
  background-color: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.12);
  padding: 0.2rem;
  display: flex;
  flex-direction: column;
}

.dropdown-item {
  text-align: left;
  padding: 0.3rem 0.5rem;
  border: none;
  background: none;
  color: var(--text);
  font-size: 0.8125rem;
  border-radius: var(--radius-sm);
  cursor: pointer;

  &:hover {
    background-color: var(--code-bg);
  }
}

@media (max-width: 760px) {
  .dir-demo {
    grid-template-columns: 1fr;
  }

  .dir-card:nth-child(3) {
    grid-column: auto;
  }
}
</style>
