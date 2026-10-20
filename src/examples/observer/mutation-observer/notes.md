# MutationObserver DOM 变更监听

## 1. 现象与场景

第三方脚本往页面里塞广告节点、富文本编辑器改了内容但数据没同步；用 `setInterval` 轮询 DOM，既慢又费 CPU。

复现：打开案例，点「+ 增节点」三次，节点数从 3 变 6，日志一次出现 3 条新增记录。

## 2. 原理

`MutationObserver` 监听 DOM 树的增删、属性、文本变化，回调由浏览器在微任务队列中批量派发：同一轮事件循环里的多次变更会合并成 `records` 数组，天然防洪泛。

`observe` 的四个开关：`childList`（子节点增删）、`attributes`（属性）、`characterData`（文本）、`subtree`（是否深入后代）。`takeRecords()` 可以立即取走尚未派发的记录，用于清空面板前「静默清场」。

## 3. 关键代码

```ts
observer = new MutationObserver((records) => {
  for (const r of records) {
    // 1. records 是批量的：一次回调可能包含同一轮的多条变更
    r.addedNodes.forEach((n) => pushLog('增', n))
    r.removedNodes.forEach((n) => pushLog('删', n))
    if (r.type === 'attributes') {
      // 2. attributeName 告诉你改的是哪个属性
      pushLog('属性', `${r.attributeName}=${(r.target as HTMLElement).getAttribute(r.attributeName!)}`)
    }
    if (r.type === 'characterData') pushLog('文本', r.target.nodeValue ?? '')
  }
})

observer.observe(el.value!, {
  childList: true,
  attributes: true,
  characterData: true,
  // 3. subtree 才会监听后代；不开只看直接子节点
  subtree: true,
})

function clearPanel(): void {
  // 清空前丢弃积压记录，避免一次性灌爆日志
  observer?.takeRecords()
  el.value!.innerHTML = ''
}
onUnmounted(() => observer?.disconnect())
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 初始节点数 | 3 |
| 连续点 3 次「+ 增节点」 | 3 → 6 |
| 回调次数 | 1 次（3 条 records 合并派发） |
| 清空重建 | 日志先清空，无积压回灌 |

测量方式：Chrome headless 1200×900，在同一轮脚本里连点 3 次，读取「节点数」与日志条数；三次变更在同一宏任务内完成，因此合并为一次回调。手动逐次点击会得到 3 次回调，这是批量语义的正常表现。

## 5. 追问与边界

**Q：能用它监听输入框 value 吗？**
不能。用户输入改变的是 `value` 属性（property），不触发 attributes；应监听 `input` 事件。

**Q：和 `watch` 有什么区别？**
`watch` 监听响应式数据，MutationObserver 监听真实 DOM；第三方脚本、浏览器插件改的 DOM 只有后者能感知。

**Q：拖拽排序时日志暴涨怎么办？**
高频变更会积压，用 `takeRecords()` 定期冲刷，或只记录 `childList` 并做节流。

坑：`subtree: true` + `attributes: true` 会收到整棵子树所有属性变化，范围要尽量收窄到目标容器。边界：不要用它替代数据驱动，Vue 能管理的 DOM 优先用响应式状态。
