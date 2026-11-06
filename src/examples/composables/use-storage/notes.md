# useStorage：让 localStorage 变成响应式状态

> 旧写法在初始化时读一次、在每个字段的修改处手写 `setItem`；新写法把读写收进一个组合式函数，改状态就自动落盘，读时先校验再填。

## 1. 现象 / 场景

用户把字号调到「大」、昵称改成自己的名字，刷新后全回到默认——因为只有初始化读了存储，改动时忘了写回去。更糟的是存储被手改坏之后：`JSON.parse` 抛错，页面每次进来都卡在同一个地方，用户只能清站点数据自救。

复现步骤：

1. 打开案例，点「清空存储」，再点「重新读取」，两边都是默认值；
2. 点「写入坏 JSON」把存储改成 `{oops`，再点「重新读取」：左边提示读取失败、存储里还是 `{oops`；右边回退默认值，并把存储改回合法 JSON；
3. 点「写入错类型」写进 `"size":"huge"` 与多余字段 `"theme"`，再读一次：左边把 `huge` 原样塞进界面、存储里留着无用字段；右边把字号回退「中」，存储里只剩三个合法字段。

## 2. 原理

`localStorage` 只能存字符串，也只会在被显式调用时读写：它不会通知任何组件，也没有类型概念。手写版因此有三个隐藏成本——初始化读一次之后状态就和存储脱钩；每个字段的修改处都要记得调 `setItem`，漏一处就是「界面变了、刷新丢掉」；读取时把存储内容当成可信输入，`JSON.parse` 出错就抛，类型不对就照样塞进界面。

封装的思路是把「状态」和「镜像」分开：`reactive` 对象是唯一真相，`watch` 负责在它变化后把快照写进存储。Vue 的 `watch` 回调默认在同一个 tick 内合并，连续改多个字段只会写一次，不用自己防抖。

读取侧要处理三种输入：存储为空（用默认值）、不是合法 JSON（捕获后回退默认值）、能解析但内容不可信（逐字段校验）。校验分两层——先按 `defaults` 的字段名做白名单，把旧版本残留的多余字段丢掉；再按类型比对。这里有个容易漏的点：`typeof` 只能挡住「数字塞进字符串字段」这种粗错，`'huge'` 的 `typeof` 同样是 `string`，联合类型必须自己补一个允许值列表。

最后一步是自愈：发现脏数据时不只「显示个错误」，而是把校验后的正确内容立刻写回。否则用户每次进来都要再失败一次，错误提示永远消不掉。这个顺序有个讲究——先 `read()` 再 `watch()`，否则初始化读出来的值会被当成一次用户改动，白白多写一次存储。

本案例没有演示跨标签页同步：`storage` 事件只在**其他**文档触发，同一页面里改存储自己是收不到的。真实项目要连同 `window.addEventListener('storage')` 一起封装，同时注意别的页面写入的也可能是脏数据。

## 3. 方案：关键代码

```ts
type FieldGuards<T> = { [K in keyof T]?: (value: unknown) => boolean }

export function useStorage<T extends Record<string, Primitive>>(
  key: string,
  defaults: T,
  guards?: FieldGuards<T>,
) {
  const state = reactive({ ...defaults }) as T
  const raw = ref('')
  const message = ref('')
  const writes = ref(0)

  function sanitize(input: unknown): T {
    const next = { ...defaults }
    if (!input || typeof input !== 'object') return next
    const source = input as Record<string, unknown>
    const target = next as Record<string, Primitive>
    for (const field of Object.keys(defaults)) {
      const value = source[field]
      const guard = guards?.[field as keyof T]
      const valid = guard ? guard(value) : typeof value === typeof defaults[field]
      if (valid) target[field] = value as Primitive
    }
    return next
  }

  function write(): void {
    localStorage.setItem(key, JSON.stringify(state))
    writes.value++
    raw.value = JSON.stringify(state)
  }

  function read(): void {
    raw.value = localStorage.getItem(key) ?? ''
    if (!raw.value) return
    let parsed: unknown
    try {
      parsed = JSON.parse(raw.value)
    } catch {
      Object.assign(state, defaults)
      write() // 坏 JSON 也要修：不修，用户下次进来继续失败
      return
    }
    const clean = sanitize(parsed)
    Object.assign(state, clean)
    if (JSON.stringify(clean) !== JSON.stringify(parsed)) write()
  }

  read()
  watch(state, write) // 先读后挂 watch，避免初始化读到的值被当成改动再写一次
  return { state, raw, message, writes, read, write }
}
```

三处为什么：

1. **`defaults` 同时当字段白名单和类型模板**：校验不需要另写一份结构描述，字段名、类型、默认值只维护一处；要更细的规则（联合类型、取值范围）再加 `guards`。
2. **`read()` 里 `catch` 之后仍然调用 `write()`**：这是「自愈」和「只提示错误」的分界线。存储里的坏数据不修掉，用户每次进来都要重新经历一次失败。
3. **`read()` 放在 `watch()` 之前**：`watch` 注册之后任何赋值都会触发写回；顺序反过来，初始化读到的值会被当成一次用户改动，多写一次存储，面板上的写入次数也会虚高。

