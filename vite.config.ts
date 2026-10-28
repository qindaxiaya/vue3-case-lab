import vue from '@vitejs/plugin-vue'
import { defineConfig, type PluginOption } from 'vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import path from 'node:path'

/** 统一成正斜杠：Windows 下路径是反斜杠，判断目录时两边要一致 */
function toPosix(value: string): string {
  return value.replace(/\\/g, '/')
}

/**
 * 从模块路径提取案例坐标（src/examples/<分类>/<案例>/...）
 * 只认 examples 下还有第三层目录的路径，registry.ts 这类文件不会误判
 */
function getCasePath(moduleId?: string | null): string | null {
  if (!moduleId) return null
  const matched = toPosix(moduleId).match(/\/examples\/([^/]+)\/([^/]+)\//)
  return matched ? `${matched[1]}/${matched[2]}` : null
}

/** 三个路由页的 chunk / 样式名（固定集合，避免误判案例目录） */
const PAGE_NAMES = new Set(['HomePage', 'CaseListPage', 'CasePage'])

/**
 * JS chunk 输出路径
 * - 入口：assets/js/index-<hash>.js
 * - 第三方：assets/js/vendor/vue-<hash>.js
 * - 路由页：assets/js/pages/CasePage-<hash>.js
 * - 案例：assets/js/cases/<分类>/<案例>/Demo-<hash>.js
 *   同一案例的 demo 源码、教学代码文本也放进该案例目录，排查时按案例找
 * - 其它（pdf 等）：assets/js/lib/...
 */
function chunkFileName(chunk: {
  name: string
  facadeModuleId: string | null
}): string {
  const casePath = getCasePath(chunk.facadeModuleId)

  if (casePath) {
    const id = toPosix(chunk.facadeModuleId ?? '')
    // 去掉 ?raw 之类的查询串后再取文件名
    const rawName = (id.split('/').pop() ?? 'chunk').replace(/\?.*$/, '')
    let base: string

    if (rawName === 'Demo.vue') {
      // Demo.vue 本体 → Demo；Demo.vue?raw（源码文本）→ Demo.source
      base = id.includes('?raw') ? 'Demo.source' : 'Demo'
    } else {
      // code/usage.vue.txt → usage.vue
      base = rawName.replace(/\.txt$/, '')
    }

    return `assets/js/cases/${casePath}/${base}-[hash].js`
  }

  if (chunk.name.startsWith('vendor-')) {
    return `assets/js/vendor/${chunk.name.replace(/^vendor-/, '')}-[hash].js`
  }

  if (PAGE_NAMES.has(chunk.name)) {
    return `assets/js/pages/${chunk.name}-[hash].js`
  }

  // pdf.js 这类大库单独归档，和业务 chunk 分开
  if (/^(?:pdf|pdfjs)/i.test(chunk.name)) {
    return `assets/js/lib/${chunk.name}-[hash].js`
  }

  return `assets/js/chunks/${chunk.name}-[hash].js`
}

/** 图片 / 字体扩展名 → 资源目录 */
const FONT_EXTS = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot'])
const MEDIA_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
  '.ico',
])

/**
 * 非 JS 资源输出路径（CSS / 图片 / 字体 / worker）
 * - 入口样式：assets/css/index-<hash>.css
 * - 第三方样式：assets/css/vendor/element-plus...css
 * - 路由页样式：assets/css/pages/CasePage-<hash>.css
 * - 案例样式：assets/css/cases/<分类>/<案例>/Demo-<hash>.css
 * - 高亮主题：assets/css/themes/github-dark-<hash>.css
 */
function assetFileName(asset: {
  names: string[]
  originalFileNames: string[]
}): string {
  const name = asset.names[0] ?? 'asset'
  const ext = path.extname(name).toLowerCase()
  const stem = ext ? name.slice(0, -ext.length) : name

  if (ext === '.css') {
    // 入口样式：站点 token，必须最早加载
    if (stem === 'index') return 'assets/css/index-[hash][extname]'

    // 路由页样式
    if (PAGE_NAMES.has(stem)) {
      return `assets/css/pages/${stem}-[hash][extname]`
    }

    // highlight.js 亮/暗主题
    if (stem.startsWith('github')) {
      return `assets/css/themes/${stem}-[hash][extname]`
    }

    // 案例自身样式：按案例目录归档
    const casePath = asset.originalFileNames
      .map((file) => getCasePath(file))
      .find((value): value is string => Boolean(value))
    if (casePath) {
      return `assets/css/cases/${casePath}/${stem}-[hash][extname]`
    }

    return `assets/css/chunks/${stem}-[hash][extname]`
  }

  if (FONT_EXTS.has(ext)) {
    return 'assets/fonts/[name]-[hash][extname]'
  }

  if (MEDIA_EXTS.has(ext)) {
    return 'assets/media/[name]-[hash][extname]'
  }

  // pdf.js 的 worker 是 ?url 导入的 .mjs 资源，和普通图片区分开
  if (ext === '.mjs' || ext === '.js') {
    return 'assets/js/workers/[name]-[hash][extname]'
  }

  return 'assets/misc/[name]-[hash][extname]'
}

/**
 * 分包与产物布局
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
    // 按需引入：模板里写 <n-input> 时自动补 import；Naive 的样式是
    // CSS-in-JS 随组件 JS 一起走，无需也无法单独 import 样式文件
    Components({
      dts: 'src/components.d.ts',
      resolvers: [NaiveUiResolver()],
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
        // 产物按「类型 → 用途 → 案例」分目录，见上方三个命名函数
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: chunkFileName,
        assetFileNames: assetFileName,
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
            // Naive UI：演示区控件（7 个案例 + 后续批次继续铺开）。
            // 样式是 CSS-in-JS 随 JS 模块走，直接按包名归入本组即可；
            // Vue 组优先级更高，运行时不会被这里卷走
            {
              name: 'vendor-naive-ui',
              test: /node_modules[\\/]naive-ui[\\/]/,
              priority: 40,
              // 必须递归收编依赖：naive 依赖 css-render / vooks / lodash 等
              // 十来个小包，全部跟着 naive 一起进本 chunk（都是懒加载依赖）；
              // 若关闭递归这些零散包会被内联进各 Demo chunk，与 vendor 形成
              // 跨 chunk 循环 import，生产构建下模块初始化顺序错乱（实测
              // vitest-gate 的 n-select 报「Lt is not a function」）。
              // Vue 运行时必须仍由 vendor-vue（priority 100）先认领
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
