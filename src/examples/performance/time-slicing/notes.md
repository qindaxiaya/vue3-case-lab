# 长列表时间切片

## 1. 现象 / 场景

报表页一次渲染 3 万行，打开先白屏，渲染期间点按钮没反应，用户以为页面卡死。

复现步骤：

1. 打开案例，默认数据量 3 万、每批 300 条。
2. 点「一次性全量」，记录首帧、最大阻塞与总耗时；渲染期间点「测主线程响应」，按钮点不动。
3. 点「时间切片」，重复同一组参数；切片过程中连续点「测主线程响应」，记录点击响应。
4. 把数据量切到 1 万 / 5 万，或把每批切到 100 / 1000，观察批次数与最大阻塞的变化。参数改变会清空对比结果，避免拿不同规模的数据硬比。

## 2. 原理

Vue 侧：`rows.value = 三万条` 只触发一次更新，但 renderer 会在同一个宏任务里同步创建三万个 vnode 和真实 DOM。任务不结束，浏览器就没有机会插入渲染帧，也没机会处理输入事件。

浏览器侧：主线程的事件循环是「一个任务做完再做下一个」。超过 50ms 的任务就是长任务，期间布局、绘制、点击回调全部排队；用户看到的就是白屏和「点不动」。

切片把一次长任务拆成很多短任务：每帧只 push 一批，然后 `await nextTick()` 等这一批 DOM 更新完成，再通过 `requestAnimationFrame` 主动交还主线程。浏览器在两帧之间完成绘制和输入处理。代价是总耗时变长（每帧都有调度与重复渲染开销），换来的是首帧更快、页面始终能响应。

`nextTick` 是微任务，仍在当前宏任务里清空，不能真正让出主线程；要分片必须用 rAF、`setTimeout` 或 `requestIdleCallback`。案例用双 rAF 采首帧：第一次 rAF 表示这一帧要开始，第二次 rAF 表示上一帧已经绘制完成，此时再读时间更接近「用户真正看到内容」的时刻。

## 3. 方案：关键代码

```ts
async function renderFull(): Promise<void> {
  const t0 = performance.now()
  rows.value = makeRows(totalCount.value, 0) //! 一次创建几万个 vnode
  await nextTick() // 等 DOM 真正挂载完
  const block = performance.now() - t0 // 主线程被占住的时长
  maxBlockMs.value = block

  await nextFrame() //! 双 rAF：等一次真正的绘制再记首帧
  firstPaintMs.value = performance.now() - t0
  totalMs.value = block
}

function renderSlice(): void {
  let produced = 0
  const step = async (): Promise<void> => {
    //! 每批单独计时：push + nextTick 里的 DOM 更新就是这一批占住主线程的时间
    const batchStart = performance.now()
    const batch = makeRows(Math.min(batchSize.value, totalCount.value - produced), produced)
    rows.value.push(...batch)
    produced += batch.length
    frames.value++

    await nextTick()
    const block = performance.now() - batchStart
    maxBlockMs.value = Math.max(maxBlockMs.value ?? 0, block)

    if (firstPaintMs.value === null) {
      await nextFrame() // 第一批渲染完再等绘制
      firstPaintMs.value = performance.now() - t0
    }

    //! 只处理一批就交还主线程：浏览器有机会渲染、响应点击
    if (produced < totalCount.value) requestAnimationFrame(step)
    else totalMs.value = performance.now() - t0
  }

  requestAnimationFrame(step)
}
```

点击响应用 `event.timeStamp`，而不是处理函数里的 `performance.now()`：

```ts
function ping(event: MouseEvent): void {
  // 主线程被长任务占住时，处理函数本身就会晚执行；
  // 从 event.timeStamp 起算才能把「排队等待」算进去。
  const start = event.timeStamp > 0 ? event.timeStamp : performance.now()
  setTimeout(() => {
    clickLatency.value = Math.round(performance.now() - start)
  }, 0)
}
```

## 4. 数据对比

