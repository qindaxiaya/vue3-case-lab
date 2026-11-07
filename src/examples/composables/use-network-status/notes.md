# useNetworkStatus：在线状态要订阅全

> `navigator.onLine` 只回答「有没有网」，网速、延迟、省流模式在 `navigator.connection` 里；封装把两类事件一起订阅，并在作用域销毁时统一解绑。

## 1. 现象 / 场景

页面顶部显示「在线 · 4G」。用户从 Wi-Fi 走到地铁，网络切到 3G，状态栏仍然写着 4G；点开省流模式，页面也没有任何反应。

复现步骤：

1. 打开案例，左边「手写版」和右边「封装版」初始都是 4G；
2. 点「3G」：右边制式、下行、延迟都变了，左边还停在 4G，并标出「连接信息已过期」；
3. 关掉「在线」开关：两边都变成离线，但只有左边累计「在线状态更新」；
4. 打开「省流模式」：只有右边跟着变；
5. 点「重置」：两边回到 4G / 在线 / 省流关闭。

## 2. 原理

浏览器提供两组信息：

- `navigator.onLine`：布尔值，表示「有没有网络接口」。它不保证真的能访问外网（连上需要登录的 Wi-Fi 时也可能为 `true`）。
- `navigator.connection`（Network Information API）：包含 `effectiveType`（`4g` / `3g` / `2g` / `slow-2g`）、`downlink`（Mbps）、`rtt`（ms）、`saveData` 等字段。

事件也分两类：

- `window` 的 `online` / `offline`：只反映「在线 / 离线」切换；
- `connection` 的 `change`：制式、下行、延迟、省流模式变化时触发。

只监听 `online` / `offline` 会漏掉第二类变化，所以连接信息会停在首次读取的值。封装要同时订阅两类事件，并在卸载时把监听器全部移除。

## 3. 方案：关键代码

```ts
interface NetworkSnapshot {
  online: boolean
  effectiveType: string
  downlink: number
  rtt: number
  saveData: boolean
  supported: boolean
}

interface NetworkSource {
  read: () => NetworkSnapshot
  subscribe: (onChange: () => void) => () => void
}

function browserNetworkSource(): NetworkSource {
  const nav = navigator as NavigatorWithConnection
  const connection = nav.connection

  return {
    read: () => ({
      online: nav.onLine,
      effectiveType: connection?.effectiveType ?? 'unknown',
      downlink: connection?.downlink ?? 0,
      rtt: connection?.rtt ?? 0,
      saveData: connection?.saveData ?? false,
      supported: Boolean(connection),
    }),
    subscribe(onChange) {
      //! online/offline 只说明「有没有网」，连接类型变化要靠 connection.change
      window.addEventListener('online', onChange)
      window.addEventListener('offline', onChange)
      connection?.addEventListener('change', onChange)

      return () => {
        window.removeEventListener('online', onChange)
        window.removeEventListener('offline', onChange)
        connection?.removeEventListener('change', onChange)
      }
    },
  }
}

function useNetworkStatus(source: NetworkSource = browserNetworkSource()) {
  const state = reactive<NetworkSnapshot>(source.read())
  const changes = ref(0)

  function refresh(): void {
    Object.assign(state, source.read())
    changes.value++
  }

  function reset(): void {
    Object.assign(state, source.read())
    changes.value = 0
  }

  //! 订阅在 setup 同步注册，避免首帧之后才补上监听
  const stop = source.subscribe(refresh)

  //! 组件卸载 / effectScope.stop() 都会走到这里
  onScopeDispose(stop)

  return { state, changes, refresh, reset }
}
```

三处为什么：

