# Vite 代码分割

## 1. 现象与场景

项目打包后首屏要下 3MB JS，首页白屏好几秒；明明只改了一个页面，用户却要重新下载整个 bundle。

复现：在案例里勾选/取消不同模块，观察估算体积与首屏关键路径的变化。

## 2. 原理

代码分割的本质是「把不急着用的代码挪出首屏」。最有效的一刀是路由懒加载：`() => import()` 让组件独立成 chunk，首屏只加载当前路由。

vendor 拆分把 `vue`、`marked` 等第三方库按包分组，业务代码升级时库的 hash 不变，用户可继续用缓存。按需引入避免整包：`highlight.js` 全量语言包 1MB+，只注册用到的语言能省一个数量级。

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
        // 2. 第三方库单独分组，缓存更稳
        manualChunks: {
          vue: ['vue', 'vue-router'],
          markdown: ['marked', 'highlight.js'],
        },
      },
    },
  },
})

// 3. 只注册需要的语言，避免整包 1MB+
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
hljs.registerLanguage('typescript', typescript)
```

## 4. 数据对比

| 模块 | 估算体积 |
|---|---|
| 入口 / 主包 | 1180 KB |
| vendor-vue | 320 KB |
| markdown（marked + highlight.js） | 860 KB |
| 高亮语言包（按需） | 180 KB → 150 KB |
| 首屏关键路径 | 随拆分数下降 |

测量方式：案例用「勾选模块估算体积」模拟构建产物，数值为 Demo 内置的近似体积，不是真实 `vite build` 输出；真实项目应以构建日志 + `rollup-plugin-visualizer` 为准。

## 5. 追问与边界

**Q：chunk 越小越好吗？**
不是。小于 10KB 的 chunk 多一个请求反而更慢；拆得太碎会让瀑布请求链变长。

**Q：为什么改了业务代码，用户还要重下 vendor？**
没有拆 vendor 或 `manualChunks` 写错，库和业务被打进同一个 chunk，hash 一起变。

**Q：体积大就一定慢吗？**
不一定。看 gzip/brotli 后的传输体积与首屏关键路径；CDN、缓存命中率同样重要。

坑：`manualChunks` 写死包名，库改名后失效；用函数按 `node_modules` 路径分组更稳。边界：首屏马上要用的模块不要拆；CSS 也会跟随 chunk，注意 FOUC。