下表是 `check:ui` 巡检用固定参数（1 万条 / 每批 1000）跑出的两次结果区间，方便复现；默认 3 万 / 300 的数值随机器变化，Demo 面板会实时显示。

| 指标 | 一次性全量 | 时间切片 | 怎么看 |
|------|------------|----------|--------|
| 数据量 | 10,000 条 | 10,000 条 | 同一组参数才可比 |
| 首帧 | 279~378ms | 85~106ms | 第一帧出现的时间 |
| 最大阻塞 | 99~125ms | 20~32ms | 单个任务占住主线程的时长 |
| 总耗时 | 99~125ms | 426~586ms | 全部挂载完成 |
| 批次数 | 1 次全量 | 10 | 切片每批一帧 |
| 点击响应 | — | 0~38ms | 全量渲染期间按钮点不到；切片可在渲染中测量 |

测量说明：

- 首帧用 `nextTick` + 双 rAF 采样，所以「首帧」会比「最大阻塞」大：阻塞结束后还要等浏览器真正绘制。
- 最大阻塞按每批 `push + nextTick` 计时，反映的是单个任务占住主线程的时长，而不是总耗时。
- 点击响应用 `event.timeStamp` 起算，再用 `setTimeout(0)` 测主线程什么时候能回来；全量渲染期间主线程被占，按钮点不动，所以全量一列是「—」。
- 环境：Chrome / Edge 现代版本，headless 巡检，未开 CPU 节流；不同机器、不同数据量会有差异，以 Demo 面板实测为准。

## 5. 追问与边界

**Q：切片后总耗时反而更长，为什么还说它更好？**
切片的目标不是「更快渲染完」，而是「不阻塞交互」。全量 99~125ms 内页面完全没响应；切片 426~586ms 里每批只占 20~32ms，用户能滚动、能点按钮，首帧也提前到 85~106ms。

**Q：为什么每批 1000 条时最大阻塞还有 20~32ms？**
一批里仍然要创建 1000 个 vnode + DOM，批次越大单次阻塞越长。调小每批能降低阻塞，但批次数和总耗时都会增加，需要按页面实际体验折中。

**Q：nextTick 为什么不能替代 rAF？**
nextTick 是微任务，仍在当前宏任务里清空；它只保证 DOM 更新完成，不会把主线程交还给浏览器。要分片必须用 rAF、setTimeout 或 requestIdleCallback。

**Q：全量渲染时为什么点不到「测主线程响应」？**
点击事件已经发生，但主线程被长任务占着，处理函数和计时器都排在后面，直到任务结束才有机会执行。切片把长任务切碎，点击就能在两批之间得到处理。

**Q：什么时候用时间切片，什么时候用虚拟滚动？**
只需要展示可见区域时优先虚拟滚动，DOM 数量直接降下来；确实要一次展示、导出或统计全部数据时，再用时间切片。切片只是让页面别卡死，页面元素该多还是多。

踩坑：

1. 用 `nextTick` 或 `Promise.then` 做分片 → 仍是微任务，主线程没让出 → 换 rAF / setTimeout。
2. 只测总耗时，不测最大阻塞 → 看不出单批是否仍然卡顿 → 每批单独计时。
3. 首帧在 push 后立刻读 → 读到的是数据进内存的时间，不是用户看到画面的时间 → nextTick + 双 rAF。
4. 点击响应用处理函数里的 `performance.now()` 起算 → 漏掉排队等待 → 用 `event.timeStamp`。
5. 重复运行 / 卸载不取消 rAF → 旧批次继续追加 → 运行令牌 + 取消 rAF。
6. 参数改了还拿旧结果对比 → 数据量不同，结论失真 → 参数变化时清空对比结果。

边界：本案例演示的是浏览器主线程分片，不解决内存占用与 DOM 数量；数据量继续增大时，虚拟滚动或服务端分页仍是首选。Node.js 环境下没有 rAF，需换成 `setImmediate` 等调度方式。