## 4. 数据对比

| 指标 | 手写 getItem + Object.assign | useStorage 封装 | 测量方式 |
|------|------------------------------|-----------------|----------|
| 存储是坏 JSON 时的读取结果 | 提示「读取失败：存储不是合法 JSON（字段保持原值）」 | 提示「不是合法 JSON：已回退默认值，并把存储改回正确内容」 | `npm run check:ui -- --only 存储脏数据`，读面板提示文案 |
| 同上，读取后的存储原文 | 仍是 `{oops` | 变成合法 JSON（`JSON.parse` 可解析） | 同上，读面板「存储原文」 |
| 字段值非法（`"size":"huge"`） | 档位显示 `huge（不是合法选项）` | 档位回退 `中` | 同上，读面板「当前档位」 |
| 多余字段（`"theme"` / `"dark":"yes"`） | 原样留在存储里 | 丢弃并重写，存储里只剩三个合法字段 | 同上，检查存储原文不含 `theme` / `yes` |
| 手动 `setItem` 调用点 | 3 处（昵称 / 字号 / 开关各一处） | 0 处（`watch` 自动写） | 数 `Demo.vue` 里的调用点 |
| 连续改 3 次昵称的写入次数 | 3 | 3 | 面板「写入次数」增量 |
| 点「清空存储」之后 | 存储为空，界面保持默认 | 状态一改就落盘，存储随即被写回默认值 | 点「清空存储」，读面板「存储原文」 |

测量说明：

- 环境：headless Chrome（`npm run check:ui -- --only 存储脏数据`），同一页面内顺序执行「清空 → 连续输入 3 次 → 写入脏数据 → 重新读取」。
- 脏数据由案例的「写入坏 JSON」「写入错类型」按钮写进两个 key，保证两边读到的是同一份内容。
- 本案例的收益是「读取容错」与「调用点数量」，不是渲染耗时，所以没有比较毫秒数；两边的写入次数本来就该相同，差别在谁来负责调用。

## 5. 追问与边界（面试高频）

**Q：直接 `v-model` 绑一个 ref，再 `watch` 里 `setItem`，不封装行不行？**
行，单组件里这样最省事。封装的价值在读取侧：坏 JSON、类型不对、多余字段这三件事，每个用到存储的组件都得处理一遍，写进组合式函数才只需要处理一次。

**Q：校验为什么不直接上 zod / valibot？**
真实项目里推荐上，schema 描述比手写 `typeof` 更完整，也省掉 `guards` 这类参数。本案例手写是为了把「字段白名单 → 类型 → 允许值」三层拆开讲清楚，理解了这三层，换成任何 schema 库都能对上号。

**Q：大对象频繁写会不会卡？**
会。`localStorage.setItem` 是同步 API，写几 MB 的 JSON 会阻塞主线程。字段多、改动频繁时要节流，或者换成 IndexedDB（异步、容量大）。本案例只有三个字段，一次写入是几十字节。

**Q：跨标签页怎么同步？**
监听 `window.addEventListener('storage')`，里面拿 `event.key` 过滤自己关心的键，再套用同一套校验逻辑——别的标签页写进来的内容同样不可信。注意同文档内的写入不会触发这个事件，所以本案例没法在单页里演示。

**Q：为什么状态改了要整份写入，而不是只写变化的字段？**
整份写入最省心：不需要维护「哪些字段脏了」，也不会出现「某个字段的写入路径漏了」；代价是每次写整个 JSON。字段少、改动不频繁时这笔账是划算的。

踩坑：

1. **先 `watch` 再 `read`** → 初始化读出来的值被当成一次用户改动，白白多写一次存储，面板写入次数虚高 → 把 `read()` 放在 `watch()` 之前。
2. **只用 `typeof` 校验** → `'huge'` 也是 `string`，照样进界面，档位显示成「不是合法选项」，看着像界面 bug → 联合类型补 `guards` 白名单。
3. **`catch` 之后只提示、不写回** → 存储里一直是坏数据，用户每次进来都要再失败一次 → 回退默认值后立刻 `write()` 自愈。

边界：隐私模式与配额写满时 `setItem` 会抛错，本案例没有演示这条路径，真实项目要在 `write()` 里 `try/catch`，失败时至少把状态留在内存并提示「仅本次会话有效」；存储不可用（禁用 Cookie / 存储）时读取也要兜底。服务端渲染环境没有 `localStorage`，读取必须放在挂载之后或先判断 `typeof window`。跨标签页实时同步需要额外的 `storage` 事件封装，本案例只处理单页内的响应式持久化。
