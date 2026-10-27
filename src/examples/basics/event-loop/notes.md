# 宏任务与微任务执行顺序

## 1. 现象 / 场景

一句话：定时器、Promise、逐帧回调混在一起时，输出顺序和脑补的「先同步后异步」完全对不上。

复现：

1. 打开案例，默认勾选「入门三件套」：`setTimeout 0ms`、`Promise.then`、`queueMicrotask`。
2. 切到「直觉预期」：它按书写顺序列出「点击 → 定时器 → Promise → queueMicrotask」，这是常见但错误的排序。
3. 切到「真实输出」点「运行」：实际是「点击 → Promise.then → queueMicrotask → setTimeout 0ms」。
4. 勾选「主线程忙 200ms」再运行：点击回调先忙 200ms，忙完后微任务仍立刻执行，排在定时器前面。
5. 换「面试常考」或「渲染前」预设，或手动勾掉某个任务：直觉顺序会同步变化，不会留下没勾选的任务。

## 2. 原理

事件循环一轮的骨架：取一个宏任务（点击回调、定时器）执行 → 执行期间排入的同步代码跑完 → **立刻清空整个微任务队列**（Promise.then、queueMicrotask）→ 如果浏览器判断该渲染了，先跑逐帧回调再绘制 → 回到开头取下一个宏任务。

所以「微任务」不是排所有代码最后，而是插在「上一个宏任务刚结束、下一个宏任务还没开始」的缝隙里；「先同步后异步」直觉把微任务当成了普通异步任务，把它排到了定时器后面。`setTimeout(0)` 也不是立刻执行：规范里嵌套层级较深时最小间隔是 4ms，实际还会受排程开销影响，但无论多久都抢不过微任务。

慢任务（同步忙等）只占住当前宏任务。它会让「点击回调结束」这个时间点整体后移，但不会改变「宏任务结束后先清微任务」的规则，所以微任务仍然排在定时器前面。逐帧回调属于渲染前阶段，和定时器的相对位置取决于这一帧是否已经到绘制时机，不能写死成固定顺序。

## 3. 方案：关键代码

```ts
function run(): void {
  // 为什么用令牌：重复运行或清空后，上一轮没执行完的回调不能写进新日志
  const token = ++runToken
  const active = [...selected.value]
  push(token, 'macro-click', '用户点击回调（本次运行起点）')

  // 只排当前勾选的任务：预设和开关改的是同一份 selected
  if (active.includes('timer0')) {
    schedule(() => push(token, 'macro-timer', 'setTimeout 0ms 的回调'), 0)
  }
  if (active.includes('timer200')) {
    schedule(() => push(token, 'macro-timer', 'setTimeout 200ms 的回调'), 200)
  }
  if (active.includes('then')) {
    Promise.resolve().then(() => push(token, 'micro-then', 'Promise.then 微任务'))
  }
  if (active.includes('micro')) {
    queueMicrotask(() => push(token, 'micro-qm', 'queueMicrotask 微任务'))
  }
  if (active.includes('raf')) {
    rafId = requestAnimationFrame(() => push(token, 'frame-raf', '渲染一帧前的逐帧回调'))
  }

  // 慢任务放在排程之后：证明它只拖住当前宏任务
  if (active.includes('slow')) {
    push(token, 'sync-busy', '主线程忙 200ms（同步代码）')
    busyWait(200)
  }
}

// 直觉预期按「书写顺序」动态生成，只包含当前勾选的任务
const expectLines = computed(() => {
  const lines = [{ name: '用户点击回调（先同步执行）', kind: 'macro-click' }]
  if (selected.value.includes('slow')) {
    lines.push({ name: '主线程忙 200ms（同步代码）', kind: 'sync-busy' })
  }
  if (selected.value.includes('timer0')) {
    lines.push({ name: 'setTimeout 0ms 的回调', kind: 'macro-timer' })
  }
  // …Promise.then、queueMicrotask、rAF 按书写顺序继续追加
  return lines
})
```

预设只是替用户勾选一组任务，不是另一套执行逻辑；真正排队的仍然是 `run()` 里那几个判断。每次运行前会取消上一轮登记的定时器与 rAF，避免日志串台。

## 4. 数据对比

| 指标 | 直觉预期 | 真实输出（实测） | 测量方式 |
|------|----------|------------------|----------|
| 微任务位置 | 排在定时器后 | 点击回调后的第 2、3 位 | 日志行号 |
| `setTimeout 0ms` | 第 2 位 | 微任务之后，1~5ms 区间 | `performance.now()` 相对起点 |
| 慢任务后的微任务 | 被拖到所有任务最后 | 忙完后立刻执行，仍在定时器前 | 勾选慢任务后看日志 |
| 逐帧回调 | 固定最后 | 下一帧渲染前，位置随帧时机变化 | 本机日志 |
| 任务开关 | 不参与 | 只打印勾选的任务 | 勾掉任务后行数减少 |

测量说明：

- 环境：Chrome / Edge 现代版本，桌面端，未开 CPU 节流；rAF 与 `setTimeout 0ms` 的相对位置逐机略有差异，**以 Demo 面板实测的时间戳为准**。
- 取样：每点一次「运行」为一次完整测量；时间戳取相对起点。
- `check:ui` 的「事件循环任务开关」场景会固定验证：直觉顺序是「点击 → 定时器 → Promise」，真实顺序是「点击 → Promise → queueMicrotask → 定时器」；关掉定时器与 queueMicrotask 后只剩两行；慢任务后微任务仍排在定时器前。

## 5. 追问与边界

**Q：为什么直觉顺序要动态生成，不能写死？**
写死会把没勾选的任务也列出来，用户关掉定时器后对照就失真了。动态生成只列当前勾选的任务，才能保证「预期」和「真实」比的是同一组任务。

**Q：微任务里再排微任务会怎样？**
当前宏任务结束后队列会一直清，微任务生微任务会让本轮循环「清不完」，页面卡住——不要在同一轮里无限 then 接 then。

**Q：setTimeout(fn, 0) 为什么不是 0ms？**
嵌套层级 ≥5 后最小间隔为 4ms（规范值），加上排程开销，实测 1~5ms；这个细节不如「微任务先于它」重要。

**Q：重复点「运行」为什么不会串台？**
每次运行都会让令牌自增，并取消上一轮登记的定时器与 rAF；旧回调即使被浏览器执行，也会因为令牌不匹配而放弃写日志。

**Q：什么时候用 rAF，什么时候用 setTimeout？**
要和绘制同频（进度条、跟随动画）用逐帧回调；只是「晚点再跑」的修补逻辑才用定时器。

踩坑：

1. 微任务里自己再生微任务 → 页面假死 → 加深度/次数上限。
2. 把密集计算写在 Promise.then 里以为「不阻塞」 → 依然阻塞 → 拆定时器切片。
3. 用 setTimeout 硬凑动画 → 与绘制不同频丢帧 → 换逐帧回调。
4. 重复运行不取消旧定时器 / rAF → 旧回调追加到新日志 → 用运行令牌与统一登记表解决。

边界：本案例演示的是浏览器事件循环；Node.js 有自己的循环细节（如阶段划分），以浏览器为准。直觉预期序列只是教学对照——它本来就无法在浏览器里按脑补顺序跑出来，这正是动态对照开关的价值。
