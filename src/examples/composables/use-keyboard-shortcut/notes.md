# useKeyboardShortcuts：把快捷键表交给一个监听器

> 旧写法一个快捷键挂一个 keydown，各自判断继续往后走；新写法把「键位表 → 回调」交给组合式函数，一个监听器统一分发。

## 1. 现象 / 场景

页面功能一多，快捷键就开始互相打架：用户在搜索框里打 `/`，字符没出来，倒是触发了「聚焦搜索」；按 Esc 想清空输入，结果把刚打开的快速跳转关了。更隐蔽的是修饰键——想加 `Alt+K`，上线后用户按 `Alt+Shift+K` 也弹面板，因为手写只判了 `altKey`。

复现步骤：

1. 打开案例，默认是手写监听，面板显示窗口上挂着 3 个监听器；
2. 点输入框打一个 `/`：字符打不出来，左边「输入框内误触发」+1；
3. 按 `Alt+Shift+K`：快速跳转照样弹出，命中数 +1（手写只判了 `altKey`）；
4. 切到 `useKeyboardShortcuts`：监听器变 1 个，同样的按键一个误触发都没有，输入框里 `/` 能正常打出来。

## 2. 原理

`keydown` 挂在 `window` 上是全局的：浏览器不会因为焦点在输入框里就不派发，事件照样冒泡到 window。所以「这里该不该响应」必须由代码自己判断，而手写版通常只判断了「按了哪个键」。

判断至少要覆盖三层。第一层是修饰键全等：`Alt+K` 要求 `altKey === true` 且 `shiftKey / ctrlKey / metaKey` 都是 false，只判 `altKey` 会把 `Alt+Shift+K` 一起收下。第二层是焦点：目标元素是 `input` / `textarea` / `select` 或带 `contenteditable` 时，没有修饰键的按键（`/`、字母、Esc 之外的功能键）属于打字，应当直接return，连 `preventDefault` 都不能调——调了字符就进不去。第三层是默认行为：命中之后才 `preventDefault`，否则「没命中也把页面滚动了」这种副作用会到处出现。

一个监听器分发还能顺带解决「多个功能都想 `preventDefault`」的问题：键位表是唯一的真相，同一时刻只会命中一条，不会出现三个回调同时执行、各自改状态的情况。清理也收在一处：`onScopeDispose` 保证组件卸载和 `effectScope.stop()` 都会解绑，不用记「我挂过几个监听器、用的哪个函数引用」。

## 3. 方案：关键代码

```ts
export function useKeyboardShortcuts(map: ShortcutMap, options: ShortcutOptions = {}) {
  const entries = Object.entries(map).map(([binding, handler]) => ({
    binding,
    parsed: parseBinding(binding),
    handler,
  }))

  function onKeydown(event: KeyboardEvent): void {
    const typing = isEditable(event.target)
    const pressed = {
      key: event.key.toLowerCase(),
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey,
    }

    for (const { binding, parsed, handler } of entries) {
      if (pressed.key !== parsed.key) continue
      // 修饰键必须完全一致，Alt+Shift+K 不能冒充 Alt+K
      if (pressed.ctrl !== parsed.ctrl || pressed.meta !== parsed.meta) continue
      if (pressed.alt !== parsed.alt || pressed.shift !== parsed.shift) continue

      const bypassTyping = parsed.ctrl || parsed.meta || parsed.alt || parsed.key === 'escape'
      // 让路时不 preventDefault，字符才能打进输入框
      if (typing && !bypassTyping && !options.enableOnInput) {
        ignored.value++
        options.onIgnored?.(binding)
        return
      }

      event.preventDefault()
      hits.value++
      handler(event)
      return
    }
  }

  function start(): void {
    if (attached.value) return
    window.addEventListener('keydown', onKeydown)
    attached.value = true
  }

  start()
  onScopeDispose(stop) // 组件卸载 / effectScope.stop() 都会解绑
  return { attached, hits, ignored, start, stop }
}
```

三处为什么：

1. **键位在注册时解析成 `{ key, ctrl, meta, alt, shift }`**：每次按键只做对象比对，不再 `split('+')`；键位表是静态的，没必要在热路径上重复解析字符串。
2. **修饰键逐个 `!==` 比对**：`if (event.altKey)` 这种写法会把 `Alt+Shift+K`、`Alt+Ctrl+K` 全部收下；「不按的修饰键也必须是 false」才是快捷键的语义。
3. **输入框里 `return` 而不是 `preventDefault`**：少这一个字符就白改了——`preventDefault` 会拦住字符输入，用户在输入框里打 `/` 永远打不出来，而这正是手写版最典型的 bug。

