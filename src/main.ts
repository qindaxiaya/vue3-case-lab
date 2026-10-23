// 应用入口：Element Plus 基础样式 → 站点样式 → 挂载路由 → 创建并挂载根组件
// Element Plus 只用于 Demo 通用表单控件，不做整包注册（组件由 unplugin 按需引入）
//
// 打包优化（2026-10-21）：
// - 不再整包引入 element-plus/dist/index.css（353 KB 全量主题）
// - 这里只留 CSS 变量/基础层（base.css）与暗色变量；
//   具体组件样式由 unplugin 按需注入到对应 Demo 的 chunk，打开案例时才下载
// - base.css 必须在 style.scss 之前：站点的 _element.scss 靠后加载才能覆盖官方变量
import 'element-plus/theme-chalk/base.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './style.scss'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

// 创建应用实例，注册路由后挂载到 #app 容器
createApp(App).use(router).mount('#app')
