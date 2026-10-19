// ============================================================
// 案例：Teleport 弹层管理（teleport-layer）
// - 多个模态框/气泡卡通过 Teleport 挂到 body：脱离父容器 overflow/transform 限制
// - z-index 分层管理：modal > popover > 文档流（集中式 zIndex 计数器防冲突）
// - to-body vs to-inline 容器对比：内联容器里模态框被 overflow:hidden 裁掉
// - disable 切换：同一弹层在「挂 body」与「留原位」间切换
// ============================================================
<script setup lang="ts">
import { ref } from 'vue'

// ---------- 弹层状态 ----------

/** 模态框是否可见 */
const showModal = ref(false)
/** 气泡卡是否可见 */
const showPopover = ref(false)
/** 是否 teleport 到 body（false = 留在原容器，演示 overflow 裁剪问题） */
const teleportToBody = ref(true)

/**
 * 集中式 z-index 管理：所有弹层从同一计数器领取层级。
 * 避免各组件散落写死 z-9999 互相覆盖的经典事故。
 */
let zIndexCounter = 1000
function nextZIndex(): number {
  zIndexCounter += 10
  return zIndexCounter
}

/** 模态框 z-index（打开时领取一次） */
const modalZ = ref(0)
/** 气泡 z-index（打开时领取，且始终高于模态框——气泡可能叠在模态框上） */
const popoverZ = ref(0)

function openModal(): void {
  modalZ.value = nextZIndex()
  showModal.value = true
}

function openPopover(): void {
  // 气泡若已打开先领新号（叠层顺序保证：后开的在上）
  popoverZ.value = nextZIndex()
  showPopover.value = true
}
</script>

<template>
  <div class="tl-demo">
    <!-- 控制行 -->
    <div class="controls">
      <button
        class="btn-act"
        @click="openModal"
      >
        打开模态框
      </button>
      <button
        class="btn-act"
        @click="openPopover"
      >
        打开气泡卡
      </button>
      <label class="switch">
        <input
          v-model="teleportToBody"
          type="checkbox"
        >
        Teleport 到 body（取消勾选看 overflow 裁剪）
      </label>
    </div>

    <!-- 演示舞台：overflow:hidden 容器——不 teleport 的弹层会被裁掉 -->
    <div class="stage">
      <p class="stage-title">
        overflow: hidden 舞台
      </p>
      <p class="stage-desc">
        模态框/气泡本体渲染在舞台中央。取消勾选「Teleport 到 body」后再打开——弹层被舞台边界裁剪（经典 bug）；勾选后弹层挂到 body，彻底脱离裁剪。
      </p>

      <!-- 气泡卡：锚定在舞台内按钮旁 -->
      <div class="anchor">
        <button
          class="btn-act"
          @click="openPopover"
        >
          锚点按钮（气泡挂这里）
        </button>

        <!-- 气泡卡本体 -->
        <Teleport
          :to="teleportToBody ? 'body' : '.tl-stage-inline'"
          :disabled="!teleportToBody"
        >
          <div
            v-if="showPopover"
            class="popover"
            :style="{ zIndex: popoverZ }"
            role="dialog"
            aria-label="示例气泡卡"
          >
            <p class="popover-title">
              气泡卡（z-index {{ popoverZ }}）
            </p>
            <p class="popover-body">
              teleportToBody=true：挂 body，不受任何父级 overflow/transform 限制。
            </p>
            <button
              class="btn-reset"
              @click="showPopover = false"
            >
              关闭
            </button>
          </div>
        </Teleport>
      </div>

      <!-- 内联 teleport 目标容器（disabled 时的落点） -->
      <div class="tl-stage-inline inline-target" />
    </div>

    <!-- 模态框：始终 teleport 到 body -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="modal-mask"
        :style="{ zIndex: modalZ }"
        role="dialog"
        aria-modal="true"
        aria-label="示例模态框"
        @click.self="showModal = false"
      >
        <div class="modal-card">
          <p class="modal-title">
            模态框（z-index {{ modalZ }}）
          </p>
          <p class="modal-body">
            遮罩覆盖全视口。多个弹层从同一计数器领取 z-index——后开的层级更高，永不互相压错。
          </p>
          <button
            class="btn-reset"
            @click="showModal = false"
          >
            关闭
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tl-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--text);
  cursor: pointer;

  input {
    accent-color: var(--primary);
  }
}

.btn-act {
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 0.78rem;
  cursor: pointer;

  &:hover {
    background-color: var(--primary);
    color: #fff;
  }
}

.btn-reset {
  padding: 0.28rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;

  &:hover {
    color: var(--text);
    border-color: var(--text-secondary);
  }
}

/* ---------- 舞台 ---------- */

.stage {
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 0.9rem;
  background-color: var(--bg);
  /* 关键：overflow hidden 制造裁剪环境 */
  overflow: hidden;
  min-height: 160px;
}

.stage-title {
  margin: 0 0 0.3rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
}

.stage-desc {
  margin: 0 0 0.7rem;
  font-size: 0.76rem;
  line-height: 1.65;
  color: var(--text-secondary);
}

.anchor {
  position: relative;
  display: inline-block;
}

/* 内联 teleport 落点（disabled 时气泡渲染到这里，会受舞台 overflow 裁剪） */
.inline-target {
  position: absolute;
  inset: auto;
}

.tl-stage-inline {
  /* 标记容器，供 teleport :to 选择器定位 */
  position: static;
}

/* ---------- 气泡卡 ---------- */

.popover {
  /* absolute：teleport 到 body 时相对页面可见；disabled 内联时相对 anchor——
     超出舞台边界即被 overflow:hidden 裁掉（演示对比的关键） */
  position: absolute;
  left: 11.5rem;
  top: -1rem;
  width: 240px;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  background-color: var(--bg);
  box-shadow: var(--shadow-lg, 0 10px 25px rgb(0 0 0 / 0.15));
}

.popover-title {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
}

.popover-body {
  margin: 0 0 0.55rem;
  font-size: 0.74rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* ---------- 模态框（teleport 到 body，scoped 样式仍生效——Vue 传递 data-v） ---------- */

.modal-mask {
  position: fixed;
  inset: 0;
  background-color: rgb(0 0 0 / 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card {
  width: min(400px, 86vw);
  padding: 1.1rem 1.3rem;
  border-radius: var(--radius-card, 1rem);
  background-color: var(--bg);
  border: 1px solid var(--border);
}

.modal-title {
  margin: 0 0 0.45rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
}

.modal-body {
  margin: 0 0 0.8rem;
  font-size: 0.8rem;
  line-height: 1.7;
  color: var(--text-secondary);
}
</style>
