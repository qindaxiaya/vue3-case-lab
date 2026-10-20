# 自定义指令三件套

## 1. 现象与场景

按钮权限每个组件都写 `v-if="role === 'admin'"`，改规则要全项目搜；图片懒加载在每个页面都手写一遍 IntersectionObserver；下拉点外部关闭，每个弹层都复制一份监听。

复现：切换 admin / editor / guest，按钮按权限显示；滚动图片区，已加载数从 2/12 增加；打开下拉点外部关闭。

## 2. 原理

指令把「直接操作 DOM」的逻辑封装成可复用单元：`mounted` 首次应用，`updated` 在绑定值或组件重渲染时重新应用，`unmounted` 清理观察器/事件。

三个典型场景：`v-permission` 用 `display` 控制显隐（不销毁元素）；`v-lazy` 用 IntersectionObserver，加载后立即 disconnect；`v-click-outside` 用 `el.contains(e.target)` 判断内外，并在捕获阶段监听防止被内部 `stopPropagation` 破坏。

## 3. 关键代码

```ts
const vPermission: Directive<HTMLElement, string[]> = {
  mounted(el, binding) { apply(el, binding.value) },
  // 1. 绑定值变化 / 组件重渲染时重新应用
  updated(el, binding) { apply(el, binding.value) },
}
function apply(el: HTMLElement, allowed: string[]): void {
  el.style.display = allowed.includes(currentRole.value) ? '' : 'none'
}

const vClickOutside: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    const handler = (e: PointerEvent) => {
      // 2. contains 含子节点，点在面板内部不关闭
      if (!el.contains(e.target as Node)) binding.value()
    }
    handlerMap.set(el, handler)
    // 3. 捕获阶段监听，内部 stopPropagation 也拦不住
    document.addEventListener('pointerdown', handler, true)
  },
  unmounted(el) {
    const handler = handlerMap.get(el)
    if (handler) document.removeEventListener('pointerdown', handler, true)
    handlerMap.delete(el)
  },
}
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 权限角色 | admin / editor / guest |
| 可见按钮 | admin 3 个、editor 2 个、guest 1 个 |
| 图片懒加载 | 首屏已加载 2 / 12 |
| 外部点击计数 | 0 → 1（点内部不变） |
| 指令数量 | 3（权限 / 懒加载 / 点外部） |

测量方式：Chrome headless 1200×900 切换角色、滚动图片区、打开下拉点内外，读取按钮显隐、已加载数与外部点击计数；数值来自 Demo 面板。

## 5. 追问与边界

**Q：指令和组件怎么选？**
只操作 DOM、无模板结构用指令；有复杂状态与多节点结构写组件/组合式函数。

**Q：为什么 `updated` 里要重复 apply？**
指令的 `mounted` 只跑一次；角色或绑定值变化后需要重新计算显隐。

**Q：`v-permission` 安全吗？**
只控制「看不看得到」，接口必须二次校验；前端权限可被绕过。

坑：`<script setup>` 里局部指令必须命名 `vXxx`，模板写 `v-xxx`。边界：指令不适合承载一堆状态；SSR 下 `mounted` 才执行，别在 setup 阶段依赖 DOM。
