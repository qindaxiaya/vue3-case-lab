# Teleport 弹层工程化

## 1. 现象与场景

自己写的弹窗挂到 body 后：背景还能滚，按 Esc 没反应，Tab 焦点跑到弹窗后面，关闭后焦点不知道丢哪了。

复现：打开弹窗，背景滚动被锁；按 Esc 关闭；Tab 在弹窗内循环；关闭后焦点回到触发按钮。

## 2. 原理

挂 body 只解决「不被裁剪」。一个能用的弹窗还要：打开时锁住页面滚动、Esc 关闭、焦点困在弹窗内循环、关闭后焦点归还触发元素。

滚动锁要记录 `body` 原来的 `overflow`，关闭时还原，不能直接写空串。焦点循环监听 Tab：在最后一个可聚焦元素按 Tab 回到第一个，在第一个按 Shift+Tab 去最后一个。事件监听用 `watch(open)` 动态绑定，不要全站常驻。

## 3. 关键代码

```ts
function openModal(): void {
  // 1. 记录原值，关闭时还原（别直接写 ''）
  prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  prevActive = document.activeElement as HTMLElement
  open.value = true
  nextTick(() => modalEl.value?.querySelector<HTMLElement>(FOCUSABLE)?.focus())
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') return closeModal()
  if (e.key !== 'Tab') return
  const list = Array.from(modalEl.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
  const first = list[0], last = list[list.length - 1]
  // 2. Tab 到底回开头，Shift+Tab 到顶去结尾
  if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
}

function closeWithFocus(): void {
  open.value = false
  // 3. 焦点还给触发按钮，键盘用户才知道回到哪
  ;(triggerEl.value ?? prevActive)?.focus()
}
```

## 4. 数据对比

| 指标 | 只 Teleport | 工程化补齐 |
|---|---|---|
| 背景滚动 | 可滚 | 锁死，关闭还原 |
| Esc 关闭 | 无 | 有 |
| Tab 焦点 | 跑到弹窗外 | 弹窗内循环 |
| 关闭后焦点 | 丢失 | 归还触发按钮 |
| 打开次数统计 | — | 0 起步，每次 +1 |

测量方式：Chrome headless 1200×900 打开弹窗，滚动背景、按 Tab/Esc、关闭后检查 `document.activeElement`；滚动锁通过 `body.style.overflow` 读取。次数来自 Demo 面板。

## 5. 追问与边界

**Q：为什么不能直接 `body.style.overflow = ''`？**
页面或其他组件可能已经设了 `hidden`，直接清空会破坏别人的状态；必须记录再还原。

**Q：焦点陷阱为什么要用 `nextTick`？**
弹窗 DOM 在 `v-if` 打开后才挂载，立刻 `querySelector` 拿到 null；等 DOM 更新后再聚焦。

**Q：iOS 滚动锁失效怎么办？**
iOS 对 `overflow: hidden` 支持不完整，需要 `position: fixed` + 记录 `scrollTop`，关闭时恢复。

坑：事件监听无条件挂 document，全站键盘事件都变慢；用 `watch(open)` 开关。边界：多层弹窗、拖拽、动画复杂时直接用 reka-ui/radix-vue 的 Dialog，别重复造。
