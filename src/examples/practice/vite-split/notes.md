# Vite 代码分割

## 1. 现象与场景

项目打包后首屏要下 3MB JS，首页白屏好几秒；明明只改了一个页面，用户却要重新下载整个 bundle。

复现：在案例里勾选/取消不同模块，观察估算体积与首屏关键路径的变化。

## 2. 原理

代码分割的本质是「把不急着用的代码挪出首屏」。最有效的一刀是路由懒加载：`() => import()` 让组件独立成 chunk，首屏只加载当前路由。

vendor 拆分把 `vue`、`marked` 等第三方库按包分组，业务代码升级时库的 hash 不变，用户可继续用缓存。按需引入避免整包：`highlight.js` 全量语言包 1MB+，只注册用到的语言能省一个数量级。

Vite 8 底层换成了 Rolldown，分包写法跟着变：`output.manualChunks` 会被转成单个 `codeSplitting` 组，而且默认递归收编依赖，容易把 Vue 运行时卷进别的库。现在用 `codeSplitting.groups` + `priority`，优先级高的组先认领模块。

## 3. 关键代码

```ts
const routes = [
  // 1. 动态 import：当前路由才加载，独立 chunk
  { path: '/cases', component: () => import('./views/CasesView.vue') },
  { path: '/cases/:category/:id', component: () => import('./views/CasePage.vue') },
]

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // 2. Vite 8：按组拆 vendor，priority 高的先认领
        codeSplitting: {
          groups: [
            {
              name: 'vendor-vue',
              test: /node_modules[\\/](?:vue|vue-router|@vue)[\\/]/,
              priority: 100,
            },
            {
              name: 'vendor-markdown',
              test: /node_modules[\\/](?:highlight\.js[\\/]lib|marked)[\\/]/,
              priority: 50,
            },
          ],
        },
      },
    },
  },
})

// Vite 7 及以前（Rollup）仍可用 output.manualChunks：
// output: { manualChunks: { vue: ['vue', 'vue-router'] } }

// 3. 只注册需要的语言，避免整包 1MB+
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
hljs.registerLanguage('typescript', typescript)
```

三处为什么：动态 `import()` 决定「谁进首屏」；`codeSplitting.groups` 决定「第三方库怎么缓存」；按需注册语言决定「同一个库实际下载多少」。

## 4. 数据对比

下面是本项目 2026-10-27 的真实构建产物（`npm run build` + `npm run check:bundle`）：

| 产物 | 原始体积 | gzip | 加载时机 |
|---|---|---|---|
| 首屏合计（入口 + vendor-vue + runtime + 入口 CSS） | 316.1 KB | 108.9 KB | 首屏 |
| vendor-vue | 107.0 KB | 40.9 KB | 首屏（所有页面都依赖） |
| vendor-markdown（marked + highlight.js） | 65.9 KB | 21.5 KB | 详情页「深入」/ 源码 |
| vendor-element-plus | 94.1 KB | 31.8 KB | 只有 3 个用表单控件的案例 |
| pdf.js（按需） | 430.2 KB | 129.3 KB | 打开 PDF 预览案例 |

测量方式：`npm run build` 输出每个 chunk 的 raw / gzip；`npm run check:bundle` 读取 `dist/index.html` 的首屏资源并汇总，本次首屏 gzip 108.9 KB，预算 180 KB，357 个 JS chunk 全部通过单块 600 KB 预算（pdf/worker 按需加载，不参与单块预算）。对比 2026-10-21 改造前的首屏 gzip 521 KB，降幅 79.1%。

案例 Demo 里的 1180 KB 是**示意值**，用来讲清每种策略的方向和量级，不是本项目实测；真实数字以上表为准。

## 5. 追问与边界

**Q：chunk 越小越好吗？**
不是。小于 10KB 的 chunk 多一个请求反而更慢；拆得太碎会让瀑布请求链变长。

**Q：为什么改了业务代码，用户还要重下 vendor？**
没有拆 vendor，或分组规则写错，库和业务被打进同一个 chunk，hash 一起变。Vite 8 检查 `codeSplitting.groups` 的 `test` 是否真的命中 `node_modules`。

**Q：体积大就一定慢吗？**
不一定。看 gzip/brotli 后的传输体积与首屏关键路径；CDN、缓存命中率同样重要。

坑：Vite 8 继续写 `manualChunks` 会被 Rolldown 递归收编依赖，把首屏必需的模块卷进懒加载 chunk；分组 `test` 写死包名，库改名后失效，用 `node_modules` 路径正则更稳。边界：首屏马上要用的模块不要拆；CSS 也会跟随 chunk，注意 FOUC。
