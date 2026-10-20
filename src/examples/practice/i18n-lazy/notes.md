# i18n 语言包按需加载

## 1. 现象与场景

项目支持中/英/日，三种语言包全量打进首屏，用户只用一种却要下载另外两份；切换语言时整页闪一下。

复现：切换中文/English/日本語，观察首次加载耗时与缓存后的切换；点「立即体验」看模拟网络延迟。

## 2. 原理

静态 `import` 会把所有语言打进主 bundle；动态 `import()` 让每种语言独立成 chunk，用到才下载。首屏语言必须静态打包（否则首屏还要等一个 chunk），其余语言动态加载。

加载后用 `Map` 缓存，切来切去不重复请求。真实项目用 vue-i18n 的 `setLocaleMessage` 把新语言包注入，再切换 `locale`。动态 import 的路径必须是静态可分析的字符串，变量拼路径会导致无法分包。

## 3. 关键代码

```ts
import zh from './locales/zh' // 1. 首屏语言静态打包

const loaders = {
  // 2. 其余语言动态 import，独立 chunk
  en: () => import('./locales/en'),
  ja: () => import('./locales/ja'),
}

const cache = new Map([['zh', zh]])

async function loadLocale(lang: string) {
  const hit = cache.get(lang)
  // 3. 已加载过直接复用，避免重复请求
  if (hit) return hit
  const mod = await loaders[lang]()
  cache.set(lang, mod.default)
  return mod.default
}

// 首屏语言优先级：URL > localStorage > navigator.language > 默认
const lang = localStorage.getItem('locale') ?? navigator.language.split('-')[0] ?? 'zh'
```

## 4. 数据对比

| 指标 | 数值 |
|---|---|
| 语言数量 | 3（zh / en / ja） |
| 首屏内置 | zh（其它不下载） |
| en 包体积 | 0.4 KB |
| ja 包体积 | 101 B |
| 模拟网络延迟 | 600 ms |
| 二次切换 | 0 请求（Map 缓存命中） |

测量方式：Chrome headless 1200×900 打开案例，读取各语言包体积与模拟延迟；切换两次观察请求次数。体积来自 Demo 内置语言包，真实项目按文案量会大得多。

## 5. 追问与边界

**Q：为什么首屏语言不动态加载？**
首屏要立即显示文案，再等一个 chunk 会闪白/闪 key；静态打包首屏语言，其余按需。

**Q：语言包缺失 key 怎么办？**
用 `fallbackLocale` 回退，不要用深合并拼半个包；缺失 key 在开发环境要报出来。

**Q：切换语言后日期格式没变？**
`Intl.DateTimeFormat` 要显式传当前 locale；数字、货币同理。

坑：`import(\`./locales/${lang}\`)` 变量拼路径，Vite 无法静态分析，可能把所有文件打进一个 chunk。边界：SSR 要由服务端读 `Accept-Language`/cookie 决定首屏语言；小项目动态 import 足够，不必上编译期插件。
