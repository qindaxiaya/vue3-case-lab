# effectScope 批量停止副作用

## 1. 现象与场景

弹窗里创建了 10 个 watcher 和 10 个定时器，关闭后请求还在发、日志还在打；手动一个个 stop/clear，漏一个就一直泄漏。

复现：连点「挂载并卸载 1 轮」，不清理的存活数持续上涨；开 effectScope 的一侧 stop 后回落到 0。

## 2. 原理

组件卸载只会自动清理「组件内」创建的副作用；在函数、循环、弹窗逻辑里手动创建的 `watch`、定时器、事件监听，没人替你收尾。

`effectScope()` 创建一个作用域，`scope.run()` 内创建的 watcher/computed 都归它管；`scope.stop()` 一次全停。定时器、事件监听这类非响应式资源用 `onScopeDispose` 注册清理，stop 时一起执行。

## 3. 关键代码

```ts
const scope = effectScope()

scope.run(() => {
  // 1. run 内创建的 watcher 归 scope 管
  watch(source, () => {})

  const timer = setInterval(() => {}, 1000)
  // 2. 非响应式资源用 onScopeDispose 注册清理
  onScopeDispose(() => clearInterval(timer))
})

// 3. 一键停止：watcher 与 onScopeDispose 回调全部执行
scope.stop()
```

## 4. 数据对比

| 指标 | 不清理 | effectScope |
|---|---|---|
| 每轮创建 | 10 个 watch + 10 个定时器 | 1 个 scope |
| 卸载后存活 | 持续上涨 | stop 后 0 |
| 清理代码 | 手动逐个 stop/clear | 一次 `scope.stop()` |
| 漏清理风险 | 高 | 低 |

测量方式：Chrome headless 1200×900 连点「挂载并卸载 1 轮」，读取左右两侧存活数与「stop 前 / stop 后」计数；每轮 10+10 来自 Demo 配置。

## 5. 追问与边界

**Q：组件里的 `watch` 还需要 scope 吗？**
不需要。setup 内创建的副作用会自动绑定组件实例；scope 用于「非组件生命周期」或需要成组停止的场景。

**Q：`onScopeDispose` 写在 scope 外会怎样？**
找不到当前作用域，开发环境会警告且不会执行；必须在 `scope.run()` 内注册。

**Q：嵌套 scope 怎么算？**
默认子 scope 随父 scope 停止；`effectScope(true)` 创建 detached scope，需要手动 stop。

坑：组件 setup 里手动 `effectScope()` 不会自动随组件卸载停止，要自己 stop。边界：异步回调里创建 watcher 前先确认 scope 还活着；微前端子应用卸载、测试用例隔离都适合用 scope。