1. **先 `read()` 再 `subscribe()`**：初始值同步，首帧就显示正确的在线状态和制式，不会先闪一下默认值。
2. **`subscribe` 返回清理函数**：把「注册了哪些监听」收在数据源内部，调用方只负责在 `onScopeDispose` 里执行一次，不会漏掉 `connection` 的监听。
3. **`source` 可注入**：真实环境用 `browserNetworkSource()`，测试和演示传入模拟源，这样「连接类型变化」可以稳定复现，不依赖开发者的真实网络。

## 4. 数据对比

| 操作 | 手写版（只监听 online / offline） | useNetworkStatus | 测量方式 |
|------|-----------------------------------|------------------|----------|
| 初始制式 | 4G | 4G | 读面板 `data-stat="manual-type"` / `"auto-type"` |
| 切到 3G 后制式 | 4G（过期） | 3G | 点「3G」，等 150ms 再读 |
| 切到 3G 后下行 / 延迟 | 10 Mbps / 50 ms（首次值） | 1.5 Mbps / 300 ms | 同上，读「下行 / 延迟」 |
| 连接信息提示 | 「连接信息已过期」 | 「已订阅 change」 | 读 `data-stat="manual-stale"` |
| 关闭「在线」后 | 离线，在线状态更新 +1 | 离线，状态同步次数 +1 | 点开关，等 150ms 再读 |
| 打开「省流模式」后 | 关（没有更新） | 开 | 同上，读「省流」 |
| 状态同步次数（切 3G / 离线 / 省流） | 0 / 1 / 1 | 1 / 2 / 3 | 读 `data-stat="auto-changes"` / `"manual-updates"` |
| 重置后 | 4G / 在线 / 省流关 | 4G / 在线 / 省流关 | 点「重置」，等 200ms 再读 |

测量说明：

- 环境：headless Chrome（`npm run check:ui -- --only 网络状态`），1280px 视口；
- 演示用模拟源（`demoSource`）切换制式，避免依赖真实网络；「真实环境」面板单独读取 `navigator`，不受开关影响；
- 计数来自面板的 `data-stat`，不写死毫秒；不同浏览器对 `navigator.connection` 的支持不同，真实面板会显示「不支持」。

## 5. 追问与边界（面试高频）

**Q：`navigator.onLine` 为 true 就一定能请求成功吗？**
不一定。它只表示系统有网络接口，连上需要认证的 Wi-Fi、DNS 故障、代理拦截都可能让请求失败。真正的可用性要靠一次轻量请求或 `fetch` 的超时来判断。

**Q：为什么要支持注入 `source`？**
真实网络状态很难在测试和演示里稳定复现。把「读快照 / 订阅变化」抽成接口后，测试可以传一个可控的模拟源，组件代码不用改；这也是组合式函数常见的可测试性设计。

**Q：`navigator.connection` 兼容性怎么样？**
Chrome / Edge 支持较好，Safari 和 Firefox 的支持不完整。使用前要判断 `supported`，缺失时回退到 `unknown` / 0，不要假设字段一定存在。

**Q：监听器什么时候移除？**
组件卸载时。案例用 `onScopeDispose`，所以组件卸载和作用域停止都会解绑；如果只在 `onUnmounted` 里清理，脱离组件的作用域就不会执行。

踩坑：

1. **只监听 `online` / `offline`** → 4G 切 3G 不触发，连接信息一直是旧值 → 同时订阅 `connection` 的 `change`。
2. **初始值在 `onMounted` 才读** → 首帧显示默认值，随后闪一下 → 在 setup 同步 `read()`。
3. **订阅写在数据源外面** → 清理时容易漏掉 `connection` 的监听 → 让 `subscribe` 返回统一的清理函数。
4. **把 `onLine` 当成「能上网」** → 连上需要登录的 Wi-Fi 仍显示在线 → 关键请求自己判断超时 / 失败。

边界：网络状态适合做「提示和降级」（弱网少加载图片、离线显示缓存），不要用它精确测速；真正的带宽测试需要下载固定大小的资源。需要后台推送时用 SSE / WebSocket，不要靠轮询网络状态。
