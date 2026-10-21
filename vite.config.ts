import vue from '@vitejs/plugin-vue'
import { defineConfig, type PluginOption } from 'vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

/**
 * 手动分包：把长期不变的第三方依赖拆成独立 chunk
 * - 业务代码改一行时，vendor 缓存仍然有效（企业项目缓存命中的关键）
 * - 没有被当前页面用到的 vendor chunk 不会下载：
 *   element-plus 只被 3 个 Demo 引用，markdown 只被详情页引用
 *
 * 为什么不用 output.manualChunks：
 * Vite 8 底层是 Rolldown，manualChunks 会被转换成单个 codeSplitting 组，
 * 而该组默认「递归收编依赖」（includeDependenciesRecursively: true），
 * 会把 Vue 运行时卷进 element-plus 的 chunk，导致首屏被迫预加载 200 KB。
 * 改用 codeSplitting.groups + priority：Vue 优先级最高，先被认领，
 * 其它组就不能再把它卷走。
 */
export default defineConfig({
  plugins: [
    vue(),
    // 按需引入：模板里写 <el-input> 时自动补 import + 该组件的样式；
    // importStyle: 'css' 让组件样式跟着 Demo 的 chunk 走，
    // 不再把 353 KB 的完整主题塞进首屏 CSS（站点只用到 3 个表单控件）。
    Components({
      dts: 'src/components.d.ts',
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
    }),
  ] as PluginOption[],

  build: {
    // 关闭 sourcemap：线上不需要，还能少一份可被还原的源码
    sourcemap: false,
    // CSS 按 chunk 拆分：只有打开用到 Element Plus 的案例才下载对应样式
    cssCodeSplit: true,
    // 单 chunk 超过 600 KB 才告警：拆包后正常规模在 200 KB 以内，
    // 保留告警是为了防止以后又把大依赖塞回主包
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // 文件名带上来源，便于排查线上加载了哪些 chunk
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        codeSplitting: {
          groups: [
            // Vue 运行时与路由：所有页面都依赖，优先级最高
            {
              name: 'vendor-vue',
              test: /node_modules[\\/](?:vue|vue-router|@vue)[\\/]/,
              priority: 100,
            },
            // 详情页的语法高亮与 Markdown 渲染：只有案例详情页需要。
            // 只收 lib/ 下的 JS，highlight.js/styles/*.css?url 必须留给入口，
            // 否则首屏会为了一个主题 CSS 的 URL 加载整个 markdown chunk
            {
              name: 'vendor-markdown',
              test: /node_modules[\\/](?:highlight\.js[\\/]lib|marked)[\\/]/,
              priority: 50,
            },
            // Element Plus：仅 debounce-throttle / json-viewer / vitest-gate 使用。
            // theme-chalk 下的 CSS 不参与分组：base.css / dark 变量由 main.ts 引入，
            // 必须留在入口样式里，保证站点的 _element.scss 能后加载覆盖官方变量
            {
              name: 'vendor-element-plus',
              test: (id: string) =>
                /node_modules[\\/](?:element-plus|@element-plus)[\\/]/.test(id) &&
                !id.endsWith('.css'),
              priority: 40,
              // 不要递归收编依赖：EP 组件的样式模块会 import theme-chalk/base.css，
              // 递归会把首屏必需的 CSS 变量一起卷进懒加载 chunk，
              // 导致入口被迫预加载整个 EP chunk，且官方变量晚于站点覆盖层生效
              includeDependenciesRecursively: false,
            },
            // 通用工具库：体积小但复用广，独立一块避免跟业务代码一起失效
            {
              name: 'vendor-utils',
              test: /node_modules[\\/](?:@vueuse|fuse\.js)[\\/]/,
              priority: 30,
            },
          ],
        },
      },
    },
  },
})
