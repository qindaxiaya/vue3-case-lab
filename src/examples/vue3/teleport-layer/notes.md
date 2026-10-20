# Teleport 弹层管理

## 1. 现象与场景

弹窗写在卡片里，一打开就被父级 `overflow: hidden` 裁掉一半；页面多个弹层各写 `z-index: 9999`，后打开的反而被盖住。

复现：取消勾选「Teleport 到 body」再打开，弹层被舞台边界裁剪；勾选后挂到 body 正常显示。

## 2. 原理

`Teleport` 把弹层的 DOM 挂到 `body`，彻底脱离父级的 overflow 裁剪和层叠上下文。挂过去后，`z-index` 没人统一管，需要维护一个递增计数器，保证「后打开的在上层」。

同一时刻多个 Teleport 到 body 会按源码顺序追加；需要控制顺序时用不同锚点元素。`scoped` 样式依然生效，Vue 会把 `data-v` 属性传给传送节点。

## 3. 关键代码

```vue
<script setup lang="ts">
let z = 1000
// 1. 所有弹层从同一计数器领取层级
function nextZ(): number { z += 10; return z }
const modalZ = ref(0)
function open(): void {
  modalZ.value = nextZ() // 后开的永远在上
  show.value = true
}
</script>

<template>
  <!-- 2. 挂到 body，脱离 overflow / transform 限制 -->
  <Teleport to="body">
    <div v-if="show" class="modal-mask" :style="{ zIndex: modalZ }" @click.self="show = false">
      <div class="modal-card"><slot /></div>
    </div>
  </Teleport>
</template>
```

## 4. 数据对比

| 指标 | 留在原位 | Teleport 到 body |
|---|---|---|
| 父级 overflow 裁剪 | 会被裁 | 不受影响 |
| z-index 管理 | 各写各的 | 统一计数器（1000 起，步长 10） |
| 层叠顺序 | 容易错 | 后开在上 |
| scoped 样式 | 正常 | 正常（data-v 随节点） |

测量方式：Chrome headless 1200×900 在 `overflow: hidden` 舞台中打开弹层，对比勾选/取消 Teleport 的显示；连续打开模态框与气泡卡观察层级。计数器参数来自 Demo。

## 5. 追问与边界

**Q：Teleport 后 CSS 选择器还能用吗？**
`scoped` 样式仍生效；`:deep()` 从原父级选不中，因为节点已不在原 DOM 子树，样式写在自身组件内。

**Q：多个弹层顺序怎么控？**
统一 z-index 计数器是最简单的；需要严格 DOM 顺序时用不同 `to` 锚点。

**Q：移动端弹层要注意什么？**
滚动锁、焦点陷阱、安全区；iOS 上 `overflow: hidden` 可能无效，需要 `position: fixed` 方案。

坑：Teleport 内容里 `position: fixed` 挂 body 后相对视口，留原位且父级有 transform 时会相对父级，布局会跳。边界：真实项目优先用 reka-ui/radix-vue 的 Dialog，自己处理焦点与动画成本高。