## 4. 数据对比

| 指标 | 手写监听 | useKeyboardShortcuts | 测量方式 |
|------|----------|----------------------|----------|
| 窗口上的 keydown 监听器 | 3 | 1 | 面板「当前 window 监听器」 |
| `Alt+K` 命中 | 1 | 1 | 真实按键后读面板「命中次数」 |
| `Alt+Shift+K` 命中 | 2（误触发 +1） | 1（不变） | 同上，按住 Shift 再按一次 |
| 输入框内按 `/` 的命中 | 4（误触发 +1） | 2（不变） | 焦点在输入框时真实按 `/` |
| 输入框内按 `/` 是否有字符 | 否（被 `preventDefault` 吞掉） | 是 | 读输入框 `value` |
| 输入框内被正确忽略的次数 | 0 | 1 | 面板「输入框内正确忽略」 |
| 切走实现后的监听器 | 0（切模式时解绑） | 0 | 面板两列监听器数 |

测量说明：

- 环境：headless Chrome（`npm run check:ui -- --only 快捷键`），用 CDP 派发真实键盘事件（`rawKeyDown` + `char` + `keyUp`），不是页面内合成的 `KeyboardEvent`——合成事件不会插入字符，验证不出「`/` 到底能不能打出来」。
- 修饰键用 CDP 的位掩码：`Alt` = 1、`Shift` = 8，所以 `Alt+K` 是 1、`Alt+Shift+K` 是 9。
- 两边轮流生效，切换模式时另一套监听器会被摘掉，所以「命中次数」各自累加、互不干扰。
- 本案例的收益是「误触发次数」和「监听器个数」，不是渲染耗时，因此没有比较毫秒数。

## 5. 追问与边界（面试高频）

**Q：只在最外层挂一个 keydown，会不会影响输入框的输入法？**
不会，`keydown` 在输入法组字阶段通常给的是 `key === 'Process'` 或 `229`，比对不到具体键位；真正要小心的是不要对没命中的键调 `preventDefault`，否则连输入法候选框的按键都会被吞。

**Q：为什么要区分「有没有修饰键」才决定让路？**
没有修饰键的按键在输入框里就是文字（`/`、`k`、数字），让路是唯一正确选择；带 `Ctrl` / `Alt` / `Meta` 的组合在输入框里仍然有意义（`Ctrl+K` 打开搜索），所以照样生效。`Esc` 是例外：它不产生字符、是「退出」语义，在输入框里也该能关掉浮层。

**Q：和直接用 `@keydown` 绑在元素上有什么区别？**
绑在元素上只在元素有焦点时生效，适合「在这个输入框里按回车提交」；全局快捷键必须挂 `window`，否则用户点过别处就失效。两者不冲突：局部按键交给模板事件，全局的交给这个封装。

**Q：多个组件都用这个封装，监听器会不会又变多？**
会，每个调用点一个监听器。要彻底收成一个，就把键位表放到一个全局的快捷键中心（注册表 + 一个监听器），封装里再包一层注册/注销；代价是要处理「同一个键被两个组件注册」的优先级，通常按注册顺序或显式权重。多数项目三五个快捷键，一个调用点一张表就够了。

**Q：服务端渲染怎么办？**
封装在 `start()` 里才访问 `window`，挂载前不会执行；如果要在 `setup` 里立即注册，记得先判断 `typeof window !== 'undefined'`，或者干脆放到 `onMounted`。

踩坑：

1. **只判 `event.altKey` 不判其它修饰键** → `Alt+Shift+K` 被当成 `Alt+K`，面板莫名弹出 → 修饰键逐个全等比对。
2. **输入框里也 `preventDefault`** → 用户在输入框里打 `/` 打不出来，还会被记成一次命中 → 命中前先判断焦点，让路时直接 `return`。
3. **监听器挂在 `window` 上却忘了解绑** → 路由来回切几次，旧页面的快捷键还在响应，甚至报错「操作已卸载组件」→ 用 `onScopeDispose` 统一收口，并对外暴露 `stop()`。

边界：浏览器保留的组合（`Ctrl+W`、`Ctrl+T`、`Cmd+Tab` 等）页面收不到，别把核心功能只挂在那种键上；需要「按住连发」的场景（游戏、长按加速）不适合用快捷键表，应该自己监听 `keydown` / `keyup` 并维护按下的集合；同一键位被多个功能注册时，本封装按表内顺序取第一条命中，复杂项目应当显式定义优先级。
